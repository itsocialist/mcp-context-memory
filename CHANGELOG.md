# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features
- Docker deployment support for easy installation and hosting
- Web UI for visualization
- Data encryption support
- Performance optimizations
- Role templates marketplace
- Multi-role collaboration features
- Role-specific dashboards
- AI-suggested role switching

## [0.2.1] - 2025-06-21

### Fixed
- **Test Database Isolation** - Fixed test contamination issues
  - Implemented TestDatabaseManager for proper test isolation
  - Each test gets unique temporary database
  - Automatic cleanup prevents data persistence between runs
- **Missing Role Tools** - Added MCP tools for role management
  - `list_roles` - View available roles
  - `get_active_role` - Check current role
  - `switch_role` - Change active role  
  - `create_role_handoff` - Create role transitions
  - `get_role_handoffs` - View handoff history

### Changed
- Import paths fixed for better module resolution
- Tool response formatting improved for consistency
- Error codes standardized across role tools

### Technical
- Test databases now use system temp directory
- Timestamp-based naming for test database uniqueness
- All 148 tests passing with proper isolation

## [0.2.0] - 2025-06-21

### Added
- **Role-Based Context Management** - Major new feature
  - 5 default roles: Software Architect, Developer, DevOps Engineer, QA Engineer, Product Manager
  - Role switching for focused project work
  - Role-specific context filtering
  - Automatic role association for stored contexts
  - Custom role creation with templates
- **Role Handoffs** - Structured transitions between roles
  - Document key decisions and pending tasks
  - Include warnings and blockers
  - Track handoff history
- **6 New MCP Tools**:
  - `list_roles` - View all available roles
  - `get_active_role` - Check current role for a project
  - `switch_role` - Change active role
  - `create_custom_role` - Define custom roles
  - `create_role_handoff` - Create role transitions
  - `get_role_handoffs` - View handoff history
- **Database Migrations** - Automatic schema updates
  - Migration system for smooth upgrades
  - Version tracking in database
  - Backward compatibility maintained
- **Enhanced Testing** - 148 total tests (up from 77)
  - Comprehensive role functionality tests
  - Integration tests updated
  - Backward compatibility tests

### Changed
- Context entries can now have optional role associations
- Search functionality enhanced to filter by role
- Database schema updated with role tables (automatic migration)
- TypeScript types enhanced for role support

### Fixed
- Integration test compatibility with new DatabaseManager API
- Database query performance improvements
- Migration timing issues resolved
- Error message clarity improved

### Technical Details
- 5 new database tables for role support
- Product Manager role added to defaults
- Role template configuration system
- Maintained full backward compatibility

## [0.1.0] - 2024-12-23

### Added
- Initial release of MCP Context Memory Server
- 7 MCP tools for comprehensive context management:
  - `store_project_context` - Create/update project information
  - `store_context` - Store context entries with types and tags
  - `search_context` - Flexible search with time, type, and tag filters
  - `get_project_context` - Retrieve all context for a project
  - `list_projects` - List all projects with status
  - `update_project_status` - Change project lifecycle status
  - `get_recent_updates` - View recent activity across projects
- SQLite database with FTS5 for full-text search
- Multi-system support (tracks different machines)
- 9 context types: decision, code, standard, status, todo, note, config, issue, reference
- Comprehensive audit trail with update history
- TypeScript implementation with full type safety
- Migration system for database schema updates
- 77 tests with comprehensive coverage

### Security
- Path traversal protection with validation
- SQL injection prevention via prepared statements
- JSON schema validation for all inputs
- Safe error messages (no internal details exposed)
- Input sanitization for all text fields

### Technical Details
- Built with @modelcontextprotocol/sdk
- SQLite with WAL mode for better concurrency
- Zod schemas for runtime validation
- Jest test suite with unit and integration tests
- ES modules with Node.js 18+ support

[0.2.1]: https://github.com/briandawson/mcp-context-memory/releases/tag/v0.2.1
[0.2.0]: https://github.com/briandawson/mcp-context-memory/releases/tag/v0.2.0
[0.1.0]: https://github.com/briandawson/mcp-context-memory/releases/tag/v0.1.0
