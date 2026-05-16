export interface ToolInfo {
name: string;
description: string;
inputSchema: unknown;
}

function normalizeTool(tool: Partial<ToolInfo>): ToolInfo | null {
if (typeof tool.name !== "string" || !tool.name.trim()) {
return null;
}

return {
name: tool.name.trim(),
description: typeof tool.description === "string" ? tool.description : "",
inputSchema: tool.inputSchema ?? null,
};
}

function extractTools(payload: unknown): ToolInfo[] {
if (Array.isArray(payload)) {
return payload.map((item) => normalizeTool(item as Partial<ToolInfo>)).filter((item): item is ToolInfo => item !== null);
}

if (!payload || typeof payload !== "object") {
return [];
}

const objectPayload = payload as { tools?: unknown; result?: unknown };
if (objectPayload.tools) {
return extractTools(objectPayload.tools);
}

if (objectPayload.result) {
return extractTools(objectPayload.result);
}

return [];
}

async function parseResponse(response: Response): Promise<ToolInfo[]> {
if (!response.ok) {
return [];
}

let parsed: unknown;
try {
parsed = await response.json();
} catch {
return [];
}

return extractTools(parsed);
}

export async function fetchToolsFromMcp(env: Env): Promise<ToolInfo[]> {
const baseUrl = env.MCP_SERVER_URL?.trim();
if (!baseUrl) {
return [];
}

const normalizedUrl = baseUrl.replace(/\/$/, "");
const headers = new Headers({
"content-type": "application/json",
});
if (env.MCP_SERVER_TOKEN) {
headers.set("authorization", `Bearer ${env.MCP_SERVER_TOKEN}`);
}

const postResponse = await fetch(`${normalizedUrl}/tools/list`, {
method: "POST",
headers,
body: JSON.stringify({
jsonrpc: "2.0",
id: "mcp-admin",
method: "tools/list",
params: {},
}),
});
const fromPost = await parseResponse(postResponse);
if (fromPost.length > 0) {
return fromPost.sort((left, right) => left.name.localeCompare(right.name));
}

const getResponse = await fetch(`${normalizedUrl}/tools/list`, {
method: "GET",
headers,
});
const fromGet = await parseResponse(getResponse);
return fromGet.sort((left, right) => left.name.localeCompare(right.name));
}
