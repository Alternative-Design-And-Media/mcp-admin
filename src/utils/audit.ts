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
  user_email?: string;
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

export async function listAuditLogsD1(
  db: D1Database,
  filters: AuditLogFilters = {},
  page = 1,
  pageSize = 50,
): Promise<ListAuditLogsD1Result> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];
  let idx = 1;

  if (filters.user_email) {
    conditions.push(`u.email LIKE ?${idx++}`);
    bindings.push(`%${filters.user_email}%`);
  }
  if (filters.tool_name) {
    conditions.push(`a.tool_name LIKE ?${idx++}`);
    bindings.push(`%${filters.tool_name}%`);
  }
  if (filters.allowed !== undefined) {
    conditions.push(`a.allowed = ?${idx++}`);
    bindings.push(filters.allowed ? 1 : 0);
  }
  if (filters.from) {
    conditions.push(`a.ts >= ?${idx++}`);
    bindings.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`a.ts <= ?${idx++}`);
    bindings.push(filters.to);
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
