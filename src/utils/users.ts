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

export async function listAllUsers(db: D1Database): Promise<User[]> {
  const result = await db.prepare(
    "SELECT email, display_name, is_active, created_at, last_login FROM users ORDER BY email ASC"
  ).all<User>();
  return result.results;
}

export async function getUserWithPermissions(
  db: D1Database,
  email: string
): Promise<{ user: User | null; permissions: UserToolPermission[] }> {
  const [userResult, permResult] = await Promise.all([
    db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<User>(),
    db.prepare("SELECT tool_name, granted_at FROM user_tool_permissions WHERE email = ? ORDER BY tool_name ASC").bind(email).all<UserToolPermission>(),
  ]);
  return { user: userResult ?? null, permissions: permResult.results };
}

export async function createUser(
  db: D1Database,
  email: string,
  displayName: string | null
): Promise<{ success: boolean; error?: string }> {
  const existing = await db.prepare("SELECT email FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    return { success: false, error: "Ez az email cím már létezik." };
  }
  await db.prepare(
    "INSERT INTO users (email, display_name) VALUES (?, ?)"
  ).bind(email, displayName || null).run();
  return { success: true };
}

export async function setUserActive(db: D1Database, email: string, active: boolean): Promise<void> {
  await db.prepare("UPDATE users SET is_active = ? WHERE email = ?")
    .bind(active ? 1 : 0, email)
    .run();
}

export async function upsertUser(db: D1Database, email: string, displayName?: string): Promise<void> {
  await db.prepare(
    `INSERT INTO users (email, display_name, last_login)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(email) DO UPDATE SET last_login = datetime('now')`
  ).bind(email, displayName ?? null).run();
}
