# Finanzguru - Persönliche Finanzverwaltung

Eine Finanzguru-ähnliche Web-App zur persönlichen Finanzverwaltung mit automatischer Kategorisierung, Budgets, Multi-Konto-Verwaltung und Dashboard-Analysen.

## Tech-Stack

| Bereich | Technologien |
|---------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Query, Zustand, Recharts |
| **Backend** | Node.js 20, NestJS, REST API, Passport.js, JWT |
| **Datenbank** | PostgreSQL 16, Prisma ORM, Redis 7 |
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

### 2. Development starten

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/api/docs |

### 3. Datenbank initialisieren

```bash
# In einem neuen Terminal:
docker compose exec backend npx prisma migrate dev --name init
docker compose exec backend npx prisma db seed
```

### 4. Demo-Login

- **E-Mail:** demo@finanzguru.local
- **Passwort:** demo1234

## Produktion (Proxmox / Homeserver)

### Build & Start

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Die App ist dann über NGINX auf **Port 80** erreichbar.

### SSL/HTTPS einrichten (optional)

1. SSL-Zertifikat beschaffen (z.B. Let's Encrypt mit Certbot)
2. In `nginx/nginx.conf` den HTTPS-Block einkommentieren
3. Zertifikat-Pfade anpassen
4. Port 443 in `docker-compose.prod.yml` freigeben

## Projektstruktur

```
finanzguru/
├── docker-compose.yml          # Development
├── docker-compose.prod.yml     # Production Overrides
├── .env.example                # Umgebungsvariablen-Vorlage
├── nginx/nginx.conf            # Reverse Proxy
├── packages/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Datenbankschema
│   │   │   └── seed.ts         # Demo-Daten
│   │   └── src/
│   │       ├── auth/           # JWT, 2FA, Login/Register
│   │       ├── users/          # Profilverwaltung
│   │       ├── accounts/       # Bankkonten
│   │       ├── transactions/   # Buchungen & Kategorisierung
│   │       ├── categories/     # Kategorien-System
│   │       ├── budgets/        # Budget-Tracking
│   │       └── dashboard/      # Aggregierte Übersicht
│   └── frontend/
│       └── src/
│           ├── pages/          # Dashboard, Transaktionen, Budgets, etc.
│           ├── components/     # Layout, Sidebar, Header
│           ├── stores/         # Zustand Auth Store
│           └── lib/            # API Client, Utilities
```

## API-Endpunkte

### Auth
- `POST /auth/register` – Registrierung
- `POST /auth/login` – Anmeldung (mit optionalem 2FA)
- `POST /auth/refresh` – Token erneuern
- `GET /auth/me` – Aktueller Benutzer
- `GET /auth/2fa/generate` – QR-Code für 2FA
- `POST /auth/2fa/enable` – 2FA aktivieren
- `POST /auth/2fa/disable` – 2FA deaktivieren

### Konten
- `GET /accounts` – Alle Konten
- `GET /accounts/balance` – Gesamtsaldo
- `POST /accounts` – Konto anlegen
- `PATCH /accounts/:id` – Konto aktualisieren
- `DELETE /accounts/:id` – Konto entfernen

### Transaktionen
- `GET /transactions` – Liste (mit Filter & Pagination)
- `GET /transactions/expenses-by-category` – Ausgaben nach Kategorie
- `GET /transactions/monthly-overview` – Monatsübersicht
- `POST /transactions` – Neue Transaktion
- `PATCH /transactions/:id` – Transaktion bearbeiten
- `DELETE /transactions/:id` – Transaktion löschen

### Budgets & Dashboard
- `GET /budgets` – Alle Budgets mit Fortschritt
- `POST /budgets` – Budget erstellen
- `GET /dashboard` – Aggregierte Dashboard-Daten

## Features

- ✅ JWT-Authentifizierung mit Refresh Tokens
- ✅ Zwei-Faktor-Authentifizierung (TOTP)
- ✅ Automatische Transaktionskategorisierung
- ✅ Budget-Tracking mit Fortschrittsanzeige
- ✅ Dashboard mit Diagrammen (Balken & Torte)
- ✅ Multi-Konto-Verwaltung
- ✅ Responsive Dark-Theme UI
- ✅ Docker-Deployment (Dev & Prod)
- ✅ Swagger API-Dokumentation
- ✅ Demo-Daten mit Seed-Script

## Nächste Schritte

- [ ] Banking-API Integration (finAPI)
- [ ] E-Mail-Verifizierung
- [ ] Benachrichtigungssystem
- [ ] Sparziele-UI
- [ ] Wiederkehrende Zahlungen erkennen
- [ ] CSV/PDF-Export
- [ ] Mobile App (API ist bereit)
