/**
 * Migration 004: Add soft delete support
 * Adds deleted_at and deleted_by columns for soft delete functionality
 */

import { Database } from 'better-sqlite3';

export const migration_004_soft_delete = {
  version: 5,
  name: 'Add soft delete support',
  
  up: (db: Database) => {
    // Add soft delete columns to projects table
    db.exec(`
      ALTER TABLE projects 
      ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    `);
    
    db.exec(`
      ALTER TABLE projects 
      ADD COLUMN deleted_by INTEGER REFERENCES systems(id) DEFAULT NULL;
    `);
    
    // Add soft delete columns to context_entries table
    db.exec(`
      ALTER TABLE context_entries 
      ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    `);
    
    db.exec(`
      ALTER TABLE context_entries 
      ADD COLUMN deleted_by INTEGER REFERENCES systems(id) DEFAULT NULL;
    `);
    
    // Add soft delete columns to role_handoffs table
    db.exec(`
      ALTER TABLE role_handoffs 
      ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    `);
    
    db.exec(`
      ALTER TABLE role_handoffs 
      ADD COLUMN deleted_by INTEGER REFERENCES systems(id) DEFAULT NULL;
    `);
    
    // Create indexes for efficient soft delete queries
    db.exec(`
      CREATE INDEX idx_projects_deleted 
      ON projects(deleted_at);
    `);
    
    db.exec(`
      CREATE INDEX idx_context_entries_deleted 
      ON context_entries(deleted_at);
    `);
    
    db.exec(`
      CREATE INDEX idx_role_handoffs_deleted 
      ON role_handoffs(deleted_at);
    `);
    
    // Create a cleanup tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS deletion_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('project', 'context')),
        entity_id INTEGER NOT NULL,
        deleted_at TIMESTAMP NOT NULL,
        deleted_by INTEGER REFERENCES systems(id),
        scheduled_hard_delete TIMESTAMP NOT NULL,
        hard_deleted BOOLEAN DEFAULT FALSE,
        UNIQUE(entity_type, entity_id)
      );
    `);
    
    // Create trigger to populate deletion queue
    db.exec(`
      CREATE TRIGGER track_project_deletion
      AFTER UPDATE OF deleted_at ON projects
      WHEN NEW.deleted_at IS NOT NULL
      BEGIN
        INSERT OR REPLACE INTO deletion_queue 
        (entity_type, entity_id, deleted_at, deleted_by, scheduled_hard_delete)
        VALUES 
        ('project', NEW.id, NEW.deleted_at, NEW.deleted_by, 
         datetime(NEW.deleted_at, '+7 days'));
      END;
    `);
    
    db.exec(`
      CREATE TRIGGER track_context_deletion
      AFTER UPDATE OF deleted_at ON context_entries
      WHEN NEW.deleted_at IS NOT NULL
      BEGIN
        INSERT OR REPLACE INTO deletion_queue 
        (entity_type, entity_id, deleted_at, deleted_by, scheduled_hard_delete)
        VALUES 
        ('context', NEW.id, NEW.deleted_at, NEW.deleted_by, 
         datetime(NEW.deleted_at, '+7 days'));
      END;
    `);
  },
  
  down: (db: Database) => {
    // Drop triggers
    db.exec(`DROP TRIGGER IF EXISTS track_project_deletion;`);
    db.exec(`DROP TRIGGER IF EXISTS track_context_deletion;`);
    
    // Drop deletion queue
    db.exec(`DROP TABLE IF EXISTS deletion_queue;`);
    
    // Drop indexes
    db.exec(`DROP INDEX IF EXISTS idx_projects_deleted;`);
    db.exec(`DROP INDEX IF EXISTS idx_context_entries_deleted;`);
    db.exec(`DROP INDEX IF EXISTS idx_role_handoffs_deleted;`);
    
    // Note: Cannot drop columns in SQLite
    // Would need to recreate tables without the columns
  }
};
