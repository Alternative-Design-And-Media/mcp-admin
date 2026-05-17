export interface User {
  email: string;
  display_name: string | null;
  is_active: number;
  created_at: string;
  last_login: string | null;
}

export interface UserToolPermission {
  tool_name: string;
  granted_at: string;
}

export interface UserWithEmail {
  email: string;
  display_name: string | null;
  granted_at: string;
}

/**
 * Derives a stable user identifier from an email address.
 * szanto.benedek@adamgroup.hu -> szanto.benedek
 */
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

/**
 * Builds a log file name for R2 storage.
 * e.g. szanto.benedek-audit-2026-05-17T15-28-00-000Z.json
 */
export function buildUserLogFileName(
  email: string,
  suffix = "audit",
  timestamp = new Date().toISOString()
): string {
  const userId = getUserIdFromEmail(email);
  const safeTimestamp = timestamp.replace(/[:.]/g, "-");
  return `${userId}-${suffix}-${safeTimestamp}.json`;
}

export async function listAllUsers(db: D1Database): Promise<User[]> {
  const result = await db
    .prepare(
      "SELECT email, display_name, is_active, created_at, last_login FROM users ORDER BY email ASC"
    )
    .all<User>();
  return result.results;
}

export async function getUserWithPermissions(
  db: D1Database,
  email: string
): Promise<{ user: User | null; permissions: UserToolPermission[] }> {
  const [userResult, permResult] = await Promise.all([
    db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<User>(),
    db
      .prepare(
        "SELECT tool_name, granted_at FROM user_tool_permissions WHERE email = ? ORDER BY tool_name ASC"
      )
      .bind(email)
      .all<UserToolPermission>(),
  ]);
  return { user: userResult ?? null, permissions: permResult.results };
}

export async function grantToolPermission(
  db: D1Database,
  email: string,
  toolName: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_tool_permissions (email, tool_name)
       VALUES (?, ?)
       ON CONFLICT(email, tool_name) DO NOTHING`
    )
    .bind(email, toolName)
    .run();
}

export async function revokeToolPermission(
  db: D1Database,
  email: string,
  toolName: string
): Promise<void> {
  await db
    .prepare(
      "DELETE FROM user_tool_permissions WHERE email = ? AND tool_name = ?"
    )
    .bind(email, toolName)
    .run();
}

export async function listUsersWithToolPermission(
  db: D1Database,
  toolName: string
): Promise<UserWithEmail[]> {
  const result = await db
    .prepare(
      `SELECT u.email, u.display_name, p.granted_at
       FROM user_tool_permissions p
       JOIN users u ON u.email = p.email
       WHERE p.tool_name = ?
       ORDER BY u.email ASC`
    )
    .bind(toolName)
    .all<UserWithEmail>();
  return result.results;
}

export async function createUser(
  db: D1Database,
  email: string,
  displayName: string | null
): Promise<{ success: boolean; error?: string }> {
  const existing = await db
    .prepare("SELECT email FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) {
    return { success: false, error: "Ez az email cím már létezik." };
  }
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
