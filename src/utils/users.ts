export interface User {
  id:           number;
  email:        string;
  display_name: string | null;
  is_active:    number;
  created_at:   string;
  last_login:   string | null;
}

export interface Scope {
  id:   number;
  name: string;
}

export interface UserScopePermission {
  scope_id:   number;
  scope_name: string;
  granted_at: string;
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export async function getUserByEmail(
  db: D1Database,
  email: string
): Promise<User | null> {
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<User>();
}

export async function listAllUsers(db: D1Database): Promise<User[]> {
  const result = await db
    .prepare(
      "SELECT id, email, display_name, is_active, created_at, last_login FROM users ORDER BY email ASC"
    )
    .all<User>();
  return result.results;
}

export async function getUserWithPermissions(
  db: D1Database,
  email: string
): Promise<{ user: User | null; permissions: UserScopePermission[] }> {
  const user = await getUserByEmail(db, email);
  if (!user) return { user: null, permissions: [] };

  const permResult = await db
    .prepare(
      `SELECT usp.scope_id, s.name AS scope_name, usp.granted_at
       FROM user_scope_permissions usp
       JOIN scopes s ON s.id = usp.scope_id
       WHERE usp.user_id = ?
       ORDER BY s.name ASC`
    )
    .bind(user.id)
    .all<UserScopePermission>();

  return { user, permissions: permResult.results };
}

// ---------------------------------------------------------------------------
// User writes
// ---------------------------------------------------------------------------

export async function upsertUser(
  db: D1Database,
  email: string,
  displayName?: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (email, display_name, last_login)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(email) DO UPDATE SET last_login = datetime('now')`
    )
    .bind(email, displayName ?? null)
    .run();
}

export async function createUser(
  db: D1Database,
  email: string,
  displayName: string | null
): Promise<{ success: boolean; error?: string }> {
  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) return { success: false, error: "Ez az email cím már létezik." };

  await db
    .prepare("INSERT INTO users (email, display_name) VALUES (?, ?)")
    .bind(email, displayName || null)
    .run();
  return { success: true };
}

export async function setUserActive(
  db: D1Database,
  email: string,
  active: boolean
): Promise<void> {
  await db
    .prepare("UPDATE users SET is_active = ? WHERE email = ?")
    .bind(active ? 1 : 0, email)
    .run();
}

export async function updateDisplayName(
  db: D1Database,
  email: string,
  displayName: string | null
): Promise<void> {
  await db
    .prepare("UPDATE users SET display_name = ? WHERE email = ?")
    .bind(displayName || null, email)
    .run();
}

// ---------------------------------------------------------------------------
// Scope permission writes
// ---------------------------------------------------------------------------

export async function grantScopePermission(
  db: D1Database,
  userId: number,
  scopeId: number
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_scope_permissions (user_id, scope_id)
       VALUES (?, ?)
       ON CONFLICT(user_id, scope_id) DO NOTHING`
    )
    .bind(userId, scopeId)
    .run();
}

export async function revokeScopePermission(
  db: D1Database,
  userId: number,
  scopeId: number
): Promise<void> {
  await db
    .prepare(
      "DELETE FROM user_scope_permissions WHERE user_id = ? AND scope_id = ?"
    )
    .bind(userId, scopeId)
    .run();
}

// ---------------------------------------------------------------------------
// Legacy helpers (kept for backward compat, remove when no longer needed)
// ---------------------------------------------------------------------------

/** @deprecated Use getUserByEmail instead */
export function getUserIdFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const localPart = normalized.split("@")[0] ?? normalized;
  return localPart
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/-{2,}/g, "-")
    .replace(/^[_\-.]+|[_\-.]+$/g, "");
}

/** @deprecated Use R2 path builder in logs.ts */
export function buildUserLogFileName(
  email: string,
  suffix = "audit",
  timestamp = new Date().toISOString()
): string {
  const userId = getUserIdFromEmail(email);
  const safeTimestamp = timestamp.replace(/[:.]/g, "-");
  return `${userId}-${suffix}-${safeTimestamp}.json`;
}
