/**
 * Switch the active role for a project
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId } from '../db/helpers.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255),
  role_id: z.string().min(1).max(50)
});

export const switchRoleTool: Tool = {
  name: 'switch_role',
  description: 'Switch to a different role for a project',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'The name of the project'
      },
      role_id: {
        type: 'string',
        description: 'The ID of the role to switch to (e.g., architect, developer, devops, qa, product)'
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
  
  // Get project
  const project = db.prepare(
    'SELECT id FROM projects WHERE name = ?'
  ).get(projectName) as { id: number } | undefined;
  
  if (!project) {
    throw new ApplicationError(
      `Project '${projectName}' not found`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  // Verify role exists
  const role = db.prepare(
    'SELECT id, name FROM roles WHERE id = ?'
  ).get(roleId) as { id: string; name: string } | undefined;
  
  if (!role) {
    throw new ApplicationError(
      `Role '${roleId}' not found`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  // Switch active role
  db.prepare(`
    INSERT OR REPLACE INTO active_roles (project_id, system_id, role_id, activated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `).run(project.id, systemId, roleId);
  
  // Log the switch in update history
  db.prepare(`
    INSERT INTO update_history (entity_type, entity_id, action, changes)
    VALUES ('project', ?, 'role_switch', ?)
  `).run(
    project.id,
    JSON.stringify({
      role_id: roleId,
      role_name: role.name,
      system_id: systemId
    })
  );
  
  return `✅ Switched to ${role.name} role for project '${projectName}'

You are now working as: ${role.name}
Project: ${projectName}

The ${role.name} role will influence:
- How context is categorized
- Default tags applied
- Suggested context types
- Role-specific filtering in searches`;
}
