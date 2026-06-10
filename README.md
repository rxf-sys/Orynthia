# Orynthia - Persönliche Finanzverwaltung

Eine Self-Hosted Web-App zur persönlichen Finanzverwaltung mit Open Banking (PSD2), automatischer Kategorisierung, Budgets, Vertragsmanagement, Sparziele und Dashboard-Analysen.

## Tech-Stack

| Bereich | Technologien |
|---------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Query, Zustand, Recharts |
| **Backend** | Node.js 20, NestJS, REST API, Passport.js, JWT |
| **Datenbank** | PostgreSQL 16, Prisma ORM, Redis 7 |
| **Banking** | Enable Banking API (PSD2), kostenlos für private Nutzung |
| **Deployment** | Docker Compose, NGINX Reverse Proxy |
| **Auth** | JWT Access/Refresh Tokens, bcrypt, TOTP 2FA |

## Schnellstart (Docker)

### 1. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

Öffne `.env` und setze sichere Werte für:
- `JWT_SECRET` und `JWT_REFRESH_SECRET` (jeweils min. 32 Zeichen)
- `ENCRYPTION_KEY` (64 Hex-Zeichen für AES-256, generieren: `openssl rand -hex 32`)
- `POSTGRES_PASSWORD` und `REDIS_PASSWORD`
- `ENABLE_BANKING_APP_ID` und `ENABLE_BANKING_PRIVATE_KEY` (für Bankanbindung)

> Das Backend **validiert die Pflicht-Variablen beim Start** (`DATABASE_URL`,
> `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`) und bricht mit einer
> klaren Fehlermeldung ab, wenn etwas fehlt oder zu kurz ist. Die vollständige
> Referenz aller Variablen steht unten unter [Umgebungsvariablen](#umgebungsvariablen).

### 2. Development starten

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/api/docs |

### 3. Datenbank

Beim Container-Start läuft automatisch `prisma migrate deploy` — die Tabellen werden aus
`packages/backend/prisma/migrations/` erstellt. System-Kategorien (15 Defaults wie
"Lebensmittel", "Miete & Wohnen", …) werden beim ersten App-Boot idempotent über
`CategoriesService.onModuleInit` angelegt; ein manueller Seed-Aufruf ist nicht nötig.

### 4. Demo-Daten (optional)

Für Tests und Demonstration kannst du einen kompletten Demo-User mit realistischen Daten
beim Boot anlegen lassen. In `.env`:

```env
SEED_DEMO_USER=true
```

Dann Container neu starten. Bei jedem Boot mit gesetzter Flag wird der Demo-User samt
aller Daten **frisch erzeugt** (vorherige Demo-Daten werden gelöscht).

**Login:**
- **E-Mail:** `demo@orynthia.local`
- **Passwort:** `demo1234` (überschreibbar via `DEMO_PASSWORD` in `.env`)

> Der Demo-Seed ist bei `NODE_ENV=production` **hart blockiert** — bekannte
> Zugangsdaten landen damit nie in einer Live-Datenbank.

**Was enthalten ist:**
- 3 Konten: Girokonto (+3.847 €), Tagesgeld (+12.500 €), KFZ-Kredit (-8.200 €)
- ~60 Transaktionen über die letzten 3 Monate
- 6 Budgets (Lebensmittel, Restaurant, Transport, Shopping, Freizeit, Abos)
- 3 Sparziele (Urlaub, Notgroschen ✓, E-Bike)
- 4 Verträge (Haftpflicht, Netflix, Spotify, Mobilfunk)
- 4 wiederkehrende Zahlungen (Miete, Netflix, Spotify, Fitness)

> Setze `SEED_DEMO_USER=false` (oder entferne die Variable) wieder, sobald du deine
> echten Daten anlegst — sonst werden Test-Änderungen am Demo-User beim nächsten
> Container-Start überschrieben.

## Produktion (Proxmox / Homeserver)

### Produktions-Checkliste

Vor dem ersten produktiven Start einmal durchgehen:

- [ ] `.env` aus `.env.example` erstellt, **alle** `CHANGE_ME`-Werte ersetzt
      (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `POSTGRES_PASSWORD`,
      `REDIS_PASSWORD`) — die App verweigert den Start bei fehlenden Secrets
- [ ] `NODE_ENV=production`
- [ ] `SEED_DEMO_USER=false` (in Production ohnehin blockiert)
- [ ] `SWAGGER_ENABLED=false` (in Production ohnehin deaktiviert)
- [ ] `MAIL_FALLBACK_LOG=false` — Reset-Links inkl. Token gehören nicht in Logs
- [ ] `FRONTEND_URL` auf die echte öffentliche URL gesetzt (CORS + Banking-Redirect)
- [ ] Bei HTTPS: `COOKIE_SECURE=true` und HSTS im NGINX-HTTPS-Block aktivieren
      (siehe unten); ohne HTTPS bleibt `COOKIE_SECURE=false`
- [ ] SMTP konfiguriert, sonst funktioniert "Passwort vergessen" nicht
      (alternativ bewusst `MAIL_FALLBACK_LOG=true` für Einzel-Setups ohne Log-Aggregation)
- [ ] Backups eingerichtet (siehe unten)

### Build & Start

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Die App ist dann über NGINX auf **Port 80** erreichbar. Datenbank-Migrationen
laufen beim Backend-Start automatisch (`prisma migrate deploy`); Postgres,
Redis und Prisma Studio sind in Production **nicht** nach außen exponiert
(im Dev-Compose nur auf `127.0.0.1` gebunden).

**Healthchecks:** Beide Images bringen Docker-`HEALTHCHECK`s mit; zusätzlich
gibt es `GET /api/health` (Liveness) und `GET /api/ready` (DB-Probe, plus
Redis-Status sofern `REDIS_URL` gesetzt ist) für externes Monitoring.
Das Backend läuft im Container als unprivilegierter `node`-User.

### Backups

Alle Daten liegen im Postgres-Volume. Tägliches Dump-Backup, z. B. per Cron:

```bash
docker exec orynthia-postgres pg_dump -U orynthia orynthia \
  | gzip > /backup/orynthia-$(date +%F).sql.gz
```

Wiederherstellen:

```bash
gunzip -c /backup/orynthia-2026-06-10.sql.gz \
  | docker exec -i orynthia-postgres psql -U orynthia orynthia
```

> Zusätzlich die `.env` sichern — **ohne `ENCRYPTION_KEY` sind Banking-Verbindungen
> und 2FA-Secrets aus einem DB-Backup nicht wiederherstellbar.**

### Updates einspielen

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Neue Migrationen werden beim Start automatisch angewendet. Der Service Worker
des Frontends lädt HTML network-first — Nutzer bekommen nach einem Deploy beim
nächsten Aufruf automatisch die neue Version (kein Cache-Leeren nötig).

### Datenbank-UI (optional)

Für visuellen Zugriff auf die Datenbank gibt es einen optionalen Prisma-Studio-Container.
Er ist über das Compose-Profil `tools` aktivierbar und läuft nicht im Standard-Stack mit:

```bash
docker compose --profile tools up -d prisma-studio
# Web-UI: http://localhost:5555
```

Anhalten:
```bash
docker compose stop prisma-studio
```

Prisma Studio zeigt alle Tabellen (Users, BankAccounts, Transactions, Budgets, …),
erlaubt Filtern, Sortieren und Editieren von Datensätzen. Der Container braucht keine
Dev-Dependencies des Backends — er lädt das Prisma-CLI selbstständig beim Start.

### SSL/HTTPS einrichten (empfohlen für Produktion)

1. SSL-Zertifikat beschaffen (z.B. Let's Encrypt mit Certbot)
2. In `nginx/nginx.conf` den HTTPS-Block einkommentieren und die
   Zertifikat-Pfade anpassen
3. Im HTTPS-Block die auskommentierte HSTS-Zeile
   (`Strict-Transport-Security`) aktivieren — sie gehört bewusst **nur** in
   den HTTPS-Block (Browser ignorieren HSTS über HTTP)
4. Port 443 in `docker-compose.prod.yml` freigeben
5. `COOKIE_SECURE=true` in `.env` setzen

## Umgebungsvariablen

Vollständige Vorlage mit Kommentaren: [`.env.example`](.env.example).

| Variable | Pflicht | Zweck |
|----------|---------|-------|
| `DATABASE_URL`, `POSTGRES_*` | ✅ | PostgreSQL-Verbindung (beim Start validiert) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | ✅ | Token-Signierung, je min. 32 Zeichen (validiert) |
| `ENCRYPTION_KEY` | ✅ | AES-256-GCM für 2FA-Secrets & Banking-Sessions, 64 Hex-Zeichen |
| `REDIS_PASSWORD` | ✅ | Redis-Absicherung im Compose-Stack |
| `FRONTEND_URL` | ✅ (Prod) | CORS-Origin + Banking-Redirect + Reset-Links |
| `NODE_ENV`, `APP_PORT` | – | Laufzeitumgebung (Default: `production` / `3000`) |
| `COOKIE_SECURE` | – | `true` bei HTTPS-Deployments |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | – | Token-Lebensdauern (Default: `15m` / `7d`) |
| `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_PRIVATE_KEY` | – | Open Banking (PSD2); ohne sie nur manuelle Konten |
| `ANTHROPIC_API_KEY` | – | Aktiviert den KI-Assistenten |
| `ANTHROPIC_MODEL` | – | Claude-Modell (Default: `claude-opus-4-8`) |
| `CHAT_DAILY_TOKEN_LIMIT` | – | Tages-Token-Budget pro User für den Assistenten (0 = unbegrenzt) |
| `SMTP_HOST/PORT/USER/PASSWORD/FROM` | – | E-Mail-Versand (Passwort-Reset) |
| `MAIL_FALLBACK_LOG` | – | Ohne SMTP: Reset-Link ins Log schreiben (Default `false`) |
| `REDIS_URL` | – | Wenn gesetzt, prüft `/api/ready` zusätzlich Redis |
| `SEED_DEMO_USER`, `DEMO_PASSWORD` | – | Demo-Daten beim Boot (nur außerhalb von Production) |
| `SWAGGER_ENABLED` | – | API-Doku unter `/api/docs` (nur außerhalb von Production) |

## Projektstruktur

```
Orynthia/
├── docker-compose.yml          # Development
├── docker-compose.prod.yml     # Production Overrides
├── .env.example                # Umgebungsvariablen-Vorlage
├── nginx/nginx.conf            # Reverse Proxy
├── packages/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # Datenbankschema
│   │   │   ├── migrations/            # Versionierte SQL-Migrationen (migrate deploy)
│   │   │   └── seed.ts                # Optionale Demo-Daten
│   │   └── src/
│   │       ├── auth/           # JWT, 2FA, Login/Register
│   │       ├── users/          # Profilverwaltung
│   │       ├── accounts/       # Bankkonten
│   │       ├── banking/        # Enable Banking API (PSD2)
│   │       ├── transactions/   # Buchungen, Kategorisierung, CSV-Export
│   │       ├── categories/     # Kategorien-System
│   │       ├── budgets/        # Budget-Tracking
│   │       ├── recurring-payments/ # Wiederkehrende Zahlungen
│   │       ├── savings-goals/  # Sparziele
│   │       ├── contracts/      # Vertragsmanagement & Anbietervergleich
│   │       ├── investments/    # Depot-Positionen
│   │       ├── notifications/  # Benachrichtigungen (Inbox + Cron-Trigger)
│   │       ├── chat/           # KI-Assistent (Anthropic)
│   │       ├── dashboard/      # Aggregierte Übersicht + Forecast
│   │       ├── health/         # Liveness/Readiness-Endpoints
│   │       ├── config/         # ENV-Validierung beim Bootstrap
│   │       └── demo-seed/      # Demo-Daten (nur Nicht-Production)
│   └── frontend/
│       └── src/
│           ├── pages/          # Dashboard, Transaktionen, Budgets, etc.
│           ├── components/     # Layout, Sidebar, Header, CommandPalette (⌘K)
│           │   └── ui/         # Btn, Card, Modal, Field, ConfirmDialog, …
│           ├── stores/         # Zustand: Auth, Theme
│           └── lib/            # API Client, Types, Utilities
└── docs/
    ├── FRONTEND_AUDIT.md       # Frontend-Audit inkl. Umsetzungsstatus
    └── BACKEND_AUDIT.md        # Backend-Audit inkl. Umsetzungsstatus
```

## Features

### Finanzen
- Open Banking (PSD2) via Enable Banking - automatischer Kontoabgleich
- Automatische Transaktionskategorisierung (Keyword-basiert, inkl. System-Kategorien)
- Multi-Konto-Verwaltung (Giro, Spar, Kreditkarte, Depot, Kredit/Darlehen, Sonstiges)
- Manuelle Konten editierbar (Bankname, Saldo, Typ, IBAN); Bank-synchronisierte
  Konten bleiben sync/delete-only
- Transaktionen vollständig editierbar (Betrag, Datum, Typ, Empfänger, Verwendungszweck,
  Kategorie, Notizen)
- Budget-Tracking mit Fortschrittsanzeige, Warnungen und Status-Filter
  (Alle / Überzogen / Knapp / Im Plan)
- Sortierung & Filter in der Kontenübersicht (Saldo, Name, Typ)
- Dashboard mit Diagrammen (Balken, Torte, Trends) und Liquiditäts-Forecast
  (30/60/90 Tage, basiert auf wiederkehrenden Zahlungen, Verträgen und Tages-Median)
- Sparpotenzial-Analyse: Fixkosten, Abo-Übersicht, Anbieterwechsel-Tipps,
  Kategorien mit überdurchschnittlichen Ausgaben
- Wertpapier-/Depot-Tracking: manuelle Positionen (Aktien, ETFs, Krypto, Fonds, Anleihen),
  Gewinn-/Verlust-Berechnung, Allokation, Kurs-Update per Klick
- CSV-Export (Excel-kompatibel mit BOM und deutschem Zahlenformat)

### Verträge & Abos
- Vertragsmanagement mit manueller Erfassung
- Auto-Erkennung von Verträgen aus Transaktionsmustern
- Monatliche/jährliche Kostenübersicht
- Anbietervergleich für Versicherungen und Energieanbieter (Check24, Verivox)
- Kündigungsfristen und automatische Verlängerung im Blick

### Sparen & Planung
- Sparziele mit Fortschrittsbalken
- Wiederkehrende Zahlungen verwalten (mit Erinnerungen vor Fälligkeit)
- Einnahmen/Ausgaben-Übersicht

### Benachrichtigungen (automatisch)
- Bell-Icon im Header mit Inbox + Badge für ungelesene Einträge
- Live: ungewöhnlich hohe Buchungen (> 200 € und > 2× Median der letzten 90 Tage)
- Cron (täglich 08:00): Budget-Warnungen (≥ 80 %) und -Überzüge (≥ 100 %),
  bald fällige wiederkehrende Zahlungen
- Alle 6 h: Banking-Auto-Sync, mit SYNC_ERROR-Notification bei Fehlern
- Alle Trigger sind idempotent (dedupeKey) – keine doppelten Benachrichtigungen
- Benachrichtigungs-Einstellungen pro User serverseitig persistiert
  (Settings → Benachrichtigungen, überleben Reload und Gerätewechsel)

### KI-Assistent (Beta)
- Chat-Oberfläche unter /assistant, beantwortet Fragen zu Konten, Ausgaben,
  Budgets, Verträgen, Sparzielen anhand deiner echten Daten
- Modell konfigurierbar via `ANTHROPIC_MODEL` (Default: Claude Opus 4.8),
  mit adaptive thinking + Prompt-Caching
- Kostenkontrolle: Token-Usage wird pro Anfrage geloggt; optionales
  Tages-Budget pro User via `CHAT_DAILY_TOKEN_LIMIT`
- Aktiviert sich, sobald `ANTHROPIC_API_KEY` in der .env gesetzt ist
  (Key holen: https://console.anthropic.com)

### Sicherheit
- JWT-Authentifizierung mit Refresh-Token-Rotation (Hash bcrypt in DB),
  Refresh ausschließlich über httpOnly-Cookie
- Passwortwechsel und Passwort-Reset invalidieren bestehende Sessions;
  Konto-Löschung erfordert Passwort-Bestätigung
- Zwei-Faktor-Authentifizierung (TOTP), Secret AES-256-GCM verschlüsselt at rest
- Banking-Session-IDs (Enable Banking) AES-256-GCM verschlüsselt at rest
- Ownership-Checks auf allen Ressourcen-Relationen (kein Zugriff auf fremde
  Kategorien/Konten, auch nicht über Relations-IDs)
- Strikte DTO-Validierung app-weit (Betrags-/Längen-Limits, Enums,
  Pagination-Obergrenzen, `whitelist` + `forbidNonWhitelisted`)
- ENV-Validierung beim Bootstrap — fehlende/zu kurze Secrets verhindern den Start
- Rate Limiting (NGINX + NestJS Throttler, verschärft auf Auth- und 2FA-Endpoints)
- Helmet Security Headers, restriktive CSP (kein `unsafe-eval`,
  `connect-src 'self'`), `Referrer-Policy: no-referrer`
- `/api/health` (Liveness) + `/api/ready` (DB-Probe, optional Redis) für
  Container-Healthchecks; Backend-Container läuft als non-root
- DSGVO-konform (Self-Hosted, keine Daten an Dritte, Fonts self-hosted)

### Technik
- Responsive Light/Dark-Theme UI mit Mobile-Tabbar inkl. „Mehr“-Sheet
  (alle Bereiche mobil erreichbar)
- **⌘K-Befehlspalette**: Seiten öffnen + Transaktionen durchsuchen von überall
- **Performance**: Route-basiertes Code-Splitting (Initial-JS ~330 kB statt
  892 kB; Charts laden nur auf Chart-Seiten), Fonts self-hosted
- **PWA**: installierbar als Home-Screen-App (iOS/Android/Desktop); Service
  Worker lädt HTML network-first (deploy-sicher, keine veralteten Versionen)
  und cached nur unveränderliche Assets, /api bleibt live
- **Barrierefreiheit**: Fokus-Trap + Fokus-Rückgabe in allen Dialogen,
  Label-/Fehler-Verknüpfung an allen Formularfeldern (`aria-describedby`,
  `role="alert"`), Skip-Link, Tastaturnavigation in Menüs,
  `prefers-reduced-motion` wird respektiert
- **Formular-Härtung**: Eingaben während laufender Requests gesperrt
  (kein Doppel-Submit), tolerantes Dezimal-Parsing (Komma & Punkt),
  Feld-Level-Fehlermeldungen
- **E-Mail-Versand** via SMTP (nodemailer) – Passwort-Reset-Mails; ohne SMTP
  wird der Reset-Link nur mit explizitem `MAIL_FALLBACK_LOG=true` ins
  Backend-Log geschrieben
- Edit-Modals für Konten, Transaktionen, Verträge, Depot-Positionen
- Empty-States mit klarem Call-to-Action auf allen Listen-Seiten
- Docker-Deployment (Dev & Prod) mit Healthchecks, Migrationen laufen
  automatisch beim Start
- Swagger API-Dokumentation (nur außerhalb von Production)
- Demo-Daten via `SEED_DEMO_USER=true` (Boot-Hook, reset-at-restart,
  in Production blockiert)
- Optionaler Prisma-Studio-Container (`docker compose --profile tools up -d
  prisma-studio`, nur auf `127.0.0.1` gebunden)
- CI: GitHub Actions (Lint, Test, Build) auf Node 20 / pnpm 9.15.0

## API-Endpunkte

### Auth
- `POST /api/auth/register` - Registrierung
- `POST /api/auth/login` - Anmeldung (mit optionalem 2FA)
- `POST /api/auth/refresh` - Token erneuern
- `POST /api/auth/logout` - Abmelden
- `GET /api/auth/me` - Aktueller Benutzer
- `POST /api/auth/forgot-password` - Reset-Link per E-Mail anfordern
- `POST /api/auth/reset-password` - Passwort mit Reset-Token setzen
- `GET /api/auth/2fa/generate` - QR-Code für 2FA
- `POST /api/auth/2fa/enable` - 2FA aktivieren
- `POST /api/auth/2fa/disable` - 2FA deaktivieren

### Benutzer
- `GET /api/users/profile` - Profil abrufen
- `PATCH /api/users/profile` - Profil bearbeiten
- `POST /api/users/change-password` - Passwort ändern (invalidiert andere Sessions)
- `GET /api/users/notification-settings` - Benachrichtigungs-Einstellungen
- `PATCH /api/users/notification-settings` - Einstellungen speichern
- `DELETE /api/users/account` - Konto endgültig löschen (Body: `{ "password": "…" }`)

### Health
- `GET /api/health` - Liveness (Prozess antwortet)
- `GET /api/ready` - Readiness (DB-Probe; Redis-Status sofern `REDIS_URL` gesetzt)

### Konten & Banking
- `GET /api/accounts` - Alle Konten
- `GET /api/accounts/balance` - Gesamtsaldo
- `POST /api/accounts` - Konto anlegen
- `PATCH /api/accounts/:id` - Konto bearbeiten
- `DELETE /api/accounts/:id` - Konto entfernen
- `GET /api/banking/institutions` - Liste verfügbarer Banken
- `POST /api/banking/connect` - Bank verbinden (Enable Banking)
- `POST /api/banking/callback/:connectionId` - Banking-Callback
- `POST /api/banking/sync/:accountId` - Konto synchronisieren
- `POST /api/banking/sync-all` - Alle verbundenen Konten synchronisieren

### Kategorien
- `GET /api/categories` - System- und User-Kategorien
- `POST /api/categories` - Eigene Kategorie anlegen
- `PATCH /api/categories/:id` - User-Kategorie bearbeiten
- `DELETE /api/categories/:id` - User-Kategorie löschen (System-Kategorien sind geschützt)

### Transaktionen
- `GET /api/transactions` - Liste (mit Filter & Pagination)
- `GET /api/transactions/export/csv` - CSV-Export
- `GET /api/transactions/expenses-by-category` - Ausgaben nach Kategorie
- `GET /api/transactions/monthly-overview` - Monatsübersicht
- `POST /api/transactions` - Neue Transaktion
- `PATCH /api/transactions/:id` - Transaktion bearbeiten
- `DELETE /api/transactions/:id` - Transaktion löschen

### Budgets & Dashboard
- `GET /api/budgets` - Alle Budgets mit Fortschritt
- `POST /api/budgets` - Budget erstellen
- `PATCH /api/budgets/:id` - Budget bearbeiten
- `DELETE /api/budgets/:id` - Budget löschen
- `GET /api/dashboard` - Aggregierte Dashboard-Daten

### Wiederkehrende Zahlungen
- `GET /api/recurring-payments` - Alle wiederkehrenden Zahlungen
- `POST /api/recurring-payments` - Zahlung erstellen
- `PATCH /api/recurring-payments/:id` - Zahlung bearbeiten
- `DELETE /api/recurring-payments/:id` - Zahlung löschen

### Sparziele
- `GET /api/savings-goals` - Alle Sparziele
- `POST /api/savings-goals` - Sparziel erstellen
- `POST /api/savings-goals/:id/add` - Betrag einzahlen/abheben
- `PATCH /api/savings-goals/:id` - Sparziel bearbeiten
- `DELETE /api/savings-goals/:id` - Sparziel löschen

### Verträge
- `GET /api/contracts` - Alle Verträge
- `POST /api/contracts` - Vertrag erstellen
- `GET /api/contracts/detect` - Verträge auto-erkennen
- `POST /api/contracts/from-detection` - Erkannten Vertrag übernehmen
- `GET /api/contracts/compare` - Anbietervergleich
- `PATCH /api/contracts/:id` - Vertrag bearbeiten
- `DELETE /api/contracts/:id` - Vertrag löschen

### Benachrichtigungen
- `GET /api/notifications` - Liste (`?unread=true&limit=N`)
- `GET /api/notifications/count` - Anzahl ungelesener
- `POST /api/notifications/:id/read` - Als gelesen markieren
- `POST /api/notifications/read-all` - Alle als gelesen markieren
- `DELETE /api/notifications/:id` - Löschen

### Forecast / Sparpotenzial
- `GET /api/dashboard/forecast?days=30` - Liquiditätsvorschau (7–180 Tage)
- `GET /api/dashboard/savings-potential` - Fixkosten, Abos, Wechsel-Potenzial

### Depot
- `GET /api/investments` - Positionen + Summary + Allokation
- `POST /api/investments` - Position anlegen
- `PATCH /api/investments/:id` - Position bearbeiten
- `POST /api/investments/:id/price` - Aktuellen Kurs setzen
- `DELETE /api/investments/:id` - Position löschen

### KI-Assistent
- `GET /api/chat/status` - Aktiviert? (true/false)
- `POST /api/chat/message` - Nachricht senden (history-aware, kontext-injiziert)

## Automatischer Konten-Import (Enable Banking)

Orynthia bezieht Kontostände und Buchungen direkt von deiner Bank über die
**Enable Banking PSD2-API** – kostenlos für private Nutzung. Setup-Aufwand
einmalig ca. 15 Minuten.

### 1. Enable-Banking-Account anlegen

1. Auf [enablebanking.com](https://enablebanking.com/sign-in/) registrieren
   (Self-Service, kostenlos für "Personal Use")
2. Im Control Panel → **API Applications** → "Create application"
   - **Application type:** `Personal`
   - **Redirect URLs:** deine Frontend-URL, z. B.
     `http://localhost:5173/accounts` (Dev) und/oder
     `https://orynthia.deine-domain.tld/accounts` (Prod)
3. Beim Anlegen wird automatisch ein **RSA Private Key** (PEM-Format)
   generiert. **Einmalig herunterladen** – kann nachträglich nicht mehr
   eingesehen werden.

### 2. Credentials in `.env` eintragen

Den heruntergeladenen Private Key einzeilig (mit `\n` als Zeilenumbruch)
in `.env` setzen:

```env
ENABLE_BANKING_APP_ID=deine_application_id
ENABLE_BANKING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----"

# Frontend-Origin muss zu einer in Enable Banking hinterlegten Redirect-URL passen
FRONTEND_URL=http://localhost:5173
```

> Tipp: Mit `awk 'NF {sub(/\r/,""); printf "%s\\n",$0}' private_key.pem`
> kannst du den PEM-Key direkt für `.env` formatieren.

### 3. Bank verbinden

1. Container neu starten (`docker compose up -d`)
2. In der App: **Konten** → Tab **Bank** → Bank auswählen
3. Du wirst zur Bank-Login-Seite umgeleitet, autorisierst dort den Zugriff
4. Bank leitet zurück auf `…/accounts?code=…&bankConnected=true` – Orynthia
   importiert automatisch Konten + Buchungen der letzten 30 Tage
5. Folge-Syncs alle 6 h automatisch (Cron), oder manuell per Sync-Button

### Begrenzungen (PSD2-bedingt, nicht von Orynthia)

- **Consent läuft alle 90 Tage ab** (gesetzlich vorgeschrieben). Du musst die
  Verbindung dann neu autorisieren – du bekommst rechtzeitig eine
  Benachrichtigung im UI.
- **Free-Tier-Limit** (Personal-Use bei Enable Banking): mehrere hundert
  Aufrufe/Monat – reicht für 3–5 Konten mit Cron-Sync alle 6 h locker.
- Manche Sparkassen/VR-Banken fordern bei jedem Sync eine TAN-Bestätigung.
  Falls deine Bank Probleme macht, ist der Code so geschnitten, dass ein
  zweiter Provider (z. B. GoCardless / Nordigen) hinter dem
  `BankingProviderInterface` ohne Schema-Änderung ergänzt werden kann.

### Sicherheit at rest

- Banking-Session-IDs werden vor dem Schreiben in die DB AES-256-GCM
  verschlüsselt (`ENCRYPTION_KEY` in `.env`, 64 Hex-Zeichen).
- 2FA-Secrets ebenfalls verschlüsselt at rest.
- Bei Rotation von `ENCRYPTION_KEY` werden bestehende Banking-Verbindungen
  und 2FA-Setups unlesbar – beides muss dann neu eingerichtet werden.

## Tests & Qualität

```bash
# Backend (Jest): 27 Tests in 6 Suiten — Auth-/Ownership-Pfade abgedeckt
cd packages/backend && pnpm test

# Frontend (Vitest): 20 Tests — Auth-Store, Format-/Parsing-Utilities
cd packages/frontend && pnpm test

# Lint (beide Pakete, 0 Warnungen erlaubt)
pnpm lint
```

CI (GitHub Actions) führt Lint, Tests und Builds bei jedem Push/PR auf `main` aus.

Die App wurde einem vollständigen Frontend- und Backend-Audit unterzogen
(Security, Autorisierung, Accessibility, Performance, Datenschicht) — Reports
inkl. Umsetzungsstatus und bewusst offener Punkte liegen unter
[`docs/FRONTEND_AUDIT.md`](docs/FRONTEND_AUDIT.md) und
[`docs/BACKEND_AUDIT.md`](docs/BACKEND_AUDIT.md).

## Lizenz

Private Nutzung. Self-Hosted auf eigenem Server.
