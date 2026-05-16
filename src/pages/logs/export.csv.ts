import type { APIRoute } from "astro";
import { exportAuditLogsCsv } from "../../utils/logs";

export const GET: APIRoute = async ({ locals, url }) => {
const filters = {
user: url.searchParams.get("user")?.trim() || undefined,
tool: url.searchParams.get("tool")?.trim() || undefined,
from: url.searchParams.get("from")?.trim() || undefined,
to: url.searchParams.get("to")?.trim() || undefined,
};

const csv = await exportAuditLogsCsv(locals.runtime.env.AUDIT_LOGS, filters);

return new Response(csv, {
headers: {
"content-type": "text/csv; charset=utf-8",
"content-disposition": "attachment; filename=logs.csv",
},
});
};
