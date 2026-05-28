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
- `ENCRYPTION_KEY` (64 Hex-Zeichen für AES-256)
- `POSTGRES_PASSWORD`
- `ENABLE_BANKING_APP_ID` und `ENABLE_BANKING_PRIVATE_KEY` (für Bankanbindung)

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
- **Passwort:** `demo1234`

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

### Build & Start

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Die App ist dann über NGINX auf **Port 80** erreichbar.

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

### SSL/HTTPS einrichten (optional)

1. SSL-Zertifikat beschaffen (z.B. Let's Encrypt mit Certbot)
2. In `nginx/nginx.conf` den HTTPS-Block einkommentieren
3. Zertifikat-Pfade anpassen
4. Port 443 in `docker-compose.prod.yml` freigeben

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
│   │       └── dashboard/      # Aggregierte Übersicht
│   └── frontend/
│       └── src/
│           ├── pages/          # Dashboard, Transaktionen, Budgets, etc.
│           ├── components/     # Layout, Sidebar, Header
│           │   └── ui/         # Btn, Card, Modal, ConfirmDialog, EmptyState, …
│           ├── stores/         # Zustand: Auth, Theme
│           └── lib/            # API Client, Types, Utilities
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
- Dashboard mit Diagrammen (Balken, Torte, Trends)
- CSV-Export (Excel-kompatibel mit BOM und deutschem Zahlenformat)

### Verträge & Abos
- Vertragsmanagement mit manueller Erfassung
- Auto-Erkennung von Verträgen aus Transaktionsmustern
- Monatliche/jährliche Kostenübersicht
- Anbietervergleich für Versicherungen und Energieanbieter (Check24, Verivox)
- Kündigungsfristen und automatische Verlängerung im Blick

### Sparen & Planung
- Sparziele mit Fortschrittsbalken
- Wiederkehrende Zahlungen verwalten
- Einnahmen/Ausgaben-Übersicht

### Sicherheit
- JWT-Authentifizierung mit Refresh Tokens
- Zwei-Faktor-Authentifizierung (TOTP)
- AES-256 Verschlüsselung sensibler Daten
- Rate Limiting (NGINX + NestJS Throttler)
- Helmet Security Headers
- DSGVO-konform (Self-Hosted, keine Daten an Dritte)

### Technik
- Responsive Dark-Theme UI mit Mobile-optimierten Aktions-Buttons
- Barrierefreie Custom-Dialoge (Esc-to-close, Backdrop, ARIA-Labels) statt Browser-`confirm()`
- Edit-Modals für Konten und Transaktionen
- Empty-States mit klarem Call-to-Action auf allen Listen-Seiten
- Docker-Deployment (Dev & Prod), Migrationen laufen automatisch beim Start
- Swagger API-Dokumentation
- Demo-Daten mit Seed-Script (optional)
- CI: GitHub Actions (Lint, Test, Build) auf Node 24 / pnpm 9.15.0

## API-Endpunkte

### Auth
- `POST /api/auth/register` - Registrierung
- `POST /api/auth/login` - Anmeldung (mit optionalem 2FA)
- `POST /api/auth/refresh` - Token erneuern
- `GET /api/auth/me` - Aktueller Benutzer
- `GET /api/auth/2fa/generate` - QR-Code für 2FA
- `POST /api/auth/2fa/enable` - 2FA aktivieren
- `POST /api/auth/2fa/disable` - 2FA deaktivieren

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

## Enable Banking einrichten

1. Account erstellen auf [enablebanking.com](https://enablebanking.com)
2. API Application erstellen (Control Panel -> API Applications)
3. RSA Private Key wird automatisch generiert (PEM-Format)
4. In `.env` eintragen:
   ```
   ENABLE_BANKING_APP_ID=deine_application_id
   ENABLE_BANKING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----"
   ```
5. In der App unter "Konten" eine Bank verbinden

## Lizenz

Private Nutzung. Self-Hosted auf eigenem Server.
