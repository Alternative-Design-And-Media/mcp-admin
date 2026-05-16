type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
ADMIN_TOKEN: string;
SESSION_SECRET: string;
USERS_KV: KVNamespace;
AUDIT_LOGS: R2Bucket;
MCP_SERVER_URL?: string;
MCP_SERVER_TOKEN?: string;
}

declare namespace App {
interface Locals extends Runtime {}
}
