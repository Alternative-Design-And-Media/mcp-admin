import type { APIRoute } from "astro";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "../utils/auth";

export const POST: APIRoute = async ({ cookies, redirect }) => {
	cookies.delete(SESSION_COOKIE_NAME, { path: SESSION_COOKIE_OPTIONS.path });
	return redirect("/login");
};
