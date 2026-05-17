export interface Tool {
  name:       string;
  scope_id:   number;
  scope_name: string;
}

export interface Scope {
  id:   number;
  name: string;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

export async function listAllTools(db: D1Database): Promise<Tool[]> {
  const result = await db
    .prepare(
      `SELECT t.name, t.scope_id, s.name AS scope_name
       FROM tools t
       JOIN scopes s ON s.id = t.scope_id
       ORDER BY s.name ASC, t.name ASC`
    )
    .all<Tool>();
  return result.results;
}

export async function listAllScopes(db: D1Database): Promise<Scope[]> {
  const result = await db
    .prepare("SELECT id, name FROM scopes ORDER BY name ASC")
    .all<Scope>();
  return result.results;
}
