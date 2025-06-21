/**
 * MCP Tool: Store Context
 * Stores context entries for projects or shared contexts
 * Now with enhanced error handling
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from '../db/database.js';
import { storeContextSchema } from '../types/schemas.js';
import type { StoreContextInput } from '../types/index.js';
import { NotFoundError, ValidationError, withErrorHandling } from '../utils/errors.js';

export function createStoreContextTool(db: DatabaseManager): Tool {
  return {
    name: 'store_context',
    description: `Store context information for a project or as shared context (coding standards, decisions, etc.).
    
Context types:
- decision: Architectural or design decisions
- code: Code snippets or examples  
- standard: Coding standards or conventions
- status: Project status updates
- todo: Tasks or action items
- note: General notes
- config: Configuration details
- issue: Known issues or bugs
- reference: External references or links

Examples:
- "Remember this decision for project 'my-app': We chose PostgreSQL for better JSON support"
- "Store shared coding standard: Always use TypeScript strict mode"
- "Remember this is system-specific for project 'my-app': Database is at localhost:5432"`,
    
    inputSchema: {
      type: 'object',
      properties: {
        project_name: {
          type: 'string',
          description: 'Project name (omit for shared context)'
        },
        type: {
          type: 'string',
          enum: ['decision', 'code', 'standard', 'status', 'todo', 'note', 'config', 'issue', 'reference'],
          description: 'Type of context entry'
        },
        key: {
          type: 'string',
          description: 'Unique key/title for this context'
        },
        value: {
          type: 'string',
          description: 'The context content/value'
        },
        is_system_specific: {
          type: 'boolean',
          description: 'Whether this context is specific to current system',
          default: false
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization'
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata'
        }
      },
      required: ['type', 'key', 'value']
    }
  };
}

export const handleStoreContext = withErrorHandling(async (
  db: DatabaseManager,
  input: unknown
): Promise<string> => {
  const validated = storeContextSchema.parse(input) as StoreContextInput;
  
  let projectId: number | null = null;
  
  // Get project ID if project name provided
  if (validated.project_name) {
    const project = db.getProject(validated.project_name);
    if (!project) {
      throw new NotFoundError('Project', validated.project_name);
    }
    projectId = project.id;
  }
  
  const entry = db.storeContext({
    project_id: projectId,
    type: validated.type,
    key: validated.key,
    value: validated.value,
    is_system_specific: validated.is_system_specific,
    tags: validated.tags,
    metadata: validated.metadata
  });
  
  const parts = [
    `✅ Stored ${validated.type} context: "${entry.key}"`,
    validated.project_name 
      ? `📁 Project: ${validated.project_name}`
      : `🌐 Shared context (available to all projects)`
  ];
  
  if (entry.is_system_specific) {
    const system = db.getCurrentSystem();
    parts.push(`💻 System-specific to: ${system?.name || 'current system'}`);
  }
  
  if (entry.tags && Array.isArray(entry.tags) && entry.tags.length > 0) {
    parts.push(`🏷️  Tags: ${entry.tags.join(', ')}`);
  }
  
  // Show preview of value if not too long
  if (entry.value.length <= 100) {
    parts.push(`📝 Value: ${entry.value}`);
  } else {
    parts.push(`📝 Value: ${entry.value.substring(0, 97)}...`);
  }
  
  return parts.join('\n');
});
