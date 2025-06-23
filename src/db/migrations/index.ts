/**
 * Migration index
 * Exports all migrations in order
 */

import { migration001_initial_schema } from './001_initial_schema.js';
import { migration_002_roles } from './002_roles.js';
import { migration_003_custom_roles } from './003_custom_roles.js';
import { migration_004_soft_delete } from './004_soft_delete.js';
import type { Migration } from './migrationManager.js';

export const migrations: Migration[] = [
  migration001_initial_schema,
  migration_002_roles,
  migration_003_custom_roles,
  migration_004_soft_delete,
  // Add new migrations here in order
];
