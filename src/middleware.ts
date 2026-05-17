import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "./utils/auth";

export const onRequest = defineMiddleware(async (context, next) => {
	if (context.url.pathname === "/login") {
		return next();
	}

	const { ADMIN_TOKEN, SESSION_SECRET } = context.locals.runtime.env;
	const adminToken = typeof ADMIN_TOKEN === "string" ? ADMIN_TOKEN : "";
	const sessionSecret = typeof SESSION_SECRET === "string" ? SESSION_SECRET : "";
	const sessionCookie = context.cookies.get(SESSION_COOKIE_NAME)?.value;
	const isValidSession =
		typeof sessionCookie === "string" &&
		(await verifySessionCookie(sessionCookie, adminToken, sessionSecret));

	if (!isValidSession) {
		context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
		return context.redirect("/login");
	}

	return next();
});
