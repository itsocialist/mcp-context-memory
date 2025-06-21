/**
 * Migration index
 * Exports all migrations in order
 */

import { migration001_initial_schema } from './001_initial_schema.js';
import { migration_002_roles } from './002_roles.js';
import type { Migration } from './migrationManager.js';

export const migrations: Migration[] = [
  migration001_initial_schema,
  migration_002_roles,
  // Add new migrations here in order
];
