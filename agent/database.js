import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseManager {
  constructor(dbPath = './agent_memory.db') {
    // Resolve absolute path
    const absolutePath = dbPath.startsWith('/')
      ? dbPath
      : join(__dirname, dbPath);

    this.db = new Database(absolutePath);
    this.db.pragma('journal_mode = WAL'); // Better performance

    this.initializeTables();
  }

  initializeTables() {
    // Create memories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        memory_type TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 1,
        embedding TEXT
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_type
      ON memories(agent_id, memory_type);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_timestamp
      ON memories(timestamp);
    `);

    // Create goals table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        goal_type TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        priority INTEGER DEFAULT 5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        metadata TEXT
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_status
      ON goals(agent_id, status);
    `);

    // Create explored_locations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS explored_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        tile_type TEXT,
        resources TEXT,
        visit_count INTEGER DEFAULT 1,
        first_visited DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_visited DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agent_id, x, y)
      );
    `);

    // Create interactions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        interaction_type TEXT NOT NULL,
        location_x INTEGER,
        location_y INTEGER,
        result TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_type_interactions
      ON interactions(agent_id, interaction_type);
    `);

    // Create tools table (for automated behavior system)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,

        steps TEXT NOT NULL,
        preconditions TEXT,
        expected_outcome TEXT,

        success_rate REAL DEFAULT 1.0,
        usage_count INTEGER DEFAULT 0,

        version TEXT DEFAULT '1.0.0',
        status TEXT DEFAULT 'active',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        last_modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(agent_id, name)
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tools_agent_category
      ON tools(agent_id, category, status);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tools_success_rate
      ON tools(success_rate DESC);
    `);

    // Create tool_executions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tool_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        tool_id INTEGER NOT NULL,

        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        duration_ms INTEGER,

        status TEXT,

        initial_state TEXT,
        final_state TEXT,
        error_message TEXT,
        recovery_action TEXT,

        api_calls_saved INTEGER DEFAULT 0,

        FOREIGN KEY (tool_id) REFERENCES tools(id)
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_executions_agent_time
      ON tool_executions(agent_id, start_time DESC);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_executions_tool
      ON tool_executions(tool_id, status);
    `);

    // Create execution_steps table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS execution_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_id INTEGER NOT NULL,
        step_index INTEGER NOT NULL,

        step_type TEXT NOT NULL,
        step_description TEXT,

        status TEXT,
        result_data TEXT,
        error_message TEXT,

        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,

        FOREIGN KEY (execution_id) REFERENCES tool_executions(id)
      );
    `);

    // Create behavior_patterns table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS behavior_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,

        pattern_data TEXT NOT NULL,
        tool_definition TEXT,

        frequency INTEGER,
        confidence REAL,
        category TEXT,

        status TEXT DEFAULT 'pending_review',
        converted_tool_id INTEGER,

        discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME,

        FOREIGN KEY (converted_tool_id) REFERENCES tools(id)
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_patterns_agent_status
      ON behavior_patterns(agent_id, status);
    `);

    // Create tool_proposals table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tool_proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,

        proposal_data TEXT NOT NULL,

        status TEXT DEFAULT 'pending',
        approved_by TEXT,
        rejection_reason TEXT,

        proposed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME,

        created_tool_id INTEGER,

        FOREIGN KEY (created_tool_id) REFERENCES tools(id)
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_proposals_agent_status
      ON tool_proposals(agent_id, status);
    `);

    console.log('✓ Database tables initialized successfully');
  }

  // Wrapper methods for common operations
  run(sql, params = []) {
    return this.db.prepare(sql).run(params);
  }

  get(sql, params = []) {
    return this.db.prepare(sql).get(params);
  }

  all(sql, params = []) {
    return this.db.prepare(sql).all(params);
  }

  // Transaction support
  transaction(fn) {
    return this.db.transaction(fn);
  }

  // Close database connection
  close() {
    this.db.close();
  }

  // Get database instance for advanced operations
  getDB() {
    return this.db;
  }
}

export default DatabaseManager;
