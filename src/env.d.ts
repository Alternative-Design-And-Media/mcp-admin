type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
	ADMIN_TOKEN: string;
	SESSION_SECRET: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}
