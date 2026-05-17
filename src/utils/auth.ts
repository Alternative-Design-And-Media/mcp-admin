const encoder = new TextEncoder();

export const SESSION_COOKIE_NAME = "session";
export const SESSION_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: true,
	sameSite: "strict" as const,
	path: "/",
};

// Fallback secret generated once per Worker instance lifetime.
// Used only when SESSION_SECRET env var is not configured.
// Sessions will be invalidated on Worker restart, which is acceptable
// for a single-admin tool.
let _runtimeSecret: string | null = null;

function getRuntimeSecret(): string {
	if (!_runtimeSecret) {
		const bytes = new Uint8Array(32);
		crypto.getRandomValues(bytes);
		_runtimeSecret = bytesToBase64Url(bytes);
	}
	return _runtimeSecret;
}

function isNonEmpty(value: string | null | undefined): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function toBase64Url(value: string): string {
	return bytesToBase64Url(encoder.encode(value));
}

function timingSafeEqual(left: string, right: string): boolean {
	if (left.length !== right.length) {
		return false;
	}

	let diff = 0;
	for (let i = 0; i < left.length; i++) {
		diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
	}

	return diff === 0;
}

async function sign(payload: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

	return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSessionCookieValue(token: string, secret: string | null | undefined): Promise<string> {
	const effectiveSecret = isNonEmpty(secret) ? secret : getRuntimeSecret();
	const payload = toBase64Url(token);
	const signature = await sign(payload, effectiveSecret);

	return `${payload}.${signature}`;
}

export async function verifySessionCookie(
	sessionCookieValue: string,
	token: string | null | undefined,
	secret: string | null | undefined,
): Promise<boolean> {
	if (!isNonEmpty(token)) {
		return false;
	}

	const effectiveSecret = isNonEmpty(secret) ? secret : getRuntimeSecret();

	const [payload, signature] = sessionCookieValue.split(".");
	if (!payload || !signature) {
		return false;
	}

	const expectedPayload = toBase64Url(token);
	if (!timingSafeEqual(payload, expectedPayload)) {
		return false;
	}

	const expectedSignature = await sign(payload, effectiveSecret);
	return timingSafeEqual(signature, expectedSignature);
}
