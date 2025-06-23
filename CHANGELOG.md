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

## [0.3.1] - 2025-06-23

### Added
- **Deletion Tools** - Three new tools for data management
  - `delete_project` - Permanently delete projects and all associated data
  - `delete_context` - Delete specific context entries
  - `cleanup_old_data` - Batch delete old data with dry-run preview

### Changed
- Switched from soft delete to hard delete for simplicity and reliability
- Deletion operations now permanently remove data immediately
- All deletion tools require explicit confirmation

### Fixed
- Fixed MCP tool connection issues by using factory pattern
- Fixed FTS5 search index deletion queries
- Improved error handling for deletion operations

### Technical Notes
- Removed soft delete migration and complexity
- Deletion tools now receive database instance from MCP server
- Updated FTS5 queries to use correct column names (entity_id, not project_name)

## [0.3.0] - 2025-06-21

### Added
- **Custom Roles Feature** - Create your own roles beyond the 5 defaults
  - `create_custom_role` - Create custom roles with unique focus areas
  - `delete_custom_role` - Remove custom roles you created
  - `import_role_template` - Import role templates from JSON
  - Role validation and sanitization for security
  - Base role inheritance (extend existing roles)
  - System-specific role tracking
- **Enhanced Role Management**