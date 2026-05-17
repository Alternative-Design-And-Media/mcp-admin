# mcp-admin

Admin dashboard az **adam-mcp** MCP szerver kezeléséhez. Astro 5 (SSR) + Cloudflare Workers alapú webalkalmazás.

## Funkciók

- 📊 **Dashboard** – KPI kártyák (napi hívások, tiltott hívások, aktív felhasználók, leghívottabb tool), 30 napos trendiagram, top 10 tool, top 5 felhasználó, legutóbbi események
- 📋 **Audit logok** – D1-alapú auditnapló-böngésző szűrőkkel (felhasználó, tool, dátumtartomány, állapot), lapozással és CSV exporttal
- 👥 **Felhasználók** – Felhasználók listázása, létrehozása, aktiválása/letiltása, scope-jogosultságok kezelése
- 📁 **Handoverek** – R2-alapú handover-fájl böngésző prefix szűrővel, lapozással és letöltéssel
- 🔧 **Toolok** – MCP tool-regiszter böngésző scope-információkkal
- 🔐 **Hitelesítés** – Token-alapú bejelentkezés, HMAC-aláírt HttpOnly session cookie, middleware-védelem

## Cloudflare erőforrások

| Binding      | Típus | Neve                  |
| :----------- | :---- | :-------------------- |
| `DATABASE`   | D1    | `adam-mcp`            |
| `AUDIT_LOGS` | R2    | `adam-mcp-audit-log`  |
| `HANDOVERS`  | R2    | `adam-mcp-handovers`  |

## Adatbázis séma (D1)

```
users              (id, email, display_name, is_active, created_at, last_login)
scopes             (id, name)                          — pl. rentman.equipment.read, odoo.read
tools              (name PK, scope_id FK)              — MCP tool → scope leképezés
user_scope_perms   (user_id FK, scope_id FK)           — scope-engedély felhasználónként
audit_logs         (id, ts, user_id FK, tool_name, allowed, request_id)
```

Az aktuális séma és seed adatok: [`migrations/0001_initial_schema.sql`](migrations/0001_initial_schema.sql)

## 🔐 Hitelesítési titkok

Az admin útvonalakat token-alapú hitelesítés védi. Ezeket Worker-titkokként kell beállítani, soha ne kerüljenek a forráskódba:

- `ADMIN_TOKEN` – bejelentkezési token (`/login`)
- `SESSION_SECRET` – HMAC aláírókulcs a `HttpOnly` session cookie-hoz

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put SESSION_SECRET
```

## 🧞 Parancsok

| Parancs                           | Művelet                                                     |
| :-------------------------------- | :---------------------------------------------------------- |
| `npm install`                     | Függőségek telepítése                                       |
| `npm run dev`                     | Fejlesztői szerver indítása (`localhost:4321`)              |
| `npm run build`                   | Produkciós build (`./dist/`)                                |
| `npm run preview`                 | Build előnézete Wrangler dev szerverrel                     |
| `npm run check`                   | Teljes ellenőrzés: astro build + tsc + wrangler dry-run     |
| `npm run deploy`                  | Deploy Cloudflare Workers-re                                |
| `npm run cf-typegen`              | Cloudflare típusdefiníciók generálása                       |

## 🗂 Projekt struktúra

```
src/
├── components/
│   ├── AdminLayout.astro     # Fő layout (Header + Footer + slot)
│   ├── BaseHead.astro        # HTML <head> meta tagek
│   ├── Header.astro          # Navigációs sáv
│   └── Footer.astro
├── pages/
│   ├── index.astro           # Dashboard
│   ├── login.astro           # Bejelentkezési oldal
│   ├── logout.ts             # POST → session törlés
│   ├── logs/
│   │   ├── index.astro       # Audit log lista + szűrők
│   │   ├── [id].astro        # Egyedi log bejegyzés
│   │   └── export.csv.ts     # CSV export endpoint
│   ├── users/
│   │   ├── index.astro       # Felhasználók listája + létrehozás
│   │   ├── [email].astro     # Felhasználó részletei + jogosultságok
│   │   └── import.astro      # Tömeges import
│   ├── handovers/
│   │   ├── index.astro       # Handover-fájlok listája
│   │   └── download.ts       # R2 fájl letöltés
│   └── tools/
│       ├── index.astro       # Tool-lista
│       └── [name].astro      # Tool részletei
├── utils/
│   ├── auth.ts               # Session cookie kezelés (HMAC-SHA256)
│   ├── audit.ts              # D1 audit log lekérdezések + dashboard statisztikák
│   ├── users.ts              # D1 felhasználó és scope-jogosultság kezelés
│   ├── logs.ts               # R2 audit log olvasás (legacy)
│   └── tools.ts              # D1 tool és scope lekérdezések
├── middleware.ts             # Session-ellenőrzés minden útvonalra
└── consts.ts                 # SITE_TITLE, SITE_DESCRIPTION
migrations/
└── 0001_initial_schema.sql   # Teljes séma + seed adatok
wrangler.json                 # Cloudflare Worker konfiguráció
```

## Útvonalak

| Útvonal             | Leírás                                      |
| :------------------ | :------------------------------------------ |
| `GET /`             | Dashboard (KPI, trendek, top listák)        |
| `GET /login`        | Bejelentkezési űrlap                        |
| `POST /login`       | Token ellenőrzés, session beállítás         |
| `POST /logout`      | Session törlés, átirányítás `/login`-ra     |
| `GET /logs`         | Audit log lista (szűrők, lapozás)           |
| `GET /logs/[id]`    | Egyedi audit log bejegyzés                  |
| `GET /logs/export.csv` | Szűrt audit logok CSV exportja           |
| `GET /users`        | Felhasználók listája                        |
| `POST /users`       | Új felhasználó létrehozása                  |
| `GET /users/[email]` | Felhasználó részletei + scope-jogosultságok |
| `POST /users/[email]` | Aktiválás/letiltás, jogosultság-módosítás  |
| `GET /handovers`    | Handover-fájlok böngészője                  |
| `GET /handovers/download` | R2 fájl letöltése                     |
| `GET /tools`        | MCP tool-regiszter listája                  |
| `GET /tools/[name]` | Tool részletei                              |
