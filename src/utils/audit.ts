// D1-alapú audit log helper
// A writeAuditLog()-t az adam-mcp Worker hívja a saját D1 binding-jával.
// A listAuditLogsD1 / getAuditLogD1 a mcp-admin Admin UI-ja használja.

export interface AuditLogRow {
  id: number;
  ts: string;
  user_id: number | null;
  tool_name: string;
  allowed: boolean;
  request_id: string | null;
  // join-olt mezők (csak olvasáskor)
  user_email?: string;
  user_display_name?: string;
}

export interface AuditLogFilters {
  /** Pontos e-mail cím (registered user); "__unknown__" = null user_id szűrés */
  user_email?: string;
  /** Ismeretlen (null user_id) szőrés – ha true, user_email figyelmen kívül marad */
  user_unknown?: boolean;
  tool_name?: string;
  allowed?: boolean;
  from?: string;
  to?: string;
}

export interface ListAuditLogsD1Result {
  logs: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Írás (adam-mcp Worker hívja) ───────────────────────────────────────────

export interface WriteAuditLogParams {
  /** D1 users.id – ha ismert, egyébként null */
  user_id: number | null;
  tool_name: string;
  allowed: boolean;
  request_id?: string | null;
}

export async function writeAuditLog(
  db: D1Database,
  params: WriteAuditLogParams,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_logs (user_id, tool_name, allowed, request_id)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(
      params.user_id ?? null,
      params.tool_name,
      params.allowed ? 1 : 0,
      params.request_id ?? null,
    )
    .run();
}

// ─── Olvasás (Admin UI) ──────────────────────────────────────────────────────

/**
 * Visszaadja az audit_logs-ban szereplő distinct tool neveket ABC sorrendben.
 * A tool szűrő dropdown feltöltéséhez.
 */
export async function listAuditToolsD1(db: D1Database): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT tool_name FROM audit_logs ORDER BY tool_name ASC`,
    )
    .all<{ tool_name: string }>();
  return (rows.results ?? []).map((r) => r.tool_name);
}

/**
 * Visszaadja a regisztrált felhasználókat (id, email, display_name) ABC sorrendben.
 * A Felhasználó szűrő dropdown feltöltéséhez.
 */
export interface AuditUserOption {
  id: number;
  email: string;
  display_name: string | null;
}

export async function listAuditUsersD1(db: D1Database): Promise<AuditUserOption[]> {
  const rows = await db
    .prepare(
      `SELECT id, email, display_name FROM users ORDER BY email ASC`,
    )
    .all<AuditUserOption>();
  return rows.results ?? [];
}

/**
 * CET/CEST időzónában értelmezett datetime-local string ("YYYY-MM-DDTHH:MM")
 * UTC ISO8601-re alakítása a D1 ts oszlop szűréséhez.
 */
export function localInputToUtc(localStr: string): string {
  const date = new Date(localStr + ":00Z");
  const year = date.getUTCFullYear();
  const dstStart = lastSundayOfMonth(year, 2);
  const dstEnd   = lastSundayOfMonth(year, 9);
  const offsetHours = date >= dstStart && date < dstEnd ? 2 : 1;
  return new Date(date.getTime() - offsetHours * 3600_000).toISOString();
}

function lastSundayOfMonth(year: number, month: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const dayOfWeek = lastDay.getUTCDay();
  lastDay.setUTCDate(lastDay.getUTCDate() - dayOfWeek);
  lastDay.setUTCHours(1, 0, 0, 0);
  return lastDay;
}

export async function listAuditLogsD1(
  db: D1Database,
  filters: AuditLogFilters = {},
  page = 1,
  pageSize = 50,
): Promise<ListAuditLogsD1Result> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];
  let idx = 1;

  if (filters.user_unknown) {
    // Ismeretlen: null user_id (nem regisztrált vagy nem azonosított)
    conditions.push(`a.user_id IS NULL`);
  } else if (filters.user_email) {
    // Pontos egyezés – dropdown-ból jön
    conditions.push(`u.email = ?${idx++}`);
    bindings.push(filters.user_email);
  }

  if (filters.tool_name) {
    conditions.push(`a.tool_name = ?${idx++}`);
    bindings.push(filters.tool_name);
  }
  if (filters.allowed !== undefined) {
    conditions.push(`a.allowed = ?${idx++}`);
    bindings.push(filters.allowed ? 1 : 0);
  }
  if (filters.from) {
    conditions.push(`a.ts >= ?${idx++}`);
    bindings.push(localInputToUtc(filters.from));
  }
  if (filters.to) {
    conditions.push(`a.ts <= ?${idx++}`);
    bindings.push(localInputToUtc(filters.to));
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;

  const countRow = await db
    .prepare(
      `SELECT COUNT(*) as cnt
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}`,
    )
    .bind(...bindings)
    .first<{ cnt: number }>();

  const rows = await db
    .prepare(
      `SELECT a.id, a.ts, a.user_id, a.tool_name, a.allowed, a.request_id,
              u.email  AS user_email,
              u.display_name AS user_display_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.ts DESC
       LIMIT ?${idx} OFFSET ?${idx + 1}`,
    )
    .bind(...bindings, pageSize, offset)
    .all<AuditLogRow>();

  return {
    logs: (rows.results ?? []).map((r) => ({
      ...r,
      allowed: Boolean(r.allowed),
    })),
    total: countRow?.cnt ?? 0,
    page,
    pageSize,
  };
}

export async function getAuditLogD1(
  db: D1Database,
  id: number,
): Promise<AuditLogRow | null> {
  const row = await db
    .prepare(
      `SELECT a.id, a.ts, a.user_id, a.tool_name, a.allowed, a.request_id,
              u.email AS user_email,
              u.display_name AS user_display_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.id = ?1`,
    )
    .bind(id)
    .first<AuditLogRow>();
  if (!row) return null;
  return { ...row, allowed: Boolean(row.allowed) };
}
