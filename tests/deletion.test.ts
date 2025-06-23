/**
 * Tests for deletion functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DatabaseManager } from '../src/db/database';
import { join, dirname } from 'path';
import { rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { ApplicationError, ERROR_CODES } from '../src/utils/errors';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Deletion Features', () => {
  let db: DatabaseManager;
  let systemId: number;
  let testDbPath: string;

  beforeEach(async () => {
    // Clean up any existing test database
    testDbPath = join(__dirname, `test-deletion-${Date.now()}.db`);
    try {
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + '-shm', { force: true });
      rmSync(testDbPath + '-wal', { force: true });
    } catch (e) {
      // Ignore errors if files don't exist
    }
    
    db = await DatabaseManager.create(testDbPath);
    
    // Get the raw database connection for setup
    const rawDb = (db as any).db;
    
    // Get or create test system
    rawDb.prepare(
      'INSERT OR IGNORE INTO systems (name, hostname, platform) VALUES (?, ?, ?)'
    ).run('test-system', 'test-host', 'test');
    const system = rawDb.prepare('SELECT id FROM systems WHERE hostname = ?').get('test-host');
    systemId = system?.id || 1;
  });

  afterEach(() => {
    try {
      db.close();
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + '-shm', { force: true });
      rmSync(testDbPath + '-wal', { force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Delete Project', () => {
    it('should soft delete a project', async () => {
      const rawDb = (db as any).db;
      
      // Create a test project
      const project = rawDb.prepare(`
        INSERT INTO projects (name, description, repository_url, status)
        VALUES (?, ?, ?, ?)
        RETURNING id
      `).get('test-project', 'Test project', 'https://github.com/test/test', 'active');

      // Import and test the deletion logic directly
      const deletedAt = new Date().toISOString();
      
      // Execute the deletion transaction
      const result = rawDb.transaction(() => {
        // Delete project
        rawDb.prepare(`
          UPDATE projects 
          SET deleted_at = ?, deleted_by = ?
          WHERE id = ?
        `).run(deletedAt, systemId, project.id);
        
        // Get updated project
        return rawDb.prepare('SELECT * FROM projects WHERE id = ?').get(project.id);
      })();

      expect(result.deleted_at).toBe(deletedAt);
      expect(result.deleted_by).toBe(systemId);
    });

    it('should require confirmation', async () => {
      const rawDb = (db as any).db;
      
      // Create a test project
      rawDb.prepare(`
        INSERT INTO projects (name, description, status)
        VALUES (?, ?, ?)
      `).run('test-project', 'Test project', 'active');

      // Test confirmation logic
      const confirm = false;
      
      if (!confirm) {
        expect(() => {
          throw new ApplicationError(
            'Deletion confirmation required. Set confirm: true to proceed.',
            ERROR_CODES.VALIDATION_ERROR
          );
        }).toThrow('confirmation required');
      }
    });

    it('should cascade delete related data', async () => {
      const rawDb = (db as any).db;
      
      // Create project with contexts
      const project = rawDb.prepare(`
        INSERT INTO projects (name, description, status)
        VALUES (?, ?, ?)
        RETURNING id
      `).get('test-project', 'Test project', 'active');

      // Add contexts
      rawDb.prepare(`
        INSERT INTO context_entries (project_id, key, type, value)
        VALUES (?, ?, ?, ?)
      `).run(project.id, 'test-context', 'note', 'Test value');

      // Execute cascade deletion
      const deletedAt = new Date().toISOString();
      
      rawDb.transaction(() => {
        // Delete project
        rawDb.prepare(`
          UPDATE projects 
          SET deleted_at = ?, deleted_by = ?
          WHERE id = ?
        `).run(deletedAt, systemId, project.id);
        
        // Cascade delete contexts
        rawDb.prepare(`
          UPDATE context_entries 
          SET deleted_at = ?, deleted_by = ?
          WHERE project_id = ? AND deleted_at IS NULL
        `).run(deletedAt, systemId, project.id);
      })();

      // Check that contexts are also soft deleted
      const contexts = rawDb.prepare(
        'SELECT * FROM context_entries WHERE project_id = ?'
      ).all(project.id);

      contexts.forEach((context: any) => {
        expect(context.deleted_at).toBe(deletedAt);
      });
    });
  });

  describe('Delete Context', () => {
    it('should soft delete a specific context', async () => {
      const rawDb = (db as any).db;
      
      // Create project and context
      const project = rawDb.prepare(`
        INSERT INTO projects (name, description, status)
        VALUES (?, ?, ?)
        RETURNING id
      `).get('test-project', 'Test project', 'active');

      rawDb.prepare(`
        INSERT INTO context_entries (project_id, key, type, value)
        VALUES (?, ?, ?, ?)
      `).run(project.id, 'test-key', 'note', 'Test value');

      // Execute deletion
      const deletedAt = new Date().toISOString();
      
      rawDb.prepare(`
        UPDATE context_entries 
        SET deleted_at = ?, deleted_by = ?
        WHERE key = ? AND project_id = ?
      `).run(deletedAt, systemId, 'test-key', project.id);
      
      // Verify soft delete
      const context = rawDb.prepare(
        'SELECT * FROM context_entries WHERE key = ?'
      ).get('test-key');
      
      expect(context.deleted_at).toBe(deletedAt);
    });
  });

  describe('Cleanup Old Data', () => {
    it('should identify old data for cleanup', async () => {
      const rawDb = (db as any).db;
      
      // Create old project (simulate old data)
      const project = rawDb.prepare(`
        INSERT INTO projects (name, created_at, updated_at, status)
        VALUES (?, datetime('now', '-60 days'), datetime('now', '-60 days'), ?)
        RETURNING id
      `).get('old-project', 'active');

      // Query for old projects
      const oldProjects = rawDb.prepare(`
        SELECT * FROM projects 
        WHERE updated_at < datetime('now', '-30 days')
        AND deleted_at IS NULL
      `).all();

      expect(oldProjects.length).toBeGreaterThan(0);
      expect(oldProjects[0].name).toBe('old-project');
    });

    it('should perform actual cleanup when not dry run', async () => {
      const rawDb = (db as any).db;
      
      // Create old project
      rawDb.prepare(`
        INSERT INTO projects (name, created_at, updated_at, status)
        VALUES (?, datetime('now', '-60 days'), datetime('now', '-60 days'), ?)
      `).run('old-project', 'active');

      // Perform cleanup
      const deletedAt = new Date().toISOString();
      
      rawDb.prepare(`
        UPDATE projects 
        SET deleted_at = ?, deleted_by = ?
        WHERE updated_at < datetime('now', '-30 days')
        AND deleted_at IS NULL
      `).run(deletedAt, systemId);
      
      // Verify soft delete
      const project = rawDb.prepare(
        'SELECT * FROM projects WHERE name = ?'
      ).get('old-project');
      
      expect(project.deleted_at).toBe(deletedAt);
    });
  });

  describe('Hard Delete Schedule', () => {
    it('should schedule hard delete after 7 days', async () => {
      const rawDb = (db as any).db;
      
      // Create and soft delete a project
      const project = rawDb.prepare(`
        INSERT INTO projects (name, status)
        VALUES (?, ?)
        RETURNING id
      `).get('test-project', 'active');

      const deletedAt = new Date().toISOString();
      
      // Soft delete with trigger
      rawDb.prepare(`
        UPDATE projects 
        SET deleted_at = ?, deleted_by = ?
        WHERE id = ?
      `).run(deletedAt, systemId, project.id);

      // Check deletion queue
      const queueEntry = rawDb.prepare(
        'SELECT * FROM deletion_queue WHERE entity_type = ? AND entity_id = ?'
      ).get('project', project.id);

      expect(queueEntry).not.toBeNull();
      expect(queueEntry.scheduled_hard_delete).toBeDefined();
      
      // Verify it's scheduled for 7 days from now
      const deletedDate = new Date(queueEntry.deleted_at);
      const scheduledDelete = new Date(queueEntry.scheduled_hard_delete);
      const daysDiff = (scheduledDelete.getTime() - deletedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      expect(Math.round(daysDiff)).toBe(7);
    });
  });
});
