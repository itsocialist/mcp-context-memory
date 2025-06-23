# MCP Context Memory Server

A Model Context Protocol (MCP) server that provides persistent context memory for projects across Claude sessions. Never lose track of project decisions, code snippets, standards, or progress again!

## ✨ New in v0.3.1: Deletion Tools & Performance

Clean up your context memory with three new deletion tools! Remove old projects, outdated contexts, or perform time-based cleanup with safety features like dry-run preview and confirmation requirements.

## ✨ v0.3.0: Custom Roles

Create your own specialized roles beyond the 5 defaults! Define custom roles for Security Engineers, Technical Writers, Data Engineers, or any role specific to your team's needs.

## ✨ v0.2.0: Role-Based Context Management

Claude can adopt different roles (Architect, Developer, DevOps, QA, Product Manager) to provide focused assistance based on the current phase of your project.

## Features

- **Project Management**: Track multiple projects with repository URLs, local directories, and system-specific paths
- **Context Storage**: Store decisions, code snippets, standards, TODOs, and more
- **🎭 Role-Based Features**: Switch between different roles for focused assistance
- **🎨 Custom Roles** (v0.3.0): Create specialized roles beyond the 5 defaults
- **🧹 Deletion Tools** (v0.3.1): Clean up projects and contexts with safety features
- **Multi-System Support**: Automatically detects and tracks which system you're working from
- **Flexible Search**: Search by time, tags, project, role, or full-text
- **Shared Context**: Store coding standards and conventions that apply across all projects
- **Update History**: Track all changes with automatic timestamps
- **Role Handoffs**: Create structured handoffs between roles with key context
- **Performance Optimized**: Handles large context stores without memory issues

## Installation

### From Source (Currently Required)

Since npm publication is pending, install via git:

```bash
git clone https://github.com/itsocialist/mcp-context-memory.git
cd mcp-context-memory
npm install
npm run build
```

### Via npm (coming soon)

```bash
# npm install -g @briandawson/mcp-context-memory
```

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "context-memory": {
      "command": "node",
      "args": ["/path/to/mcp-context-memory/dist/index.js"],
      "env": {
        "MCP_CONTEXT_DB_PATH": "~/Documents/mcp-context.db"
      }
    }
  }
}
```

The `MCP_CONTEXT_DB_PATH` environment variable is optional. If not set, the database will be stored at `~/.mcp-context-memory/context.db`.

## Usage

Once configured, Claude can use these tools to manage your project context:

### Project Management

```
Claude: "Create a new project called 'my-app' with repository https://github.com/user/my-app"
Claude: "The project 'my-app' is located at ~/Development/my-app"
Claude: "List all my projects"
Claude: "Mark project 'my-app' as completed"
```

### Role Management

```
Claude: "List available roles"
Claude: "Switch to architect role for project 'my-app'"
Claude: "What's my current role for 'my-app'?"
Claude: "Create a handoff from architect to developer role"
```

### Custom Roles (New in v0.3.0)

```
Claude: "Create a custom role called 'security-engineer' focused on security and threat modeling"
Claude: "Import the technical writer role template"
Claude: "Delete the custom role 'old-role'"
Claude: "Show me available role templates"
```

You can create custom roles with specific focus areas, default tags, and preferred context types. See `examples/role-templates/` for pre-built templates including:
- Security Engineer
- Technical Writer
- Data Engineer
- Platform Engineer
- Frontend Engineer
- Machine Learning Engineer

### Storing Context

```
Claude: "Remember this decision for project 'my-app': We chose PostgreSQL for better JSON support"
Claude: "Store this coding standard: Always use TypeScript strict mode"
Claude: "This is system-specific for 'my-app': Database runs on port 5432"
```

### Searching and Retrieving

```
Claude: "What was updated yesterday?"
Claude: "Show me everything about project 'my-app'"
Claude: "Find all decisions tagged with 'database'"
Claude: "What are our coding standards?"
Claude: "Show me architect decisions for 'my-app'"
```

### Data Management (New in v0.3.1)

```
Claude: "Delete project 'old-prototype' with confirmation"
Claude: "Remove context entry 'outdated-api-docs' from project 'my-app'"
Claude: "Show me what data would be deleted if I clean up items older than 30 days"
Claude: "Delete all contexts not updated in the last 6 months"
```

## Default Roles

The system includes five default roles, each with specialized focus areas:

### 🏗️ Software Architect
- **Focus**: System design, architecture decisions, technical standards
- **Context Types**: decisions, standards, references
- **Tags**: architecture, design, decision

### 💻 Software Developer
- **Focus**: Implementation, code patterns, debugging, features
- **Context Types**: code, todo, issue, note
- **Tags**: implementation, code, feature

### 🚀 DevOps Engineer
- **Focus**: Deployment, infrastructure, monitoring, CI/CD
- **Context Types**: config, status, issue, decision
- **Tags**: deployment, infrastructure, operations

### 🧪 QA Engineer
- **Focus**: Testing, quality, bugs, test plans
- **Context Types**: issue, todo, standard, note
- **Tags**: testing, quality, bug

### 📋 Product Manager
- **Focus**: Requirements, user stories, priorities, roadmap
- **Context Types**: decision, todo, reference, note
- **Tags**: product, requirement, priority

## Context Types

The server supports these context types:

- **decision**: Architectural or design decisions
- **code**: Code snippets or examples
- **standard**: Coding standards or conventions
- **status**: Project status updates
- **todo**: Tasks or action items
- **note**: General notes
- **config**: Configuration details
- **issue**: Known issues or bugs
- **reference**: External references or links

## Tools Available

### Core Tools
1. **store_project_context** - Create or update project information
2. **store_context** - Store context entries (project-specific or shared)
3. **search_context** - Search with flexible filters
4. **get_project_context** - Get all context for a specific project
5. **list_projects** - List all projects with summaries
6. **update_project_status** - Update project status (active/paused/completed/archived)
7. **get_recent_updates** - See what changed recently

### Role Tools
8. **list_roles** - List all available roles (default and custom)
9. **get_active_role** - Get the currently active role for a project
10. **switch_role** - Switch to a different role for focused work
11. **create_role_handoff** - Create a handoff between roles
12. **get_role_handoffs** - View handoff history for a project

### Custom Role Tools (v0.3.0)
13. **create_custom_role** - Create a new custom role with specific focus areas
14. **delete_custom_role** - Remove a custom role you created
15. **import_role_template** - Import a role template from JSON

### Deletion Tools (v0.3.1)
16. **delete_project** - Permanently delete a project and all associated data (requires confirmation)
17. **delete_context** - Delete specific context entries from a project
18. **cleanup_old_data** - Clean up data older than a specified time period (with dry-run preview)

## Creating Custom Roles

Custom roles allow you to define specialized roles beyond the 5 defaults. Each custom role can:
- Inherit from a base role (architect, developer, devops, qa, product)
- Define specific focus areas
- Set default tags for automatic tagging
- Specify preferred context types

### Example: Create a Security Engineer Role

```json
{
  "tool": "create_custom_role",
  "arguments": {
    "id": "security-engineer",
    "name": "Security Engineer",
    "description": "Focuses on security architecture and threat modeling",
    "base_role_id": "architect",
    "focus_areas": ["security", "threats", "compliance", "vulnerabilities"],
    "default_tags": ["security", "threat-model"],
    "preferred_context_types": ["issue", "decision", "standard"]
  }
}
```

### Using Role Templates

Pre-built templates are available in `examples/role-templates/`. Import them using:

```json
{
  "tool": "import_role_template",
  "arguments": {
    "template_json": "<paste template content here>"
  }
}
```

## Database Location

By default, the SQLite database is stored at:
- **macOS/Linux**: `~/.mcp-context-memory/context.db`
- **Windows**: `%USERPROFILE%\.mcp-context-memory\context.db`

You can override this with the `MCP_CONTEXT_DB_PATH` environment variable.

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Running locally

```bash
npm run dev
```

## Architecture

- **TypeScript** for type safety
- **SQLite** for reliable local storage
- **FTS5** for full-text search capabilities
- **Multi-system tracking** for cross-machine development
- **Modular design** for easy extension

## Security

- All data is stored locally on your machine
- No network requests or external dependencies
- Prepared statements prevent SQL injection
- File-based authentication planned for v2

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Author

Brian Dawson

## Roadmap

### ✅ v0.3.1 - Deletion Tools (Released!)
- [x] Delete projects with all associated data
- [x] Delete specific context entries
- [x] Time-based cleanup with dry-run preview
- [x] Performance optimizations for large datasets
- [x] Fixed FTS5 search functionality
- [x] Improved error handling

### ✅ v0.3.0 - Custom Roles (Released!)
- [x] Create custom roles beyond the 5 defaults
- [x] Delete custom roles (system-specific)
- [x] Import role templates from JSON
- [x] Role template examples
- [x] Enhanced security for role creation
- [x] Backward compatibility maintained

### ✅ v0.2.0 - Roles & Permissions (Released!)
- [x] Role-based context management
- [x] Default roles (Architect, Developer, DevOps, QA, Product Manager)
- [x] Role switching and active role tracking
- [x] Role-specific context filtering
- [x] Structured role handoffs
- [x] Backward compatibility maintained

### Docker Deployment Support
- [ ] Docker image for easy deployment
- [ ] Docker Hub publication for `docker pull` access
- [ ] Enable non-technical users to run locally via Docker Desktop
- [ ] Support for hosted MCP server deployment in containers
- [ ] Docker Compose configuration for quick setup
- [ ] Environment variable configuration
- [ ] Persistent volume mapping for database storage

### Future Enhancements
- [ ] Vector embeddings for semantic search
- [ ] Import/export functionality
- [ ] Backup and restore commands
- [ ] Project templates
- [ ] Time tracking integration
- [ ] Git commit integration
- [ ] Web UI for visualization
- [ ] Data encryption support
- [ ] Performance optimizations with caching
