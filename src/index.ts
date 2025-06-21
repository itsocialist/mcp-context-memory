#!/usr/bin/env node

/**
 * MCP Context Memory Server
 * Provides persistent project context across Claude sessions
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { DatabaseManager } from './db/database.js';

// Import tools
import { createStoreProjectContextTool, handleStoreProjectContext } from './tools/storeProjectContext.js';
import { createStoreContextTool, handleStoreContext } from './tools/storeContext.js';
import { createSearchContextTool, handleSearchContext } from './tools/searchContext.js';
import { createGetProjectContextTool, handleGetProjectContext } from './tools/getProjectContext.js';
import { createListProjectsTool, handleListProjects } from './tools/listProjects.js';
import { createUpdateProjectStatusTool, handleUpdateProjectStatus } from './tools/updateProjectStatus.js';
import { createGetRecentUpdatesTool, handleGetRecentUpdates } from './tools/getRecentUpdates.js';

class MCPContextMemoryServer {
  private server: Server;
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.server = new Server(
      {
        name: 'mcp-context-memory',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        createStoreProjectContextTool(this.db),
        createStoreContextTool(this.db),
        createSearchContextTool(this.db),
        createGetProjectContextTool(this.db),
        createListProjectsTool(this.db),
        createUpdateProjectStatusTool(this.db),
        createGetRecentUpdatesTool(this.db),
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result: string | { error: string; code?: string };

        switch (name) {
          case 'store_project_context':
            const projectResult = await handleStoreProjectContext(this.db, args);
            // Check if it's an error response
            if (typeof projectResult === 'object' && 'error' in projectResult) {
              throw new Error(projectResult.error);
            }
            result = projectResult;
            break;
          case 'store_context':
            const contextResult = await handleStoreContext(this.db, args);
            if (typeof contextResult === 'object' && 'error' in contextResult) {
              throw new Error(contextResult.error);
            }
            result = contextResult;
            break;
          case 'search_context':
            result = await handleSearchContext(this.db, args);
            break;
          case 'get_project_context':
            result = await handleGetProjectContext(this.db, args);
            break;
          case 'list_projects':
            result = await handleListProjects(this.db, args);
            break;
          case 'update_project_status':
            result = await handleUpdateProjectStatus(this.db, args);
            break;
          case 'get_recent_updates':
            result = await handleGetRecentUpdates(this.db, args);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        // Ensure result is a string
        if (typeof result === 'object' && result && 'error' in result) {
          throw new Error((result as any).error);
        }

        return {
          content: [
            {
              type: 'text',
              text: result as string,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${errorMessage}`,
            },
          ],
        };
      }
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private shutdown(): void {
    console.error('Shutting down MCP Context Memory Server...');
    this.db.close();
    process.exit(0);
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Context Memory Server running on stdio');
  }
}

// Main entry point
async function main() {
  try {
    // Initialize database with async factory method
    const dbPath = process.env.MCP_CONTEXT_DB_PATH;
    const db = await DatabaseManager.create(dbPath);
    
    // Check migration status
    const migrationStatus = await db.getMigrationStatus();
    console.error(`Database initialized. Schema version: ${migrationStatus.currentVersion}`);
    
    // Create and run server
    const server = new MCPContextMemoryServer(db);
    await server.run();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
main();
