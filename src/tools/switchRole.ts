/**
 * Switch active role for a project
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId, sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';
import { DEFAULT_ROLE_IDS } from '../types/roles.js';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255),
  role_id: z.string().min(1).max(50)
});

export const switchRoleTool: Tool = {
  name: 'switch_role',
  description: 'Switch the active role for a project. This affects how context is stored and retrieved.',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the project'
      },
      role_id: {
        type: 'string',
        description: 'ID of the role to switch to (e.g., architect, developer, devops, qa, product)',
        enum: Object.values(DEFAULT_ROLE_IDS)
      }
    },
    required: ['project_name', 'role_id']
  }
};

export async function switchRole(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  
  const projectName = sanitizeInput(validated.project_name);
  const roleId = sanitizeInput(validated.role_id);
  
  return db.transaction(() => {
    // Get project
    const project = db.prepare(
      'SELECT id, name FROM projects WHERE name = ?'
    ).get(projectName) as { id: number; name: string } | undefined;
    
    if (!project) {
      throw new ApplicationError(
        `Project '${projectName}' not found`,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Check if role exists
    const role = db.prepare(
      'SELECT id, name, description FROM roles WHERE id = ?'
    ).get(roleId) as { id: string; name: string; description: string } | undefined;
    
    if (!role) {
      throw new ApplicationError(
        `Role '${roleId}' not found`,
        ERROR_CODES.NOT_FOUND
      );
    }
    
    // Check if role is enabled for this project
    const projectRole = db.prepare(`
      SELECT is_active FROM project_roles 
      WHERE project_id = ? AND role_id = ?
    `).get(project.id, roleId) as { is_active: number } | undefined;
    
    // If not explicitly configured, enable it
    if (!projectRole) {
      db.prepare(`
        INSERT INTO project_roles (project_id, role_id, is_active)
        VALUES (?, ?, TRUE)
      `).run(project.id, roleId);
    } else if (!projectRole.is_active) {
      throw new ApplicationError(
        `Role '${role.name}' is not active for project '${projectName}'`,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    
    // Get previous active role for handoff suggestion
    const previousRole = db.prepare(`
      SELECT r.id, r.name 
      FROM active_roles ar
      JOIN roles r ON ar.role_id = r.id
      WHERE ar.project_id = ? AND ar.system_id = ?
    `).get(project.id, systemId) as { id: string; name: string } | undefined;

    // Update active role
    db.prepare(`
      INSERT OR REPLACE INTO active_roles (project_id, system_id, role_id, activated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(project.id, systemId, roleId);
    
    // Log the role switch
    db.prepare(`
      INSERT INTO update_history (entity_type, entity_id, action, details, role_id)
      VALUES ('project', ?, 'switch_role', json(?), ?)
    `).run(
      project.id,
      JSON.stringify({
        from_role: previousRole?.id || null,
        to_role: roleId,
        system_id: systemId
      }),
      roleId
    );
    
    // Get role context summary
    const recentContext = db.prepare(`
      SELECT type, COUNT(*) as count
      FROM context_entries
      WHERE project_id = ? AND role_id = ?
      GROUP BY type
      ORDER BY count DESC
      LIMIT 5
    `).all(project.id, roleId) as Array<{ type: string; count: number }>;
    
    const lastActivity = db.prepare(`
      SELECT MAX(updated_at) as last_update
      FROM context_entries
      WHERE project_id = ? AND role_id = ?
    `).get(project.id, roleId) as { last_update: string } | undefined;
    
    return {
      success: true,
      project: projectName,
      previousRole: previousRole ? {
        id: previousRole.id,
        name: previousRole.name
      } : null,
      currentRole: {
        id: role.id,
        name: role.name,
        description: role.description
      },
      roleContext: {
        entriesCount: recentContext.reduce((sum: number, r) => sum + r.count, 0),
        byType: recentContext,
        lastActivity: lastActivity?.last_update || null
      },
      suggestion: previousRole && previousRole.id !== roleId
        ? `Consider creating a handoff from ${previousRole.name} to ${role.name} to capture important context.`
        : null
    };
  }) as any;
}
