const encoder = new TextEncoder();

export const SESSION_COOKIE_NAME = "session";
export const SESSION_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: true,
	sameSite: "strict" as const,
	path: "/",
};

function isNonEmpty(value: string): boolean {
	return value.trim().length > 0;
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

export async function createSessionCookieValue(token: string, secret: string): Promise<string> {
	if (!isNonEmpty(secret)) {
		throw new Error("SESSION_SECRET must be a non-empty string.");
	}

	const payload = toBase64Url(token);
	const signature = await sign(payload, secret);

	return `${payload}.${signature}`;
}

export async function verifySessionCookie(
	sessionCookieValue: string,
	token: string,
	secret: string,
): Promise<boolean> {
	if (!isNonEmpty(token) || !isNonEmpty(secret)) {
		return false;
	}

	const [payload, signature] = sessionCookieValue.split(".");
	if (!payload || !signature) {
		return false;
	}

	const expectedPayload = toBase64Url(token);
	if (!timingSafeEqual(payload, expectedPayload)) {
		return false;
	}

	const expectedSignature = await sign(payload, secret);
	return timingSafeEqual(signature, expectedSignature);
}
