export type UserStatus = "active" | "disabled";

export interface UserRecord {
email: string;
tools: string[];
scopes: string[];
lastLoginAt: string | null;
status: UserStatus;
updatedAt: string;
}

export interface ListUsersOptions {
cursor?: string;
limit?: number;
emailFilter?: string;
}

export interface ListUsersResult {
users: UserRecord[];
cursor?: string;
}

const USER_KEY_PREFIX = "user:";
const DEFAULT_TOOLS = ["tools/list"];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
return emailRegex.test(normalizeEmail(email));
}

function normalizeStatus(status: unknown): UserStatus {
return status === "disabled" ? "disabled" : "active";
}

function normalizeTools(tools: unknown): string[] {
if (!Array.isArray(tools)) {
return [];
}

return [...new Set(tools.filter((tool): tool is string => typeof tool === "string").map((tool) => tool.trim()).filter(Boolean))];
}

function normalizeScopes(scopes: unknown): string[] {
if (!Array.isArray(scopes)) {
return [];
}

return [...new Set(scopes.filter((scope): scope is string => typeof scope === "string").map((scope) => scope.trim()).filter(Boolean))];
}

function toUserRecord(email: string, value: Partial<UserRecord> | null): UserRecord {
const normalizedEmail = normalizeEmail(email);
return {
email: normalizedEmail,
tools: normalizeTools(value?.tools),
scopes: normalizeScopes(value?.scopes),
lastLoginAt: typeof value?.lastLoginAt === "string" ? value.lastLoginAt : null,
status: normalizeStatus(value?.status),
updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
};
}

function toUserKey(email: string): string {
return `${USER_KEY_PREFIX}${normalizeEmail(email)}`;
}

export function parseToolsInput(value: string): string[] {
return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

export function parseScopesInput(value: string): string[] {
return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

export async function getUser(kv: KVNamespace, email: string): Promise<UserRecord | null> {
const normalizedEmail = normalizeEmail(email);
const value = await kv.get<Partial<UserRecord>>(toUserKey(normalizedEmail), "json");
if (!value) {
return null;
}

return toUserRecord(normalizedEmail, value);
}

export async function upsertUser(
kv: KVNamespace,
params: {
email: string;
tools?: string[];
scopes?: string[];
status?: UserStatus;
lastLoginAt?: string | null;
},
): Promise<UserRecord> {
const normalizedEmail = normalizeEmail(params.email);
const existing = await getUser(kv, normalizedEmail);
const next = toUserRecord(normalizedEmail, {
email: normalizedEmail,
tools: params.tools ?? existing?.tools ?? DEFAULT_TOOLS,
scopes: params.scopes ?? existing?.scopes ?? [],
status: params.status ?? existing?.status ?? "active",
lastLoginAt: params.lastLoginAt ?? existing?.lastLoginAt ?? null,
updatedAt: new Date().toISOString(),
});

await kv.put(toUserKey(normalizedEmail), JSON.stringify(next));
return next;
}

export async function setUserStatus(kv: KVNamespace, email: string, status: UserStatus): Promise<UserRecord | null> {
const existing = await getUser(kv, email);
if (!existing) {
return null;
}

return upsertUser(kv, {
email: existing.email,
tools: existing.tools,
scopes: existing.scopes,
lastLoginAt: existing.lastLoginAt,
status,
});
}

export async function deleteUser(kv: KVNamespace, email: string): Promise<void> {
await kv.delete(toUserKey(email));
}

export async function listUsers(kv: KVNamespace, options: ListUsersOptions = {}): Promise<ListUsersResult> {
const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
const prefix = `${USER_KEY_PREFIX}${options.emailFilter?.trim().toLowerCase() ?? ""}`;
const listResult = await kv.list({
prefix,
limit,
cursor: options.cursor,
});

const users = await Promise.all(
listResult.keys.map(async (item) => {
const email = item.name.slice(USER_KEY_PREFIX.length);
const value = await kv.get<Partial<UserRecord>>(item.name, "json");
return toUserRecord(email, value);
}),
);

users.sort((left, right) => left.email.localeCompare(right.email));

return {
users,
cursor: listResult.list_complete ? undefined : listResult.cursor,
};
}

export async function listAllUsers(kv: KVNamespace): Promise<UserRecord[]> {
const users: UserRecord[] = [];
let cursor: string | undefined;

do {
const page = await listUsers(kv, { cursor, limit: 100 });
users.push(...page.users);
cursor = page.cursor;
} while (cursor);

users.sort((left, right) => left.email.localeCompare(right.email));
return users;
}

export async function updateToolMembership(
kv: KVNamespace,
toolName: string,
enabledUsers: string[],
): Promise<void> {
const normalizedEnabled = new Set(enabledUsers.map(normalizeEmail));
const allUsers = await listAllUsers(kv);

await Promise.all(
allUsers.map(async (user) => {
const hasTool = user.tools.includes(toolName);
const shouldHaveTool = normalizedEnabled.has(user.email);
if (hasTool === shouldHaveTool) {
return;
}

const nextTools = shouldHaveTool
? [...new Set([...user.tools, toolName])]
: user.tools.filter((tool) => tool !== toolName);

await upsertUser(kv, {
email: user.email,
tools: nextTools,
scopes: user.scopes,
status: user.status,
lastLoginAt: user.lastLoginAt,
});
}),
);
}
