/**
 * Delete a specific context entry
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase, getCurrentSystemId } from '../db/helpers.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  context_key: z.string().min(1).max(255),
  project_name: z.string().min(1).max(255).optional()
});

export const deleteContextTool: Tool = {
  name: 'delete_context',
  description: `Delete a specific context entry. Can specify project name for scoped deletion.

Examples:
- "Delete context 'outdated-api-docs' from project 'my-app'"
- "Remove context entry 'temp-debug-notes'"
- "Delete 'old-meeting-notes' from 'client-project'"
- "Clean up context 'test-data-2023'"

Note: Data is soft-deleted and can be recovered within 7 days.`,
  inputSchema: {
    type: 'object',
    properties: {
      context_key: {
        type: 'string',
        description: 'The key of the context entry to delete'
      },
      project_name: {
        type: 'string',
        description: 'Optional project name to scope the deletion'
      }
    },
    required: ['context_key']
  }
};

export async function deleteContext(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  
  const contextKey = sanitizeInput(validated.context_key);
  const projectName = validated.project_name ? sanitizeInput(validated.project_name) : null;
  
  let query = `
    SELECT ce.id, ce.key, ce.deleted_at, p.name as project_name
    FROM context_entries ce
    LEFT JOIN projects p ON ce.project_id = p.id
    WHERE ce.key = ?
  `;
  const params: any[] = [contextKey];
  
  if (projectName) {
    query += ' AND p.name = ?';
    params.push(projectName);
  }
  
  const context = db.prepare(query).get(...params) as {
    id: number;
    key: string;
    deleted_at: string | null;
    project_name: string | null;
  } | undefined;
  
  if (!context) {
    throw new ApplicationError(
      `Context entry '${contextKey}' not found${projectName ? ` in project '${projectName}'` : ''}`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  if (context.deleted_at) {
    throw new ApplicationError(
      `Context entry '${contextKey}' is already deleted`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  // Perform soft delete
  const deletedAt = new Date().toISOString();
  
  db.prepare(`
    UPDATE context_entries 
    SET deleted_at = ?, deleted_by = ?
    WHERE id = ?
  `).run(deletedAt, systemId, context.id);
  
  // Log deletion
  db.prepare(`
    INSERT INTO update_history (entity_type, entity_id, action, changes)
    VALUES ('context', ?, 'delete', ?)
  `).run(
    context.id,
    JSON.stringify({
      context_key: contextKey,
      project_name: context.project_name,
      deleted_by: systemId
    })
  );
  
  return `✅ Context entry '${contextKey}' deleted${context.project_name ? ` from project '${context.project_name}'` : ''}

⚠️  This is a soft delete. Data will be permanently removed after 7 days.`;
}
