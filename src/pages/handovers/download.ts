import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url, locals }) => {
  const r2: R2Bucket = (locals.runtime.env as Record<string, R2Bucket>).HANDOVERS;
  const key = url.searchParams.get("key");

  if (!key) {
    return new Response("Hiányzó key paraméter.", { status: 400 });
  }

  const object = await r2.get(key);
  if (!object) {
    return new Response(`Nem található: ${key}`, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  // Ha nincs Content-Type, application/octet-stream fallback
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/octet-stream");
  }

  // JSON és szöveg fájlokat böngészőben nyissuk meg, többit letöltésre kínáljuk
  const ct = headers.get("content-type") ?? "";
  const isViewable = ct.includes("json") || ct.includes("text") || ct.includes("html");
  if (!isViewable) {
    const filename = key.split("/").pop() ?? "file";
    headers.set("content-disposition", `attachment; filename="${filename}"`);
  }

  return new Response(object.body, { headers });
};
