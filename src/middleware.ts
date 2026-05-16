import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "./utils/auth";

export const onRequest = defineMiddleware(async (context, next) => {
	if (context.url.pathname === "/login") {
		return next();
	}

	const { ADMIN_TOKEN, SESSION_SECRET } = context.locals.runtime.env;
	const sessionCookie = context.cookies.get(SESSION_COOKIE_NAME)?.value;
	const isValidSession =
		typeof sessionCookie === "string" &&
		(await verifySessionCookie(sessionCookie, ADMIN_TOKEN, SESSION_SECRET));

	if (!isValidSession) {
		context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
		return context.redirect("/login");
	}

	return next();
});
