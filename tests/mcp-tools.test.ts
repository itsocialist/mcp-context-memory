/**
 * MCP Tool Availability Tests
 * These tests ensure all features are actually accessible to users
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { DatabaseManager } from '../src/db/database.js';
import { MCPContextMemoryServer } from '../src/index.js';

describe('MCP Tool Availability', () => {
  let server: any;
  let db: DatabaseManager;
  let availableTools: string[] = [];

  beforeAll(async () => {
    // Initialize the server as it would be in production
    db = await DatabaseManager.create(':memory:');
    
    // Access the server instance
    const serverInstance = new MCPContextMemoryServer(db);
    
    // Get the list of available tools
    const toolsResponse = await serverInstance.server.setRequestHandler(
      { method: 'listTools' },
      async () => ({ tools: [] })
    );
  });

  describe('Core Tools', () => {
    it('should expose project management tools', () => {
      const requiredTools = [
        'store_project_context',
        'list_projects',
        'get_project_context',
        'update_project_status'
      ];
      
      requiredTools.forEach(tool => {
        expect(availableTools).toContain(tool);
      });
    });

    it('should expose context management tools', () => {
      const requiredTools = [
        'store_context',
        'search_context',
        'get_recent_updates'
      ];
      
      requiredTools.forEach(tool => {
        expect(availableTools).toContain(tool);
      });
    });
  });

  describe('Role Management Tools (v0.2.0)', () => {
    it('should expose all role management tools', () => {
      const requiredRoleTools = [
        'list_roles',
        'get_active_role',
        'switch_role',
        'create_role_handoff',
        'get_role_handoffs'
      ];
      
      requiredRoleTools.forEach(tool => {
        expect(availableTools).toContain(tool);
      });
    });
  });

  describe('Tool Functionality', () => {
    it('should successfully call list_roles', async () => {
      const result = await serverInstance.callTool('list_roles', {});
      expect(result).toBeDefined();
      expect(typeof result).toBe('string'); // Should return formatted string
    });

    it('should handle list_roles with project parameter', async () => {
      // First create a project
      await serverInstance.callTool('store_project_context', {
        name: 'test-project'
      });
      
      const result = await serverInstance.callTool('list_roles', {
        project_name: 'test-project'
      });
      
      expect(result).toBeDefined();
      expect(result).toContain('roles');
    });
  });

  describe('User Journey Tests', () => {
    it('should support complete role workflow', async () => {
      // User journey: Set up project with roles
      
      // 1. Create project
      const projectResult = await serverInstance.callTool('store_project_context', {
        name: 'role-test-project',
        description: 'Testing role workflow'
      });
      expect(projectResult).toContain('✅');
      
      // 2. List available roles
      const rolesResult = await serverInstance.callTool('list_roles', {});
      expect(rolesResult).toContain('architect');
      expect(rolesResult).toContain('developer');
      
      // 3. Switch to architect role
      const switchResult = await serverInstance.callTool('switch_role', {
        project_name: 'role-test-project',
        role_id: 'architect'
      });
      expect(switchResult).toContain('✅');
      expect(switchResult).toContain('architect');
      
      // 4. Verify active role
      const activeResult = await serverInstance.callTool('get_active_role', {
        project_name: 'role-test-project'
      });
      expect(activeResult).toContain('architect');
      
      // 5. Create a handoff
      const handoffResult = await serverInstance.callTool('create_role_handoff', {
        project_name: 'role-test-project',
        to_role_id: 'developer',
        summary: 'Architecture complete'
      });
      expect(handoffResult).toContain('✅');
      expect(handoffResult).toContain('handoff created');
    });
  });
});
