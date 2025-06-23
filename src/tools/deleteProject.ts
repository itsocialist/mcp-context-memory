/**
 * Delete a project and all associated data
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase, getCurrentSystemId } from '../db/helpers.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255),
  confirm: z.boolean()
});

export const deleteProjectTool: Tool = {
  name: 'delete_project',
  description: `Delete a project and all associated data. Requires confirmation. Data is soft-deleted and can be recovered within 7 days.

Examples:
- "Delete project 'old-prototype' with confirmation"
- "Remove abandoned project 'test-app-v1'"
- "Clean up project 'demo-2023' (must confirm: true)"

Warning: This cascades to all contexts, role assignments, and handoffs!`,
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'The name of the project to delete'
      },
      confirm: {
        type: 'boolean',
        description: 'Must be true to confirm deletion'
      }
    },
    required: ['project_name', 'confirm']
  }
};

export async function deleteProject(input: unknown) {
  const validated = inputSchema.parse(input);
  
  if (!validated.confirm) {
    throw new ApplicationError(
      'Deletion confirmation required. Set confirm: true to proceed.',
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  const projectName = sanitizeInput(validated.project_name);
  
  // Get project
  const project = db.prepare(
    'SELECT id, name, deleted_at FROM projects WHERE name = ?'
  ).get(projectName) as { id: number; name: string; deleted_at: string | null } | undefined;
  
  if (!project) {
    throw new ApplicationError(
      `Project '${projectName}' not found`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  if (project.deleted_at) {
    throw new ApplicationError(
      `Project '${projectName}' is already deleted`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  // Check for active roles
  const activeRoles = db.prepare(`
    SELECT COUNT(*) as count 
    FROM active_roles ar
    WHERE ar.project_id = ?
  `).get(project.id) as { count: number };
  
  if (activeRoles.count > 0) {
    throw new ApplicationError(
      `Cannot delete project with active roles. Please switch roles first.`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  // Perform soft delete with cascade
  const deletedAt = new Date().toISOString();
  
  const result = db.transaction(() => {
    // Delete project
    db.prepare(`
      UPDATE projects 
      SET deleted_at = ?, deleted_by = ?
      WHERE id = ?
    `).run(deletedAt, systemId, project.id);
    
    // Cascade delete contexts
    const contextsDeleted = db.prepare(`
      UPDATE context_entries 
      SET deleted_at = ?, deleted_by = ?
      WHERE project_id = ? AND deleted_at IS NULL
    `).run(deletedAt, systemId, project.id);
    
    // Cascade delete role assignments
    const rolesDeleted = db.prepare(`
      UPDATE project_roles 
      SET is_active = 0
      WHERE project_id = ?
    `).run(project.id);
    
    // Cascade delete handoffs
    const handoffsDeleted = db.prepare(`
      UPDATE role_handoffs 
      SET deleted_at = ?, deleted_by = ?
      WHERE project_id = ? AND deleted_at IS NULL
    `).run(deletedAt, systemId, project.id);
    
    // Log deletion
    db.prepare(`
      INSERT INTO update_history (entity_type, entity_id, action, changes)
      VALUES ('project', ?, 'delete', ?)
    `).run(
      project.id,
      JSON.stringify({
        project_name: projectName,
        contexts_deleted: contextsDeleted.changes,
        roles_deactivated: rolesDeleted.changes,
        handoffs_deleted: handoffsDeleted.changes,
        deleted_by: systemId
      })
    );
    
    return {
      contextsDeleted: contextsDeleted.changes,
      rolesDeactivated: rolesDeleted.changes,
      handoffsDeleted: handoffsDeleted.changes
    };
  })();
  
  return `✅ Project '${projectName}' successfully deleted

Deletion Summary:
- Contexts deleted: ${result.contextsDeleted}
- Role assignments deactivated: ${result.rolesDeactivated}
- Handoffs deleted: ${result.handoffsDeleted}

⚠️  This is a soft delete. Data will be permanently removed after 7 days.
To recover this project, contact your administrator within 7 days.`;
}
