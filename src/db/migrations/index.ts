/**
 * Migration index
 * Exports all migrations in order
 */

import { migration001_initial_schema } from './001_initial_schema.js';
import type { Migration } from './migrationManager.js';

export const migrations: Migration[] = [
  migration001_initial_schema,
  // Add new migrations here in order
];
