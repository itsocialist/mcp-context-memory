# MCP Context Memory Server

A Model Context Protocol (MCP) server that provides persistent context memory for projects across Claude sessions. Never lose track of project decisions, code snippets, standards, or progress again!

## Features

- **Project Management**: Track multiple projects with repository URLs, local directories, and system-specific paths
- **Context Storage**: Store decisions, code snippets, standards, TODOs, and more
- **Multi-System Support**: Automatically detects and tracks which system you're working from
- **Flexible Search**: Search by time, tags, project, or full-text
- **Shared Context**: Store coding standards and conventions that apply across all projects
- **Update History**: Track all changes with automatic timestamps

## Installation

### Via npm (recommended)

```bash
npm install -g @briandawson/mcp-context-memory
```

### From source

```bash
git clone https://github.com/briandawson/mcp-context-memory.git
cd mcp-context-memory
npm install
npm run build
npm link
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
      "command": "mcp-context-memory",
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
```

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

1. **store_project_context** - Create or update project information
2. **store_context** - Store context entries (project-specific or shared)
3. **search_context** - Search with flexible filters
4. **get_project_context** - Get all context for a specific project
5. **list_projects** - List all projects with summaries
6. **update_project_status** - Update project status (active/paused/completed/archived)
7. **get_recent_updates** - See what changed recently

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

### v0.2.0 - Roles & Permissions (Next Release)
- [ ] Role-based access control
- [ ] User/team management
- [ ] Permission levels for different context types
- [ ] Shared team contexts
- [ ] Role inheritance system

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
