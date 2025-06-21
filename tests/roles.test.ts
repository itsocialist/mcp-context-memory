/**
 * Tests for role-based functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { migration_002_roles } from '../src/db/migrations/002_roles.js';
import { DEFAULT_ROLE_IDS } from '../src/types/roles.js';

// We'll test the database operations directly rather than through the tools
// since the tools have complex dependencies

describe('Role Functionality', () => {
  let db: Database.Database;
  let testProjectId: number;
  let testSystemId: number;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');
    
    // Run initial schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS systems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        hostname TEXT NOT NULL,
        platform TEXT NOT NULL,
        is_current BOOLEAN DEFAULT FALSE,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        status TEXT CHECK(status IN ('active', 'paused', 'completed', 'archived')) DEFAULT 'active',
        repository_url TEXT,
        local_directory TEXT,
        primary_system_id INTEGER REFERENCES systems(id),
        tags JSON DEFAULT '[]',
        metadata JSON DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS context_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id),
        system_id INTEGER REFERENCES systems(id),
        type TEXT NOT NULL CHECK(type IN ('decision', 'code', 'standard', 'status', 'todo', 'note', 'config', 'issue', 'reference')),
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        is_system_specific BOOLEAN DEFAULT FALSE,
        tags JSON DEFAULT '[]',
        metadata JSON DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS update_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('project', 'context', 'system')),
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details JSON,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Run role migration
    migration_002_roles.up(db);

    // Create test system
    const systemResult = db.prepare(`
      INSERT INTO systems (name, hostname, platform, is_current)
      VALUES ('test-system', 'test-host', 'test-platform', 1)
    `).run();
    testSystemId = systemResult.lastInsertRowid as number;

    // Create test project
    const projectResult = db.prepare(`
      INSERT INTO projects (name, description, primary_system_id)
      VALUES ('test-project', 'Test project for role tests', ?)
    `).run(testSystemId);
    testProjectId = projectResult.lastInsertRowid as number;
  });

  afterEach(() => {
    db.close();
  });

  describe('Database Migration', () => {
    it('should create all role-related tables', () => {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('roles', 'project_roles', 'role_handoffs', 'active_roles')
        ORDER BY name
      `).all();

      expect(tables).toHaveLength(4);
      expect(tables.map((t: any) => t.name)).toEqual(['active_roles', 'project_roles', 'role_handoffs', 'roles']);
    });

    it('should add role_id columns to existing tables', () => {
      const contextColumns = db.prepare(`
        SELECT name FROM pragma_table_info('context_entries') WHERE name = 'role_id'
      `).all();

      const historyColumns = db.prepare(`
        SELECT name FROM pragma_table_info('update_history') WHERE name = 'role_id'
      `).all();

      expect(contextColumns).toHaveLength(1);
      expect(historyColumns).toHaveLength(1);
    });

    it('should insert default roles', () => {
      const roles = db.prepare('SELECT id, name, is_custom FROM roles ORDER BY id').all();

      expect(roles).toHaveLength(5);
      expect(roles.map((r: any) => r.id)).toEqual(['architect', 'developer', 'devops', 'product', 'qa']);
      expect(roles.every((r: any) => r.is_custom === 0)).toBe(true);
    });

    it('should create proper indexes', () => {
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%role%'
      `).all();

      expect(indexes.map((i: any) => i.name)).toContain('idx_context_entries_role');
      expect(indexes.map((i: any) => i.name)).toContain('idx_context_entries_role_type');
    });
  });

  describe('Role Operations', () => {
    it('should list all default roles', () => {
      const roles = db.prepare('SELECT * FROM roles').all();
      
      expect(roles).toHaveLength(5);
      const roleIds = roles.map((r: any) => r.id);
      expect(roleIds).toContain(DEFAULT_ROLE_IDS.ARCHITECT);
      expect(roleIds).toContain(DEFAULT_ROLE_IDS.DEVELOPER);
      expect(roleIds).toContain(DEFAULT_ROLE_IDS.DEVOPS);
      expect(roleIds).toContain(DEFAULT_ROLE_IDS.QA);
      expect(roleIds).toContain(DEFAULT_ROLE_IDS.PRODUCT);
    });

    it('should switch active role', () => {
      // Set active role
      db.prepare(`
        INSERT INTO active_roles (project_id, system_id, role_id)
        VALUES (?, ?, ?)
      `).run(testProjectId, testSystemId, DEFAULT_ROLE_IDS.DEVELOPER);

      // Verify it was set
      const active = db.prepare(`
        SELECT role_id FROM active_roles 
        WHERE project_id = ? AND system_id = ?
      `).get(testProjectId, testSystemId) as { role_id: string };

      expect(active.role_id).toBe(DEFAULT_ROLE_IDS.DEVELOPER);

      // Switch role
      db.prepare(`
        INSERT OR REPLACE INTO active_roles (project_id, system_id, role_id, activated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(testProjectId, testSystemId, DEFAULT_ROLE_IDS.ARCHITECT);

      // Verify switch
      const newActive = db.prepare(`
        SELECT role_id FROM active_roles 
        WHERE project_id = ? AND system_id = ?
      `).get(testProjectId, testSystemId) as { role_id: string };

      expect(newActive.role_id).toBe(DEFAULT_ROLE_IDS.ARCHITECT);
    });

    it('should store context with role', () => {
      // Set active role
      db.prepare(`
        INSERT INTO active_roles (project_id, system_id, role_id)
        VALUES (?, ?, ?)
      `).run(testProjectId, testSystemId, DEFAULT_ROLE_IDS.ARCHITECT);

      // Store context with role
      const result = db.prepare(`
        INSERT INTO context_entries 
        (project_id, system_id, type, key, value, role_id, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        testProjectId,
        testSystemId,
        'decision',
        'database-choice',
        'Using PostgreSQL for JSON support',
        DEFAULT_ROLE_IDS.ARCHITECT,
        JSON.stringify(['architecture', 'database'])
      );

      const contextId = result.lastInsertRowid;

      // Verify context has role
      const context = db.prepare(`
        SELECT * FROM context_entries WHERE id = ?
      `).get(contextId) as any;

      expect(context.role_id).toBe(DEFAULT_ROLE_IDS.ARCHITECT);
      expect(context.type).toBe('decision');
      expect(JSON.parse(context.tags)).toContain('architecture');
    });

    it('should filter contexts by role', () => {
      // Create contexts for different roles
      db.prepare(`
        INSERT INTO context_entries (project_id, type, key, value, role_id)
        VALUES 
          (?, 'decision', 'arch-1', 'Architecture decision', ?),
          (?, 'code', 'dev-1', 'Developer code', ?),
          (?, 'config', 'ops-1', 'DevOps config', ?)
      `).run(
        testProjectId, DEFAULT_ROLE_IDS.ARCHITECT,
        testProjectId, DEFAULT_ROLE_IDS.DEVELOPER,
        testProjectId, DEFAULT_ROLE_IDS.DEVOPS
      );

      // Query by role
      const archContexts = db.prepare(`
        SELECT COUNT(*) as count FROM context_entries 
        WHERE project_id = ? AND role_id = ?
      `).get(testProjectId, DEFAULT_ROLE_IDS.ARCHITECT) as { count: number };

      expect(archContexts.count).toBe(1);

      // Query all
      const allContexts = db.prepare(`
        SELECT COUNT(*) as count FROM context_entries 
        WHERE project_id = ?
      `).get(testProjectId) as { count: number };

      expect(allContexts.count).toBe(3);
    });
  });
});
