/**
 * Cleanup old data based on last update time
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase, getCurrentSystemId } from '../db/helpers.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  older_than: z.string().regex(/^\d+\s+(days?|months?|years?)$/),
  dry_run: z.boolean().default(true)
});

export const cleanupOldDataTool: Tool = {
  name: 'cleanup_old_data',
  description: `Delete data that hasn't been updated in the specified time period. Use dry_run to preview what would be deleted.

Examples:
- "Preview cleanup of data older than 30 days (dry run)"
- "Delete contexts not updated in 6 months"
- "Clean up projects older than 1 year (dry_run: false)"
- "Show what would be deleted if cleaning data older than 90 days"

Always does a dry run by default for safety!`,
  inputSchema: {
    type: 'object',
    properties: {
      older_than: {
        type: 'string',
        description: 'Time period (e.g., "30 days", "6 months", "1 year")'
      },
      dry_run: {
        type: 'boolean',
        description: 'If true, only show what would be deleted without actually deleting',
        default: true
      }
    },
    required: ['older_than']
  }
};

export async function cleanupOldData(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  
  // Parse time period
  const match = validated.older_than.match(/^(\d+)\s+(days?|months?|years?)$/);
  if (!match) {
    throw new ApplicationError(
      'Invalid time period format. Use format like "30 days" or "6 months"',
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  const [, amount, unit] = match;
  const multiplier = unit.startsWith('day') ? 1 : 
                    unit.startsWith('month') ? 30 : 
                    365; // year
  const days = parseInt(amount) * multiplier;
  
  // Find old projects
  const oldProjects = db.prepare(`
    SELECT id, name, updated_at,
           (SELECT COUNT(*) FROM context_entries WHERE project_id = p.id AND deleted_at IS NULL) as context_count
    FROM projects p
    WHERE deleted_at IS NULL
      AND datetime(updated_at) < datetime('now', '-${days} days')
      AND status != 'active'
    ORDER BY updated_at ASC
  `).all() as Array<{
    id: number;
    name: string;
    updated_at: string;
    context_count: number;
  }>;
  
  // Find old standalone contexts
  const oldContexts = db.prepare(`
    SELECT id, key, type, updated_at
    FROM context_entries
    WHERE deleted_at IS NULL
      AND project_id IS NULL
      AND datetime(updated_at) < datetime('now', '-${days} days')
    ORDER BY updated_at ASC
  `).all() as Array<{
    id: number;
    key: string;
    type: string;
    updated_at: string;
  }>;
  
  if (validated.dry_run) {
    let report = `🔍 Cleanup Report (Dry Run)\n\n`;
    report += `Would delete data older than ${validated.older_than}:\n\n`;
    
    if (oldProjects.length > 0) {
      report += `📁 Projects (${oldProjects.length}):\n`;
      oldProjects.forEach(p => {
        const lastUpdate = new Date(p.updated_at).toLocaleDateString();
        report += `  - ${p.name} (${p.context_count} contexts, last updated: ${lastUpdate})\n`;
      });
      report += '\n';
    }
    
    if (oldContexts.length > 0) {
      report += `📝 Standalone Contexts (${oldContexts.length}):\n`;
      oldContexts.forEach(c => {
        const lastUpdate = new Date(c.updated_at).toLocaleDateString();
        report += `  - ${c.key} (${c.type}, last updated: ${lastUpdate})\n`;
      });
    }
    
    if (oldProjects.length === 0 && oldContexts.length === 0) {
      report += 'No data found matching criteria.';
    } else {
      report += `\nTo perform actual deletion, run again with dry_run: false`;
    }
    
    return report;
  }
  
  // Perform actual cleanup
  const deletedAt = new Date().toISOString();
  let projectsDeleted = 0;
  let contextsDeleted = 0;
  
  db.transaction(() => {
    // Delete old projects
    for (const project of oldProjects) {
      db.prepare(`
        UPDATE projects 
        SET deleted_at = ?, deleted_by = ?
        WHERE id = ?
      `).run(deletedAt, systemId, project.id);
      
      // Cascade delete contexts
      db.prepare(`
        UPDATE context_entries 
        SET deleted_at = ?, deleted_by = ?
        WHERE project_id = ? AND deleted_at IS NULL
      `).run(deletedAt, systemId, project.id);
      
      projectsDeleted++;
    }
    
    // Delete old standalone contexts
    for (const context of oldContexts) {
      db.prepare(`
        UPDATE context_entries 
        SET deleted_at = ?, deleted_by = ?
        WHERE id = ?
      `).run(deletedAt, systemId, context.id);
      
      contextsDeleted++;
    }
    
    // Log cleanup
    if (projectsDeleted > 0 || contextsDeleted > 0) {
      db.prepare(`
        INSERT INTO update_history (entity_type, entity_id, action, changes)
        VALUES ('system', ?, 'cleanup', ?)
      `).run(
        systemId,
        JSON.stringify({
          older_than: validated.older_than,
          projects_deleted: projectsDeleted,
          contexts_deleted: contextsDeleted,
          deleted_by: systemId
        })
      );
    }
  })();
  
  return `✅ Cleanup Complete

Deleted:
- Projects: ${projectsDeleted}
- Standalone contexts: ${contextsDeleted}

⚠️  This is a soft delete. Data will be permanently removed after 7 days.`;
}
