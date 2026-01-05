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
