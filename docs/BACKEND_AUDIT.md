# Backend Audit & Quality Assurance — Orynthia

**Datum:** 2026-06-10
**Scope:** `packages/backend` (NestJS 10, Prisma 5/PostgreSQL, Passport-JWT, BullMQ/Redis, Anthropic SDK), zzgl. `docker-compose*`, `nginx/`, Dockerfiles
**Methodik:** Statisches Code-Audit aller ~80 Quelldateien über vier parallele Audit-Durchläufe (Auth/Security, Domain-Module A, Domain-Module B inkl. Banking/Chat, Datenschicht/Infra). Alle tragenden Findings wurden anschließend einzeln gegen den Quellcode verifiziert; als nicht haltbar erkannte Verdachtsfälle sind am Ende dokumentiert. Kein Lauf gegen eine echte DB/Bank-API möglich.

**Verifikations-Baseline (alle grün):**

| Check | Ergebnis |
| --- | --- |
| `nest build` (inkl. `prisma generate`) | ✅ |
| `eslint src/**/*.ts` | ✅ 0 Fehler |
| `jest` | ✅ 13/13 Tests (2 Suiten: accounts, budgets) |

---

# Executive Summary

**Gesamtbewertung: 7 / 10**

Das Backend ist solide gebaut: httpOnly-Cookies mit gehashtem, bei jedem Refresh rotiertem Refresh-Token, bcrypt-12 für Passwörter, AES-256-GCM für Banking-Sessions und 2FA-Secrets, Einmal-Reset-Tokens (SHA-256-gehasht, Sessions werden beim Reset invalidiert), globale `ValidationPipe` mit `whitelist`/`forbidNonWhitelisted`, Throttling auf Auth-Endpoints, helmet, Geldbeträge durchgängig als `Decimal` im Schema, Banking-Import in `$transaction`. Kein `any`-Wildwuchs, saubere Modul-Struktur.

**Größte Schwächen**

1. **Autorisierungslücke bei Relations-IDs:** `categoryId` wird bei Budget- und Transaktions-Erstellung nicht auf Ownership geprüft — fremde Kategorie-IDs sind verwendbar (IDOR-Klasse).
2. **Kategorie-Löschung ist kaputt, sobald ein Budget existiert:** Die `Budget→Category`-Relation hat kein `onDelete` (Prisma-Default `Restrict`), der Service bereinigt nur Transaktionen → `category.delete` wirft P2003 → 500er. Zusätzlich Zwei-Schritt-Write ohne `$transaction`.
3. **Sitzungs-Hygiene unvollständig:** Passwortwechsel invalidiert bestehende Refresh-Tokens nicht; Account-Löschung (Hard-Delete-Kaskade über alle Finanzdaten!) verlangt keine Passwort-Bestätigung.
4. **DTO-Validierung lückenhaft:** Beträge ohne `@Min`/`@Max`, Pagination ohne Obergrenze, Strings ohne `@MaxLength`, Enums teils als `@IsString`.
5. **Keine ENV-Schema-Validierung** und ein stiller SHA-256-Fallback für unkonforme `ENCRYPTION_KEY`s (per `console.warn` statt Logger).

**Größte Chancen:** Die Top-Fixes sind klein (Ownership-Checks, `onDelete`-Policy + `$transaction`, `refreshToken: null` beim Passwortwechsel, DTO-Decorators) und beheben die gesamte kritische Schicht in < 1 Tag.

---

# Kritische Findings (Priorität: Hoch)

| # | Bereich | Problem | Auswirkung | Empfehlung |
| --- | --- | --- | --- | --- |
| B1 | Categories/Budgets — `categories.service.ts:61-67`, `schema.prisma:248` | `Budget.category` ohne `onDelete` → Prisma-Default `Restrict`; `remove()` nullt nur Transaktions-Kategorien und löscht dann die Kategorie. Hat die Kategorie ein Budget, wirft `delete` P2003 → unbehandelter 500. Zwei Writes ohne `$transaction` (Transaktionen bereits genullt, Kategorie bleibt). | Nutzer können Kategorien mit Budget faktisch nicht löschen; halbfertige Zustände möglich. | Budgets in `remove()` mitbehandeln (`budget.deleteMany`) und alles in `prisma.$transaction([...])`; alternativ Schema-seitig `onDelete: Cascade` auf der Budget-Relation. **Aufwand: S** |
| B2 | Transactions/Budgets — `transactions.service.ts:18-22`, `budgets.service.ts:49-61` | `categoryId` aus dem DTO wird ungeprüft übernommen — keine Validierung, dass die Kategorie dem User gehört oder System-Kategorie ist (gleiche Lücke bei Budget-Create und Transaction-Update). | IDOR-Klasse: User A kann Daten an Kategorien von User B hängen; Datenintegrität und Mandantentrennung verletzt. | Helper `assertCategoryAccessible(userId, categoryId)` (`findFirst({ id, OR: [{ userId }, { isSystem: true }] })`) vor Create/Update in beiden Services. **Aufwand: S** |
| B3 | Users — `users.service.ts:41-57` | `changePassword()` setzt nur den neuen Hash; der gespeicherte Refresh-Token bleibt gültig (anders als `resetPassword`, das ihn nullt). | Ein Angreifer mit gestohlenem Refresh-Token bleibt nach Passwortwechsel dauerhaft eingeloggt — genau das Szenario, in dem Nutzer das Passwort ändern. | `refreshToken: null` im selben Update setzen (Konsistenz mit `resetPassword:245`). **Aufwand: S (1 Zeile)** |
| B4 | Users — `users.controller.ts:32-35`, `users.service.ts:59-62` | `DELETE /users/account` löscht den User hart inkl. Kaskade über alle Konten/Transaktionen/Budgets — ohne Passwort-Recheck oder 2FA-Challenge, nur mit gültigem Access-Token. | Mit einem einzigen kompromittierten 15-min-Token sind alle Finanzdaten unwiederbringlich weg. | DTO `{ password: string }` verlangen, `bcrypt.compare` vor dem Delete; bei aktiver 2FA zusätzlich Code prüfen. Frontend-Dialog fragt das Passwort bereits nicht ab → zusammen anpassen. **Aufwand: S–M** |
| B5 | Auth — `jwt-refresh.strategy.ts:15` | Refresh-Token wird neben dem httpOnly-Cookie auch aus `req.body.refreshToken` akzeptiert (`ExtractJwt.fromBodyField`). | Unnötige Angriffsfläche: ein per XSS/Log exfiltrierter Token ist ohne Cookie-Kontext wiederverwendbar; unterläuft das Cookie-only-Design. (Rotation selbst ist korrekt implementiert — Hash wird bei jedem Refresh ersetzt.) | Body-Extractor entfernen, nur Cookie-Extraktion behalten. Frontend nutzt ohnehin Cookies. **Aufwand: S** |
| B6 | Config — `app.module.ts:27-30`, `common/crypto/encryption.ts:28-38` | `ConfigModule.forRoot` ohne `validationSchema`; `ENCRYPTION_KEY` mit unkonformer Länge fällt still auf SHA-256(Input) zurück, gemeldet nur per `console.warn`. (Fehlende JWT-Secrets lassen Passport beim Start werfen — das ist ok, aber unleserlich.) | Schwache, vom Operator unbemerkte Schlüsselableitung möglich; Fehlkonfiguration zeigt sich erst spät/unklar. | Joi-`validationSchema` für `DATABASE_URL`, `JWT_SECRET` (min 32), `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `FRONTEND_URL`; in `encryption.ts` `Logger` statt `console.warn`. Hinweis: Der Fallback selbst war eine bewusste Entscheidung (Commit `e536210`) — beibehalten, aber sichtbar loggen und in `.env.example` dokumentieren. **Aufwand: S** |
| B7 | SavingsGoals — `savings-goals.service.ts:76-95` | `addAmount()` ist Read-Modify-Write ohne Atomarität: `currentAmount` wird gelesen, in JS addiert und zurückgeschrieben. | Parallele Einzahlungen (Doppel-Klick + langsames Netz, vgl. Frontend-Finding M1) verlieren Beträge — bei einer Finanz-App inakzeptabel. | Atomares Inkrement: `update({ data: { currentAmount: { increment: amount } } })`, danach Completion-Status anhand des Rückgabewerts setzen; Negativ-Guard via DB-Wert prüfen. **Aufwand: S** |

---

# Mittlere Findings (Priorität: Mittel)

| # | Bereich | Problem | Auswirkung | Empfehlung |
| --- | --- | --- | --- | --- |
| M1 | DTO-Validierung app-weit — u. a. `transaction.dto.ts:12,121-128`, `account.dto.ts:7-12`, `contract.dto.ts:13-25`, `savings-goal.dto.ts`, `recurring-payment.dto.ts` | Beträge ohne `@Min`/`@Max` (±Billionen, `Infinity` bis zur DB-Decimal-Grenze), `limit`/`page` ohne `@Max`/`@Min` (DoS via `limit=10^9`), Namen/IBAN ohne `@MaxLength`, `contractType` als `@IsString` statt `@IsEnum`, Datumsfelder teils `@IsString` statt `@IsDateString`. | Datenqualität, Speicher-DoS, kaputte Aggregationen. | Systematischer DTO-Pass: `@Min/@Max` auf alle Beträge (±999.999.999,99), `@Max(100)` auf `limit`, `@MaxLength` auf alle Strings, `@IsEnum`/`@IsDateString` wo passend. **Aufwand: M** |
| M2 | Budgets — `budgets.service.ts:20-45` | N+1: pro Budget ein eigenes `transaction.aggregate` in `Promise.all`. | Bei n Budgets n+1 Queries; bei privater Nutzung (≤ ~20 Budgets) tolerabel, skaliert aber schlecht. | `groupBy(['categoryId'])` pro Periodenfenster + Map-Lookup. **Aufwand: M** |
| M3 | Auth/2FA — `auth.controller.ts:79-104` | `2fa/enable` und `2fa/disable` haben kein eigenes `@Throttle` — nur der globale Limiter (100/min) greift; Login (mit 2FA-Code) ist mit 5/min ok. | TOTP-Brute-Force auf `enable` theoretisch mit 100 Versuchen/min; praktisch begrenzt, aber unnötig offen. | `@Throttle({ short: { ttl: 60_000, limit: 5 } })` auf beide 2FA-Endpoints. **Aufwand: S** |
| M4 | Auth — `auth.service.ts:223-225` | Ohne SMTP wird der komplette Reset-Link inkl. Klartext-Token per `logger.warn` geloggt (bewusster Self-Hosting-Fallback). | Reset-Token landet in Log-Aggregatoren/Backups. | Verhalten dokumentieren und hinter explizites Flag (`MAIL_FALLBACK_LOG=true`) legen oder nur Token-Suffix loggen. **Aufwand: S** |
| M5 | Schema — `schema.prisma:163` (`Transaction.externalId @unique`), BankAccount ohne `@@unique([userId, iban])` | `externalId` global unique statt pro Konto → Kollisionen zwischen Banken/Konten brechen den Sync; identische IBAN mehrfach anlegbar (Duplikat-Importe). | Banking-Sync-Fehlschläge, doppelte Salden. | Migration: `@@unique([bankAccountId, externalId])`; App-seitige Duplikat-Prüfung für IBAN (Schema-Unique bricht Bestandsdaten ggf.). **Aufwand: M (Migration)** |
| M6 | Chat/KI — `chat.service.ts:29,72,110-276` | Modell-ID `claude-opus-4-7` hardcodiert (gültig, aber nicht konfigurierbar; aktuell empfohlen: `claude-opus-4-8`, Drop-in); kein Usage-Logging/Kostenlimit pro User (nur 15 Req/min global); `buildUserContext` lädt Verträge/Sparziele ohne `take`-Limit. API-Nutzung selbst korrekt (adaptive thinking, `output_config.effort`, `cache_control`) — aber Cache-Minimum auf Opus 4.7 ist 4096 Tokens, der statische Systemprompt liegt vermutlich darunter (Breakpoint dann wirkungslos, kein Fehler). | Betriebsflexibilität, Kostenkontrolle, Prompt-Größe bei Power-Usern. | `ANTHROPIC_MODEL`-Env mit Default `claude-opus-4-8`; `take`-Limits in allen Context-Queries; `usage` (wird bereits zurückgegeben) zumindest loggen. **Aufwand: S–M** |
| M7 | Banking — `banking.service.ts` (autoSync, Account-Import) | Cron-`autoSync` synct alle Konten sequenziell ohne Concurrency-Limit/Backoff; beim Erst-Import wird eine fehlgeschlagene Balance als `0` gespeichert (`balance ?? 0`) statt als unbekannt markiert. | Lange Cron-Läufe; falsche 0-€-Salden bei API-Hickups. | `Promise.allSettled` mit kleinem Concurrency-Limit; Balance bei Fehler `null`/Konto als „pending" kennzeichnen. **Aufwand: M** |
| M8 | Infra — `docker-compose.yml:21,39` | Postgres (5432) und Redis (6379) im Dev-Compose auf `0.0.0.0` gebunden (Prod-Override resettet die Ports korrekt). | Auf einem Homeserver ohne Firewall sind DB/Redis im LAN/Netz erreichbar. | `"127.0.0.1:5432:5432"` / `"127.0.0.1:6379:6379"`. **Aufwand: S** |
| M9 | Health — `health.controller.ts:10-31` | `/ready` prüft nur die DB (`SELECT 1`), nicht Redis (BullMQ/Cron-Abhängigkeit). | Readiness lügt, wenn Redis fehlt. | Redis-`ping` ergänzen (tolerant, wenn Redis optional ist: Status-Feld statt Fail). **Aufwand: S** |
| M10 | Notifications — `transactions.service.ts:41-49` | `maybeNotifyLargeTransaction(...).catch(() => undefined)` schluckt Fehler komplett. | Kaputte Notifications bleiben unbemerkt. | `.catch((err) => this.logger.warn(...))`. **Aufwand: S** |
| M11 | Tests | 2 Suiten/13 Tests (Happy-Path accounts/budgets). Auth-Flows, Ownership-Checks (IDOR!), Refresh-Logik, DTO-Grenzen ungetestet. | Genau die Fehlerklasse aus B1–B4 ist unbewacht. | Mit den Fixes Tests einchecken: Ownership-Reject-Fälle, changePassword-Session-Invalidierung, Kategorie-Löschung mit Budget. **Aufwand: M (inkrementell)** |
| M12 | nginx — `nginx/nginx.conf:32,35` | HSTS (`max-age=31536000`) wird auch über HTTP gesetzt; CSP `connect-src 'self' ws: wss:` erlaubt WebSockets zu beliebigen Hosts. | HSTS-Lock-out bei lokaler HTTP-Nutzung; aufgeweichte CSP. | HSTS nur im HTTPS-Server-Block; `connect-src 'self'`. **Aufwand: S** |

---

# Niedrige Findings (Priorität: Niedrig)

| # | Bereich | Problem | Empfehlung |
| --- | --- | --- | --- |
| L1 | `auth/dto/auth.dto.ts` | `LoginDto.password` ohne `@MinLength(8)` (Register/Reset haben es); keine Komplexitäts-Policy trotz Frontend-Hint „mit Zahlen und Sonderzeichen". | `@MinLength(8)` ergänzen; Policy zwischen Front-/Backend angleichen (eine Quelle der Wahrheit). |
| L2 | `demo-seed/demo-seed.service.ts:5-6` | Demo-Credentials (`demo@orynthia.local`/`demo1234`) im Code; Prod-Guard via `NODE_ENV` vorhanden. | Passwort aus `DEMO_PASSWORD`-Env mit Zufalls-Fallback. |
| L3 | `auth.service.ts:278-290` | Legacy-Klartext-2FA-Secrets werden gelesen, aber nie re-encrypted. | Beim Read transparent verschlüsselt zurückschreiben. |
| L4 | Logout-Semantik | Access-Token bleibt nach Logout bis zu 15 min gültig (stateless JWT, bewusster Trade-off). | Akzeptabel; optional Redis-Blacklist, falls Anforderung entsteht. |
| L5 | `contracts.service.ts:9-84` | `MARKET_AVERAGES` hardcodiert (Stand 2025/2026), veraltet ohne Update-Pfad. | In Config/DB auslagern oder Stichtag im UI ausweisen. |
| L6 | `investments.service.ts` | `round2()` auf Krypto-Werte (8 Nachkommastellen) in Anzeige-Aggregaten; `purchaseDate`-Default via UTC-`toISOString` (±1 Tag je Zeitzone — gleiche Klasse wie Frontend-Finding). | Rundung nur am Präsentationsrand; lokales Datum verwenden. |
| L7 | `docker-compose.yml:108-130` | Prisma Studio (Port 5555, ohne Auth) via `--profile tools` exponierbar. | Doku-Hinweis; nur lokal binden. |
| L8 | `main.ts:42-53` | Swagger via `SWAGGER_ENABLED=true` auch in Prod aktivierbar. | Zusätzlich `NODE_ENV !== 'production'` verlangen. |
| L9 | Dockerfiles | Frontend-nginx läuft als root, keine Healthchecks in den Images; `prisma migrate deploy` bei jedem Container-Start (Race bei >1 Replica — bei Single-Host ok). | Non-Root-User, `HEALTHCHECK`; Migrations bewusst lassen (Self-Host, 1 Replica) und dokumentieren. |
| L10 | `dashboard.service.ts` | Aggregation teils in JS statt DB, `include` ohne `select` (Overfetching) — bei privaten Datenmengen unkritisch. | Bei Bedarf optimieren, kein Sofort-Handlungsbedarf. |

---

# Verworfene Verdachtsfälle (geprüft, nicht haltbar)

Diese Behauptungen aus den Audit-Durchläufen wurden gegen den Code geprüft und **verworfen**:

1. *„Passwort-Reset-Token ist mehrfach nutzbar"* — falsch: Token wird nach Nutzung genullt und alle Sessions invalidiert (`auth.service.ts:239-247`).
2. *„Keine Refresh-Token-Rotation"* — falsch: `generateTokens()` ersetzt den gespeicherten Hash bei jedem Refresh (`auth.service.ts:305-310`); der alte Token ist danach ungültig.
3. *„bcrypt vergleicht `undefined`"* — falsch: die Refresh-Strategy reicht den Token aus Cookie/Body korrekt durch.
4. *„`RecurringPayment→Category` fehlt `onDelete` → Orphans"* — bei optionalen Relationen ist Prismas Default `SetNull`; kein Fehler. (Bei der **Pflicht**-Relation `Budget→Category` ist der Default `Restrict` — dort ist es real, siehe B1.)
5. *„App startet unbemerkt mit fehlendem JWT_SECRET"* — Passport wirft beim Bootstrap; ENV-Validierung (B6) bleibt sinnvoll für klare Fehlermeldungen, ist aber kein stiller Ausfall.

---

# Quick Wins (je ≤ 1 h)

| Maßnahme | Finding |
| --- | --- |
| `refreshToken: null` in `changePassword` | B3 |
| Body-Extractor aus Refresh-Strategy entfernen | B5 |
| Budgets in Kategorie-Löschung + `$transaction` | B1 |
| Ownership-Check-Helper für `categoryId` | B2 |
| Atomic `increment` in `addAmount` | B7 |
| `@Throttle` auf 2FA-Endpoints | M3 |
| `127.0.0.1`-Portbindung im Dev-Compose | M8 |
| Logger statt `console.warn` in `encryption.ts` | B6 (Teil) |
| `.catch` mit Logging statt Silent-Swallow | M10 |
| `@MinLength` auf LoginDto | L1 |

# Roadmap

## Sofort umsetzen
1. B1–B7 (komplette kritische Schicht, < 1 Tag).
2. Quick Wins M3, M8, M10, L1.

## Nächster Sprint
1. M1 DTO-Validierungs-Pass über alle Module.
2. M4 Mail-Fallback-Flag, M6 Chat-Konfigurierbarkeit + Kontext-Limits, M9 Health-Redis-Check, M12 nginx-Header.
3. M5 Schema-Migration (`externalId` pro Konto) — mit Bestandsdaten-Plan.
4. M11 Test-Grundstock für Auth/Ownership.

## Langfristig
1. M2 Budget-Aggregation per `groupBy`, M7 Banking-Sync-Parallelisierung.
2. Account-Delete als Soft-Delete/Grace-Period (DSGVO-Export vor Löschung).
3. Chat-Usage-Tracking pro User; L2–L9 nach Gelegenheit.

---

*Alle Findings referenzieren Datei und Zeile auf Stand des Branches `claude/determined-fermi-8l09ai`. Siehe auch `docs/FRONTEND_AUDIT.md` für das Frontend-Gegenstück; mehrere Findings korrespondieren (Doppel-Submit ↔ B7, Passwort-Policy ↔ L1, Account-Delete-Dialog ↔ B4).*
