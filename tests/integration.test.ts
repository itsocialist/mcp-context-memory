import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { DatabaseManager } from '../src/db/database.js';
import { DEFAULT_ROLE_IDS } from '../src/types/roles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MCP Database Integration Tests', () => {
  let db: DatabaseManager;
  const testDbPath = path.join(__dirname, 'test-integration.db');

  beforeEach(async () => {
    // Remove test database if it exists
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }

    // Initialize database
    db = new DatabaseManager(testDbPath);
    await db.initialize();
  });

  afterEach(async () => {
    // Close database
    if (db) {
      db.close();
    }

    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('Project Management', () => {
    it('should create and retrieve a project', () => {
      // Create project
      const project = db.upsertProject({
        name: 'test-project',
        description: 'Integration test project',
        repository_url: 'https://github.com/test/project',
        status: 'active'
      });

      expect(project.name).toBe('test-project');
      expect(project.description).toBe('Integration test project');

      // List projects
      const projects = db.listProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('test-project');
    });

    it('should update project status', () => {
      // Create project
      db.upsertProject({
        name: 'status-test',
        status: 'active'
      });

      // Update status
      db.updateProjectStatus('status-test', 'completed', 'Project finished successfully');

      // Verify status
      const project = db.getProject('status-test');
      expect(project?.status).toBe('completed');
    });
  });

  describe('Role Management', () => {
    let testProjectId: string;
    let testSystemId: string;

    beforeEach(() => {
      // Create a test project
      const project = db.upsertProject({
        name: 'role-test-project',
        description: 'Project for role testing'
      });
      testProjectId = project.id;
      testSystemId = db.getCurrentSystemId();
    });

    it('should list default roles', () => {
      const roles = db.listRoles();
      
      expect(roles).toHaveLength(4);
      expect(roles.some(r => r.id === DEFAULT_ROLE_IDS.ARCHITECT)).toBe(true);
      expect(roles.some(r => r.id === DEFAULT_ROLE_IDS.DEVELOPER)).toBe(true);
      expect(roles.some(r => r.id === DEFAULT_ROLE_IDS.DEVOPS)).toBe(true);
      expect(roles.some(r => r.id === DEFAULT_ROLE_IDS.QA)).toBe(true);
    });

    it('should switch active role and store role-specific context', () => {
      // Switch to developer role
      db.setActiveRole(testProjectId, DEFAULT_ROLE_IDS.DEVELOPER);
      
      // Verify active role
      const activeRole = db.getActiveRole(testProjectId);
      expect(activeRole?.role_id).toBe(DEFAULT_ROLE_IDS.DEVELOPER);

      // Store context with role
      const contextId = db.createContext({
        project_id: testProjectId,
        type: 'code',
        key: 'api-implementation',
        value: 'REST API implementation',
        tags: ['api', 'rest'],
        role_id: DEFAULT_ROLE_IDS.DEVELOPER
      });

      // Get context should show role-specific content
      const contexts = db.searchContext({
        project_id: testProjectId,
        role_id: DEFAULT_ROLE_IDS.DEVELOPER
      });

      expect(contexts).toHaveLength(1);
      expect(contexts[0].key).toBe('api-implementation');
    });

    it('should create role handoff', () => {
      // Set architect as active role
      db.setActiveRole(testProjectId, DEFAULT_ROLE_IDS.ARCHITECT);

      // Store architect contexts
      db.createContext({
        project_id: testProjectId,
        type: 'decision',
        key: 'architecture',
        value: 'Microservices architecture chosen',
        role_id: DEFAULT_ROLE_IDS.ARCHITECT
      });

      db.createContext({
        project_id: testProjectId,
        type: 'decision',
        key: 'database',
        value: 'PostgreSQL for data persistence',
        role_id: DEFAULT_ROLE_IDS.ARCHITECT
      });

      db.createContext({
        project_id: testProjectId,
        type: 'todo',
        key: 'api-design',
        value: 'Design REST API endpoints',
        role_id: DEFAULT_ROLE_IDS.ARCHITECT
      });

      // Create handoff to developer
      const handoffData = {
        summary: 'Architecture phase complete',
        keyDecisions: ['Microservices', 'PostgreSQL'],
        pendingTasks: ['Design REST API endpoints'],
        warnings: []
      };

      const handoffId = db.createRoleHandoff(
        testProjectId,
        DEFAULT_ROLE_IDS.ARCHITECT,
        DEFAULT_ROLE_IDS.DEVELOPER,
        handoffData
      );

      // Verify handoff
      const handoffs = db.getRoleHandoffs(testProjectId);
      expect(handoffs).toHaveLength(1);
      expect(handoffs[0].from_role_id).toBe(DEFAULT_ROLE_IDS.ARCHITECT);
      expect(handoffs[0].to_role_id).toBe(DEFAULT_ROLE_IDS.DEVELOPER);
    });
  });

  describe('Context Storage and Search', () => {
    let testProjectId: string;

    beforeEach(() => {
      const project = db.upsertProject({
        name: 'search-test-project'
      });
      testProjectId = project.id;
    });

    it('should store and search context with roles', () => {
      // Set architect as active role
      db.setActiveRole(testProjectId, DEFAULT_ROLE_IDS.ARCHITECT);

      // Store architect context
      db.createContext({
        project_id: testProjectId,
        type: 'decision',
        key: 'database-choice',
        value: 'PostgreSQL for main database',
        tags: ['database', 'architecture'],
        role_id: DEFAULT_ROLE_IDS.ARCHITECT
      });

      // Switch to developer role
      db.setActiveRole(testProjectId, DEFAULT_ROLE_IDS.DEVELOPER);

      // Store developer context
      db.createContext({
        project_id: testProjectId,
        type: 'code',
        key: 'db-connection',
        value: 'Database connection pool implementation',
        tags: ['database', 'implementation'],
        role_id: DEFAULT_ROLE_IDS.DEVELOPER
      });

      // Search with role filter (should only find developer content)
      const roleSearchResults = db.searchContext({
        project_id: testProjectId,
        role_id: DEFAULT_ROLE_IDS.DEVELOPER,
        query: 'database'
      });

      expect(roleSearchResults).toHaveLength(1);
      expect(roleSearchResults[0].key).toBe('db-connection');

      // Search across all roles
      const allResults = db.searchContext({
        project_id: testProjectId,
        query: 'database'
      });

      expect(allResults).toHaveLength(2);
      expect(allResults.some(r => r.key === 'database-choice')).toBe(true);
      expect(allResults.some(r => r.key === 'db-connection')).toBe(true);
    });

    it('should handle special characters in search', () => {
      db.createContext({
        project_id: testProjectId,
        type: 'note',
        key: 'special-chars',
        value: 'Testing ALPHA-BRAVO-CHARLIE pattern'
      });

      const searchResults = db.searchContext({
        project_id: testProjectId,
        query: 'ALPHA-BRAVO-CHARLIE'
      });

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].key).toBe('special-chars');
      expect(searchResults[0].value).toContain('ALPHA-BRAVO-CHARLIE');
    });

    it('should get recent updates across projects', () => {
      // Create another project
      const project2 = db.upsertProject({
        name: 'another-project'
      });

      // Add context to both projects
      db.createContext({
        project_id: testProjectId,
        type: 'note',
        key: 'note1',
        value: 'First note'
      });

      db.createContext({
        project_id: project2.id,
        type: 'note',
        key: 'note2',
        value: 'Second note'
      });

      // Get recent updates
      const updates = db.getRecentUpdates('-1 hour', 10);

      expect(updates.length).toBeGreaterThanOrEqual(2);
      expect(updates.some(u => u.key === 'note1')).toBe(true);
      expect(updates.some(u => u.key === 'note2')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent projects gracefully', () => {
      const project = db.getProject('non-existent-project');
      expect(project).toBeNull();
    });

    it('should handle invalid context types', () => {
      const project = db.upsertProject({
        name: 'validation-test'
      });

      // This should throw an error in a real scenario
      // For now, we'll just verify the database constraints
      expect(() => {
        db.createContext({
          project_id: project.id,
          type: 'invalid-type' as any,
          key: 'test',
          value: 'test'
        });
      }).toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without roles (legacy mode)', () => {
      const project = db.upsertProject({
        name: 'legacy-project'
      });

      // Store context without role
      const contextId = db.createContext({
        project_id: project.id,
        type: 'note',
        key: 'legacy-note',
        value: 'This should work without roles'
      });

      // Retrieve context
      const contexts = db.getProjectContext(project.id);
      
      expect(contexts).toHaveLength(1);
      expect(contexts[0].key).toBe('legacy-note');
      expect(contexts[0].role_id).toBeNull();
    });

    it('should handle role filtering with null role_id', () => {
      const project = db.upsertProject({
        name: 'mixed-project'
      });

      // Store context without role
      db.createContext({
        project_id: project.id,
        type: 'note',
        key: 'no-role',
        value: 'No role context'
      });

      // Store context with architect role
      db.createContext({
        project_id: project.id,
        type: 'decision',
        key: 'with-role',
        value: 'Architect decision',
        role_id: DEFAULT_ROLE_IDS.ARCHITECT
      });

      // Search should find both
      const allResults = db.searchContext({
        project_id: project.id,
        query: 'context'
      });

      expect(allResults).toHaveLength(2);
      expect(allResults.some(r => r.key === 'no-role')).toBe(true);
      expect(allResults.some(r => r.key === 'with-role')).toBe(true);
    });
  });

  describe('Database Migration', () => {
    it('should have all required tables', () => {
      // Check that all tables exist
      const tables = db.getAllTables();
      
      expect(tables).toContain('systems');
      expect(tables).toContain('projects');
      expect(tables).toContain('context_entries');
      expect(tables).toContain('update_history');
      expect(tables).toContain('context_search');
      expect(tables).toContain('roles');
      expect(tables).toContain('role_handoffs');
      expect(tables).toContain('active_roles');
    });

    it('should have correct schema version', () => {
      const version = db.getSchemaVersion();
      expect(version).toBeGreaterThanOrEqual(3); // Should be at least version 3 with roles
    });
  });

  describe('System Management', () => {
    it('should track different systems', () => {
      const currentSystem = db.getCurrentSystem();
      expect(currentSystem).toBeDefined();
      expect(currentSystem?.hostname).toBeDefined();
      expect(currentSystem?.platform).toBeDefined();
    });

    it('should handle system-specific contexts', () => {
      const project = db.upsertProject({
        name: 'system-test'
      });

      // Create system-specific context
      db.createContext({
        project_id: project.id,
        type: 'config',
        key: 'local-path',
        value: '/Users/test/project',
        is_system_specific: true
      });

      // Get contexts - should include system-specific ones for current system
      const contexts = db.getProjectContext(project.id, true);
      expect(contexts).toHaveLength(1);
      expect(contexts[0].is_system_specific).toBe(1);
    });
  });

  describe('Tag Management', () => {
    it('should handle tags properly', () => {
      const project = db.upsertProject({
        name: 'tag-test',
        tags: ['web', 'react', 'typescript']
      });

      expect(project.tags).toEqual(['web', 'react', 'typescript']);

      // Update tags
      const updated = db.upsertProject({
        name: 'tag-test',
        tags: ['web', 'react', 'typescript', 'testing']
      });

      expect(updated.tags).toEqual(['web', 'react', 'typescript', 'testing']);
    });

    it('should search by tags', () => {
      const project = db.upsertProject({
        name: 'tag-search-test'
      });

      // Create contexts with tags
      db.createContext({
        project_id: project.id,
        type: 'note',
        key: 'tagged-note',
        value: 'Note with tags',
        tags: ['important', 'review']
      });

      // Search by tag
      const results = db.searchContext({
        project_id: project.id,
        tags: ['important']
      });

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('tagged-note');
    });
  });

  describe('Performance and Limits', () => {
    it('should handle large context values', () => {
      const project = db.upsertProject({
        name: 'large-test'
      });

      const largeValue = 'x'.repeat(10000); // 10KB of text

      const contextId = db.createContext({
        project_id: project.id,
        type: 'note',
        key: 'large-note',
        value: largeValue
      });

      const retrieved = db.getContext(contextId);
      expect(retrieved?.value).toBe(largeValue);
    });

    it('should paginate search results', () => {
      const project = db.upsertProject({
        name: 'pagination-test'
      });

      // Create many contexts
      for (let i = 0; i < 30; i++) {
        db.createContext({
          project_id: project.id,
          type: 'note',
          key: `note-${i}`,
          value: `Test note number ${i}`
        });
      }

      // Search with limit
      const results = db.searchContext({
        project_id: project.id,
        limit: 10
      });

      expect(results).toHaveLength(10);
    });
  });
});
