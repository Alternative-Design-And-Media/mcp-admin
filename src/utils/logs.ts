export interface AuditLogEntry {
id: string;
key: string;
timestamp: string;
userEmail: string;
tool: string;
success: boolean;
requestSummary: string;
requestPayload: unknown;
responsePayload: unknown;
}

export interface LogFilters {
user?: string;
tool?: string;
from?: string;
to?: string;
}

export interface ListAuditLogsResult {
logs: AuditLogEntry[];
nextCursor?: string;
}

function parseDate(value: string | undefined): Date | null {
if (!value) {
return null;
}

const parsed = new Date(value);
return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinDateRange(timestamp: string, filters: LogFilters): boolean {
const current = parseDate(timestamp);
if (!current) {
return false;
}

const from = parseDate(filters.from);
if (from && current < from) {
return false;
}

const to = parseDate(filters.to);
if (to && current > to) {
return false;
}

return true;
}

function toBoolean(value: unknown): boolean {
if (typeof value === "boolean") {
return value;
}

if (typeof value === "string") {
return ["true", "1", "ok", "success"].includes(value.toLowerCase());
}

if (typeof value === "number") {
return value > 0;
}

return false;
}

function summaryFromPayload(payload: unknown): string {
try {
const asString = JSON.stringify(payload);
if (!asString) {
return "";
}

return asString.length > 180 ? `${asString.slice(0, 177)}...` : asString;
} catch {
return "";
}
}

function parseLog(key: string, uploaded: Date, payload: unknown): AuditLogEntry {
const objectPayload = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
const timestampValue =
typeof objectPayload.timestamp === "string"
? objectPayload.timestamp
: typeof objectPayload.time === "string"
? objectPayload.time
: uploaded.toISOString();

const userEmail =
typeof objectPayload.userEmail === "string"
? objectPayload.userEmail
: typeof objectPayload.email === "string"
? objectPayload.email
: typeof objectPayload.user === "object" && objectPayload.user && typeof (objectPayload.user as Record<string, unknown>).email === "string"
? ((objectPayload.user as Record<string, unknown>).email as string)
: "";

const tool =
typeof objectPayload.tool === "string"
? objectPayload.tool
: typeof objectPayload.toolName === "string"
? objectPayload.toolName
: "";

const success =
"success" in objectPayload
? toBoolean(objectPayload.success)
: !("error" in objectPayload && objectPayload.error != null);

const requestPayload = objectPayload.requestPayload ?? objectPayload.request ?? null;
const responsePayload = objectPayload.responsePayload ?? objectPayload.response ?? objectPayload.result ?? objectPayload.error ?? null;
const requestSummary =
typeof objectPayload.requestSummary === "string"
? objectPayload.requestSummary
: typeof objectPayload.summary === "string"
? objectPayload.summary
: summaryFromPayload(requestPayload);

return {
id: encodeURIComponent(key),
key,
timestamp: timestampValue,
userEmail,
tool,
success,
requestSummary,
requestPayload,
responsePayload,
};
}

async function readLog(bucket: R2Bucket, key: string, uploaded: Date): Promise<AuditLogEntry | null> {
const objectBody = await bucket.get(key);
if (!objectBody) {
return null;
}

let parsedPayload: unknown;
try {
parsedPayload = await objectBody.json();
} catch {
try {
const text = await objectBody.text();
parsedPayload = { requestSummary: text };
} catch {
return null;
}
}

return parseLog(key, uploaded, parsedPayload);
}

function matchesFilters(log: AuditLogEntry, filters: LogFilters): boolean {
if (filters.user && !log.userEmail.toLowerCase().includes(filters.user.toLowerCase())) {
return false;
}

if (filters.tool && !log.tool.toLowerCase().includes(filters.tool.toLowerCase())) {
return false;
}

if (!isWithinDateRange(log.timestamp, filters)) {
return false;
}

return true;
}

export async function listAuditLogs(
bucket: R2Bucket,
filters: LogFilters,
options: { cursor?: string; limit?: number } = {},
): Promise<ListAuditLogsResult> {
const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
const listed = await bucket.list({ cursor: options.cursor, limit });
const logs = (
await Promise.all(listed.objects.map((object) => readLog(bucket, object.key, object.uploaded)))
).filter((entry): entry is AuditLogEntry => entry !== null && matchesFilters(entry, filters));

logs.sort((left, right) => right.timestamp.localeCompare(left.timestamp));

return {
logs,
nextCursor: listed.truncated ? listed.cursor : undefined,
};
}

export async function getAuditLog(bucket: R2Bucket, key: string): Promise<AuditLogEntry | null> {
const objectBody = await bucket.get(key);
if (!objectBody) {
return null;
}

let payload: unknown;
try {
payload = await objectBody.json();
} catch {
payload = { requestSummary: await objectBody.text() };
}

return parseLog(key, objectBody.uploaded, payload);
}

function escapeCsv(value: string): string {
const escaped = value.replaceAll('"', '""');
return `"${escaped}"`;
}

export async function exportAuditLogsCsv(bucket: R2Bucket, filters: LogFilters): Promise<string> {
const rows = ["timestamp,userEmail,tool,success,requestSummary,key"];
let cursor: string | undefined;
let scannedPages = 0;

do {
const page = await listAuditLogs(bucket, filters, { cursor, limit: 100 });
for (const log of page.logs) {
rows.push(
[
escapeCsv(log.timestamp),
escapeCsv(log.userEmail),
escapeCsv(log.tool),
escapeCsv(log.success ? "success" : "error"),
escapeCsv(log.requestSummary),
escapeCsv(log.key),
].join(","),
);
}

cursor = page.nextCursor;
scannedPages += 1;
} while (cursor && scannedPages < 20);

return `${rows.join("\n")}\n`;
}
