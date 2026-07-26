# Orynthia – Strategische Neuausrichtung zur Allrounder-App

**Status:** Freigegeben und in Umsetzung. Phase 0 sowie der Phase-1-MVP (Tasks 1–10) sind auf `claude/loving-wright-82coi7` umgesetzt:
Frontend-/Backend-Modularisierung, modulare Navigation (Sidebar/Tabbar/⌘K), Home-Widget-Dashboard mit Personalisierung,
Aufgaben-Domain und lokale Kalender-Domain inkl. Migration `6_add_tasks_and_calendar`, Demo-Seed und README.
Verifiziert per Build, Lint, 88 Tests sowie End-to-End-Smoke-Test gegen echte PostgreSQL-Instanz
(Migrationen, Boot, Login, Aufgaben-Recurrence, Serien-Expansion, Dashboard-Layout). Phase 2 (Tasks 11+12) ist ebenfalls umgesetzt: Integration-Vault (external_integrations, AES-256-GCM), ICS-Abo read-only mit Stunden-Refresh und Google Calendar read-only (OAuth mit eigenen Client-Creds, syncToken-Inkremental-Sync alle 15 min, Fehler-Notifications); synchronisierte Kalender sind app-weit schreibgeschützt. Einzige neue Dependency: node-ical. Offen: Google bidirektional (Task 13), Apple CalDAV (Task 14), Phase 3+ (Tasks 15–17).
**Stand:** 2026-07-26
**Analysierte Repositories:** `rxf-sys/Orynthia` (Commit `a9a92df`), `rxf-sys/standby-web`

---

## 1. Executive Summary

Orynthia ist heute eine technisch reife, sicherheitsbewusste Self-Hosted-Finanz-App (NestJS + Prisma + PostgreSQL im Backend, React + Vite + eigenem Designsystem im Frontend). Standby Web ist eine leichtgewichtige "All-in-One-Lebens-App" (Next.js + Supabase) mit genau den Modulen, die Orynthia perspektivisch braucht: Kalender, Rezepte, Einkaufsliste – inklusive dem wichtigsten Cross-Module-Flow (Rezept → Einkaufsliste).

**Kernaussage der Analyse:**

1. **Orynthia ist die richtige technische Basis** für die Allrounder-Vision – nicht Standby Web. Die NestJS-API-Schicht, das Auth-System (JWT + Refresh-Rotation + 2FA), die Verschlüsselung at rest und die Ownership-Checks sind genau die Grundlage, die eine App mit Banking-Daten braucht. Standby Webs Supabase-Direktzugriff wäre ein Rückschritt.
2. **Standby Web liefert die Produkt-Blaupause**: flache, modulare Navigation, Cross-Module-Dashboard, pragmatische Datenmodelle für Kalender/Rezepte/Einkaufslisten. Diese Konzepte werden adaptiert, nicht kopiert.
3. **Die größte Arbeit ist keine neue Technik, sondern Struktur**: Orynthia ist heute vollständig um Finanzen herum organisiert (Navigation, Dashboard, Datenmodell, KI-Assistent). Die Neuausrichtung besteht aus (a) einer Domain-Modularisierung von Backend und Frontend, (b) einem neuen modularen Home-Dashboard, (c) einer modulbewussten Navigation und (d) drei neuen Domains (Kalender, Aufgaben, Rezepte/Listen), die dem bestehenden Qualitätsniveau folgen.
4. **Das bestehende Design bleibt.** Das Orynthia-Designsystem (Token-basiert, Light/Dark, A11y, ⌘K-Palette, Mobile-Tabbar, PWA) ist besser als das von Standby Web und trägt die Allrounder-App ohne Umbau.

Empfohlener MVP: neues Home-Dashboard + modulare Navigation + Banking unverändert als Modul + Aufgaben + Kalender (lokal, ohne externe Sync). Google/Apple-Kalender-Sync folgt in Phase 2, Rezepte/Listen in Phase 3.

---

## 2. Aktueller Zustand von Orynthia

### 2.1 Tech Stack & Architektur

| Bereich | Ist-Zustand |
|---|---|
| Monorepo | pnpm Workspaces + Turborepo (`packages/backend`, `packages/frontend`) |
| Backend | Node 20, NestJS 10, REST (`/api`), Swagger (nur Dev), Passport (JWT lokal), `@nestjs/schedule` (Cron), Throttler, Helmet, Winston |
| Datenbank | PostgreSQL 16 via Prisma 5 (versionierte Migrationen, `migrate deploy` beim Boot), Redis 7 (vorhanden; BullMQ als Dependency, aktuell kaum genutzt) |
| Auth | JWT Access (15 m) + Refresh-Rotation über httpOnly-Cookie, Multi-Device-Sessions (`UserSession`, bcrypt-Hash), TOTP-2FA (Secret AES-256-GCM at rest), Passwort-Reset via SMTP |
| Banking | Enable Banking (PSD2) hinter einem `BankingProviderInterface` (providerneutral geschnitten), Session-IDs AES-256-GCM verschlüsselt, Auto-Sync alle 6 h, 90-Tage-Consent-Handling |
| KI | Anthropic-Chat-Assistent (`/api/chat`), kontext-injiziert mit Finanzdaten, Token-Budget pro User |
| Frontend | React 18 + TypeScript + Vite, React Router 6 (route-basiertes Code-Splitting), TanStack Query (Server-State), Zustand (Auth/Theme), React Hook Form + Zod, Recharts, Tailwind mit eigenem Token-Designsystem (CSS-Variablen, Light/Dark), Lucide Icons |
| UI-Basis | Eigene UI-Bibliothek (`components/ui`): Btn, Card, Modal, Field, ConfirmDialog, EmptyState, Progress, Tag, Avatar, PageHead + ⌘K-CommandPalette, NotificationBell, MobileTabbar, ForecastCard |
| PWA/Perf | Installierbar, Service Worker network-first für HTML, Initial-JS ~330 kB, Fonts self-hosted |
| Deployment | Docker Compose (Dev/Prod), NGINX Reverse Proxy, Healthchecks, non-root Container, optional Prisma Studio |
| Tests/CI | Jest (27 Tests Backend), Vitest (20 Tests Frontend), Lint 0-Warnungen, GitHub Actions (Lint/Test/Build) |
| Doku | Ausführliche README, Frontend-/Backend-Audit-Reports mit Umsetzungsstatus |

**Backend-Struktur:** 19 flache NestJS-Module (`auth`, `users`, `accounts`, `banking`, `transactions`, `categories`, `budgets`, `recurring-payments`, `savings-goals`, `contracts`, `investments`, `notifications`, `chat`, `dashboard`, `health`, `config`, `mail`, `prisma`, `demo-seed`). Die Modulgrenzen sind sauber, aber alle Module gehören fachlich zur selben Domain (Finanzen) – es gibt keine übergeordnete Domain-Schicht.

**Frontend-Struktur:** flach – `pages/` (15 Seiten), `components/` (Layout + UI), `stores/`, `lib/` (ein zentraler `api.ts`-Client, ein zentraler `types.ts`). Für 15 Seiten funktioniert das; bei 25+ Seiten über 6+ Domains wird es unübersichtlich.

### 2.2 Datenmodell (Ist)

`User` (+ `UserSession`) → `BankAccount` → `Transaction` (→ `Category`, → `RecurringPayment`), `Budget`, `SavingsGoal`, `Contract`, `InvestmentPosition`, `Notification`, `BankConnection`. Alles hängt direkt am User, Ownership-Checks auf allen Relationen. Cent-genaue Decimal-Arithmetik, Unique-Constraints gegen Sync-Duplikate.

### 2.3 Bestehende Features nach Bereich

| Bereich | Features | Weiterverwendbar? |
|---|---|---|
| **Banking** | PSD2-Kontoanbindung, Auto-Sync (6 h), manuelle Konten (6 Typen), Consent-Ablauf-Warnung | ✅ unverändert – wird das Modul „Finanzen“ |
| **Finanzen** | Transaktionen (voll editierbar, Filter, Pagination, CSV-Export), Auto-Kategorisierung, Budgets inkl. Status, Sparziele, wiederkehrende Zahlungen, Verträge inkl. Auto-Erkennung + Anbietervergleich, Sparpotenzial-Analyse, Depot | ✅ unverändert |
| **Dashboard** | Aggregierte Finanz-Übersicht, Charts, Liquiditäts-Forecast (30/60/90 Tage) | 🔁 wird zum Finanz-*Modul*-Dashboard; das neue Home-Dashboard kommt darüber |
| **Nutzerkonto** | Registrierung, Login, 2FA, Passwort-Reset/-Wechsel mit Session-Invalidierung, Profil, Konto-Löschung, Benachrichtigungs-Einstellungen | ✅ unverändert – wird zur Plattform-Schicht |
| **Navigation** | Sidebar (4 Sektionen, rein finanzbezogen), Header + NotificationBell, Mobile-Tabbar mit „Mehr“-Sheet, ⌘K-Palette | 🔁 Struktur bleibt, Inhalt wird modular |
| **Einstellungen** | Profil, Sicherheit, Theme, Benachrichtigungen | ✅ erweiterbar (Modul-Einstellungen, Integrationen) |
| **Sonstiges** | KI-Assistent (finanzkontextuiert), Notifications (Inbox + Cron, idempotent), PWA, A11y, Demo-Seed | ✅ Assistent + Notifications sind ideale Plattform-Dienste für alle Module |

### 2.4 Stärken / Schwächen bezogen auf die neue Vision

**Stärken:** Sicherheitsniveau (Verschlüsselung, Ownership, DTO-Validierung, Rate Limits), Designsystem & A11y, Notification-Infrastruktur, Cron-Infrastruktur, Provider-Abstraktion im Banking, CI/Tests, Doku-Kultur.

**Schwächen für die Allrounder-Vision:**
1. Navigation, Dashboard und ⌘K-Palette sind hart auf Finanzen verdrahtet.
2. Keine Domain-Gliederung im Frontend (`pages/` flach, ein monolithischer `api.ts`/`types.ts`).
3. `Category`, `Notification`, `Tag` sind implizit Finanz-Konzepte – neue Module brauchen eigene bzw. verallgemeinerte Varianten.
4. Kein Konzept für externe Nicht-Banking-Integrationen (OAuth-Token-Speicherung existiert nur bankingintern).
5. Der KI-Assistent kennt nur Finanzdaten.

---

## 3. Analyse von Standby Web

### 3.1 Steckbrief

Next.js 16 (App Router) + React 19, Supabase (PostgreSQL, Auth, Row Level Security), shadcn/ui (Radix), TanStack Query + Zustand, React Hook Form + Zod, Vitest + Playwright, Docker-Standalone hinter Cloudflare Tunnel. Frontend spricht direkt mit Supabase (Service-Schicht in `src/lib/services/*`, Query-Hooks in `src/lib/hooks/queries/*`); Autorisierung ausschließlich über RLS-Policies.

### 3.2 Informationsarchitektur & Navigation

- **Header + schlanke Sidebar mit 7 flachen Einträgen:** Dashboard, Budget, Sparziele, Rezepte, Einkaufsliste, Kalender, Einstellungen. Keine Verschachtelung, ein Icon + Label pro Modul – trotz 5 Lebensbereichen wirkt nichts überladen.
- **Cross-Module-Dashboard:** Begrüßung + Stat-Karten *aus verschiedenen Modulen* (aktueller Saldo, Rezepte/Favoriten, heutige Termine) + Schnellzugriffe. Genau das „Home / Heute“-Muster der Zielvision – wenn auch statisch, nicht personalisierbar.
- **Route-Gruppen:** `(auth)` vs. `dashboard/*` – jede Domain ist ein eigener Routen-Ast mit eigenen Komponenten-Ordnern (`components/budget`, `components/calendar`, `components/recipes`, …) und eigenen Typ-Dateien (`lib/types/budget.ts`, `calendar.ts`, `recipe.ts`). Diese **Feature-Ordner-Disziplin** ist der wichtigste strukturelle Take-away.

### 3.3 Relevante Datenmodelle

- **`calendar_events`:** Titel, Beschreibung, Kategorie (Enum-Check), Start/Ende (TIMESTAMPTZ, `CHECK end>=start`), Ort, Erinnerung (none/5min/…/1day), Ganztages-Flag, `recurring JSONB` ({frequency, interval, endDate}). Pragmatisch und direkt übernehmbar – für externe Sync fehlen nur Provenienz-Felder (source, externalId, etag, calendarId).
- **`recipes`:** globaler Katalog (nicht user-owned) mit prep/cook time, Portionen, Schwierigkeit, Kostenschätzung, `meal_types[]`, `dietary[]`, `ingredients JSONB` ([{name, amount, unit}]), `instructions TEXT[]`, Nutrition JSONB, Tags, Volltext-Indizes; Favoriten als m:n (`user_favorite_recipes`).
- **`shopping_list_items`:** flache Item-Liste pro User mit optionaler `recipe_id`-Referenz (SET NULL), amount/unit, `checked`. Der Flow „Rezept → Zutaten in Einkaufsliste übernehmen → abhaken → Aufräumen“ ist implementiert und bewährt.
- **`transactions`/`budgets`/`savings_goals`:** deutlich simpler als Orynthia – hier hat Orynthia nichts zu lernen.

### 3.4 Was übernehmen, was nicht

**Adaptieren (Konzepte):**
1. Flache Modul-Navigation mit einem Eintrag pro Lebensbereich.
2. Cross-Module-Home-Dashboard (bei uns: modular + personalisierbar statt statisch).
3. Feature-Ordner-Struktur pro Domain (Frontend).
4. Kalender-Event-Modell (Kategorien, Erinnerungen, All-Day, Recurring) als Basis.
5. Rezept-Modell inkl. Zutaten-JSON und Favoriten-m:n.
6. Rezept→Einkaufsliste als erster Cross-Module-Flow.
7. Wochen-/Termin-Widget „Nächste 7 Tage“.

**Nicht übernehmen:**
1. Supabase-Direktzugriff aus dem Client – mit Banking-Daten inakzeptabel; Orynthias API-Schicht bleibt.
2. Kein 2FA/Session-Management-Niveau – Orynthia ist hier weiter.
3. shadcn/ui-Optik – Orynthias eigenes Designsystem ist markanter und bleibt (eigenständige Identität).
4. Globaler, redaktioneller Rezept-Katalog als *einziges* Modell – Orynthia ist Self-Hosted/persönlich; primär User-eigene Rezepte (siehe offene Entscheidung E3).

---

## 4. Neue Produktvision

**Orynthia ist das persönliche Betriebssystem für den Alltag – self-hosted, privat, mit Finanzen als stärkstem Modul.**

Leitprinzipien:
1. **Ein Ort, viele Lebensbereiche:** Finanzen, Termine, Aufgaben, Rezepte, Listen – verbunden, nicht nebeneinander.
2. **Banking bleibt Kronjuwel und Vertrauensanker:** nichts an Qualität/Sicherheit wird geopfert; neue Module erben die Standards.
3. **Einfache Oberfläche, viel Substanz:** flache Navigation, personalisierbares Home, globale ⌘K-Suche über alle Module.
4. **Privacy first:** alles self-hosted, externe Integrationen (Kalender) opt-in, Tokens verschlüsselt, DSGVO-konform.
5. **Module statt Features:** jede Erweiterung ist eine gekapselte Domain mit klarer Schnittstelle – die Plattform wächst, ohne umgebaut zu werden.

---

## 5. Informationsarchitektur & Modulstruktur

### 5.1 Ziel-IA (Navigation, oberste Ebene)

```
🏠 Home                 (neu: modulares „Heute“-Dashboard)
💰 Finanzen             (bestehend, gebündelt: Übersicht, Konten, Transaktionen,
                         Budgets, Sparziele, Depot, Wiederkehrend, Verträge, Sparpotenzial)
📅 Kalender             (neu)
✅ Aufgaben             (neu)
🍳 Rezepte              (neu, Phase 3)
🛒 Listen               (neu, Phase 3: Einkaufs-, Pack-, Check-, Wunschlisten)
📝 Notizen              (später, Phase 5)
🤖 Assistent            (bestehend, wird modulübergreifend)
⚙️ Einstellungen        (bestehend + Modul-/Integrations-Einstellungen)
```

Die heutigen 9 Finanz-Seiten wandern **unter** „Finanzen“ (Sekundär-Navigation innerhalb des Moduls: Tabs oder einklappbare Sidebar-Sektion). Die Top-Ebene bleibt dadurch bei ≤ 9 Einträgen, auch wenn später Module dazukommen.

### 5.2 Modul-Bewertung (inkl. Kandidaten über die Vorgaben hinaus)

| Modul | Nutzerwert | Techn. Komplexität | Datenschutz-Risiko | Integrationsaufwand | Strategische Bedeutung | Empfehlung |
|---|---|---|---|---|---|---|
| Home-Dashboard | sehr hoch | mittel | gering | – | **Kern** (macht die Vision sichtbar) | Phase 1 |
| Aufgaben | hoch | gering | gering | gering | hoch (schnellster Beweis des Allrounder-Konzepts) | Phase 1 |
| Kalender (lokal) | hoch | mittel | gering | gering | hoch | Phase 1 |
| Kalender-Sync Google | hoch | hoch | mittel (OAuth-Tokens) | hoch | hoch | Phase 2 |
| Kalender-Sync Apple (CalDAV) | mittel | hoch | mittel (App-Passwort!) | hoch | mittel | Phase 2b |
| Rezepte | mittel-hoch | gering-mittel | gering | gering | mittel (Differenzierung ggü. Finanz-Apps) | Phase 3 |
| Listen (generisch) | hoch | gering | gering | gering | hoch (Verbindungsgewebe zwischen Modulen) | Phase 3 |
| Notizen | mittel | gering | gering | gering | mittel | Phase 5 |
| Abonnements | – | – | – | – | **existiert bereits** (Verträge + Wiederkehrend) – nur im Home sichtbar machen | Phase 1 (Widget) |
| Dokumente/Ablage | mittel | hoch (Storage, Verschlüsselung, Virenscan) | **hoch** | mittel | mittel | Phase 5, nur Architektur vorbereiten |
| Gewohnheiten/Ziele | mittel | gering | gering | gering | gering-mittel | Phase 5 |
| Reiseplanung | mittel | mittel | gering | mittel | gering (gut als Showcase für Modul-Verknüpfung) | Phase 5 |
| Kontakte, Versicherungs-Wallet, Wissensdatenbank | gering-mittel | mittel | mittel-hoch | mittel | gering | vorerst nicht |

**Bewusst NICHT bauen:** alles, was nur „noch ein Feature“ wäre, ohne Verknüpfungspotenzial oder mit hohem Datenschutzrisiko bei geringem Wert (z. B. Kontakte-Duplikat des Handys).

---

## 6. Navigation & UX-Konzept

**Prinzip: „Viel im Hintergrund, wenig an der Oberfläche.“**

1. **Desktop:** bestehende Sidebar bleibt (Optik unverändert), Inhalt wird zweistufig: Top-Level = Module; aktives Modul klappt seine Unterpunkte auf (Finanzen behält seine 9 Unterseiten). Sektion „Module“ statt heutiger Finanz-Sektionen.
2. **Mobile:** bestehende Tabbar bekommt die Slots `Home · Finanzen · Kalender · Aufgaben · Mehr` („Mehr“-Sheet existiert bereits und trägt die restlichen Module).
3. **⌘K-Palette wird zum Command Center:** heute Seiten + Transaktionssuche; Ziel: modulübergreifende Suche (Termine, Aufgaben, Rezepte, Listeneinträge) + Quick-Actions („Aufgabe anlegen“, „Termin anlegen“, „Ausgabe erfassen“) über eine Provider-Registry, bei der jedes Modul seine Suchquellen/Aktionen registriert.
4. **Home-Dashboard = Widget-Grid:** Jedes Modul liefert Widgets (Finanzen: Saldo/Budget-Status/Forecast; Kalender: Heute + nächste 7 Tage; Aufgaben: Heute fällig/überfällig; Verträge: nächste Kündigungsfristen; Listen: offene Einkäufe). Nutzer kann Widgets ein-/ausblenden und anordnen (Persistenz in `User.dashboardLayout JSONB` – analog zum existierenden `notificationSettings`-Muster). Start mit sinnvollem Default-Layout, Personalisierung in Phase 1b.
5. **Leere Module verstecken statt zeigen:** Ein Modul ohne Daten erscheint im Home nur als dezenter Einrichtungs-Hinweis (Empty-State-Pattern existiert bereits).
6. **Konsistenz:** alle neuen Seiten nutzen die bestehende UI-Bibliothek (PageHead, Card, Modal, Field, EmptyState, ConfirmDialog) – kein zweites Designsystem.

---

## 7. Cross-Module-Verknüpfungen (Zielbild)

| Verknüpfung | Beschreibung | Phase |
|---|---|---|
| Rezept → Einkaufsliste | Zutaten (skaliert nach Portionen) in Einkaufsliste übernehmen | 3 |
| Kalender ↔ Aufgaben | Aufgabe mit Fälligkeit erscheint im Kalender; Termin kann Aufgaben referenzieren | 4 |
| Banking ↔ Abonnements | existiert (Vertrags-Auto-Erkennung); neu: Abo-Widget im Home, Kündigungsfrist → Kalender-Eintrag/Erinnerung | 4 |
| Aufgaben ↔ Erinnerungen | Fälligkeits-Notifications über die bestehende Notification-Infrastruktur (Cron-Muster vorhanden) | 1 |
| Kalender ↔ Erinnerungen | Termin-Reminder über dieselbe Infrastruktur | 1 |
| Meal-Planner ↔ Kalender | geplante Mahlzeiten als Kalender-Layer | 4 |
| Finanzen ↔ Listen | erledigte Einkaufsliste optional als Ausgabe erfassen | 4 |
| Kalender ↔ Reisen / Event → Packliste | Listen-Template an Termin hängen | 5 |
| Assistent ↔ alle Module | Chat-Kontext-Provider pro Modul (Termine, Aufgaben, Rezepte zusätzlich zu Finanzen) | 4 |

**Technisches Muster:** Verknüpfungen laufen über eine generische Link-Entität (`EntityLink: sourceType/sourceId ↔ targetType/targetId, linkType`) statt über n×n Fremdschlüssel – ausgenommen die wenigen harten, häufigen Beziehungen (ShoppingListItem→Recipe, Task→CalendarEvent), die direkte FKs bekommen. So bleiben Module entkoppelt und neue Verknüpfungen brauchen keine Migration der Kern-Tabellen.

---

## 8. Technische Zielarchitektur

### 8.1 Grundsatzentscheidung

**Modularer Monolith, kein Microservice-Umbau.** Die bestehende NestJS-Struktur ist bereits modulfähig; es fehlt nur die Domain-Gliederung. Backend:

```
packages/backend/src/
├── platform/            # querschnittlich: auth, users, mail, notifications,
│   │                    # prisma, config, health, integrations (OAuth-Token-Vault)
├── modules/
│   ├── finance/         # bestehende Module: accounts, banking, transactions,
│   │                    # categories, budgets, recurring-payments, savings-goals,
│   │                    # contracts, investments, dashboard(finance)
│   ├── calendar/        # neu
│   ├── tasks/           # neu
│   ├── recipes/         # neu (Phase 3)
│   └── lists/           # neu (Phase 3)
├── home/                # Aggregation der Modul-Widgets (liest nur über Modul-Services)
└── assistant/           # chat + Kontext-Provider-Registry
```

Wichtig: Das ist zunächst **nur Verschieben + Import-Pfade** (NestJS-Module bleiben identisch), plus eine Konvention: Module importieren nie gegenseitig ihre Services direkt, sondern über explizit exportierte, schmale „Public APIs“ (bzw. Events für lose Kopplung).

Frontend analog:

```
packages/frontend/src/
├── app/                 # Router, Layout, Guards
├── platform/            # ui/, stores/, api-client, command-palette-registry, widgets-registry
└── features/
    ├── finance/         # pages + components + api + types der 9 Finanz-Seiten
    ├── calendar/  tasks/  recipes/  lists/  home/  settings/  assistant/
```

Der monolithische `lib/api.ts` und `lib/types.ts` werden pro Feature aufgeteilt (`features/<x>/api.ts`, `types.ts`); ein schmaler gemeinsamer HTTP-Client bleibt in `platform/`.

### 8.2 Sicherheit & Datenschutz (kritisch)

Banking-Daten bleiben hochsensibel und werden von den neuen Alltagsdaten sauber getrennt:

1. **Least Privilege auf Modulebene:** Neue Module erhalten keinerlei Zugriff auf Finanz-Services. Cross-Module-Lesen (z. B. Home-Widget „Saldo“) läuft ausschließlich über die schmalen Public-API-Methoden des Finanz-Moduls, die nur Aggregatwerte liefern – nie Roh-Transaktionen.
2. **Token-Vault für Integrationen:** Google-OAuth-Tokens und Apple-App-Passwörter werden wie Banking-Sessions mit dem bestehenden AES-256-GCM-`EncryptionService` at rest verschlüsselt, in einer eigenen Tabelle (`external_integrations`), nie im Klartext geloggt, pro User löschbar („Verbindung trennen“ = Token-Revoke + Löschung).
3. **DTO-Validierung, Ownership-Checks, Throttling, CSP:** identische Standards für alle neuen Endpoints (bestehende Muster/Guards wiederverwenden; Ownership-Checks sind in jedem neuen Service Pflicht, Tests analog zu den bestehenden Auth-/Ownership-Suiten).
4. **DSGVO:** Konto-Löschung kaskadiert bereits (`onDelete: Cascade`) – neue Tabellen folgen demselben Muster; Kalender-Sync ist opt-in mit klarer Zweckbeschreibung; Export (heute CSV für Transaktionen) wird perspektivisch zum Voll-Export pro Modul.
5. **Auditierbarkeit:** Integrations-Zugriffe (Sync-Läufe, Token-Refresh) werden über Winston strukturiert geloggt (ohne Payload-Inhalte).
6. **Assistent:** Modul-Kontexte sind opt-in pro Anfragekontext; Finanzdaten fließen weiterhin nur aggregiert in Prompts.

### 8.3 Kalender-Integrationen (technische Analyse)

**Google Calendar – mittelfristig realistisch (Phase 2):**
- OAuth 2.0 Authorization Code Flow (Scope `calendar.readonly` zum Start, später `calendar.events` für bidirektional). Redirect auf die eigene Instanz – bei Self-Hosting trägt jeder Betreiber seine eigene Google-Cloud-App ein (`GOOGLE_CLIENT_ID/SECRET` in `.env`, analog zu Enable Banking). Unverifizierte Apps sind für den Eigengebrauch im „Testing“-Modus nutzbar (100-User-Limit irrelevant, aber 7-Tage-Refresh-Token-Ablauf im Testing-Modus → Hinweis in Doku; „In production“ ohne Verifizierung zeigt Warnbildschirm).
- Sync: initialer Import + **inkrementeller Sync via `syncToken`**; Push-Benachrichtigungen (watch channels) erfordern öffentlich erreichbares HTTPS – für Self-Hosting optional, Standard ist Polling per Cron (Infrastruktur vorhanden, Muster = Banking-Sync alle 6 h, hier z. B. 15 min).
- Konflikte: Richtung 1 (read-only) hat keine; bidirektional (Phase 2b+) via etag/updated-Vergleich, „last write wins“ mit Konflikt-Notification.
- Architektur: `CalendarProviderInterface` analog zum bewährten `BankingProviderInterface`.

**Apple Calendar – langfristig/komplex (Phase 2b oder später):**
- Es gibt **keine öffentliche REST-API**; der Weg ist **CalDAV gegen iCloud** mit Apple-ID + app-spezifischem Passwort. Das Passwort ist ein Vollzugriffs-Credential für CalDAV → strengste Behandlung im Token-Vault, klare UX-Warnung.
- CalDAV (RFC 4791, ctag/etag-basiertes Sync-Protokoll, iCalendar-Parsing inkl. RRULE) ist deutlich mehr Aufwand als Google; empfohlene Dependency dann z. B. `tsdav` + `ical.js` (Freigabe nötig).
- Realistische Empfehlung: **Google zuerst**, Apple als zweiter Provider hinter demselben Interface; kurzfristige Alternative für Apple-Nutzer: read-only ICS-Abo-URLs (iCloud „Kalender teilen per Link“) – geringer Aufwand, sofortiger Nutzen.

**Einordnung:** kurzfristig = lokaler Orynthia-Kalender + ICS-Abo (read-only); mittelfristig = Google read-only Sync, dann Google bidirektional; langfristig = Apple CalDAV bidirektional, Konflikt-UI, Push-Channels.

### 8.4 Caching / Offline / Sync

- Server-Caching: Redis existiert; für Home-Aggregation und Sync-Jobs (BullMQ ist bereits Dependency) nutzbar – kein neuer Baustein nötig.
- Offline: PWA cached heute nur Assets. Echte Offline-Bearbeitung (Aufgaben/Listen) wäre ein eigenes Großprojekt (Konflikt-Handling) → bewusst **nicht** im Plan; nur „read-only letzter Stand“ via Query-Cache-Persistenz als optionales Phase-5-Thema.

---

## 9. Datenmodell (Soll – neue Entitäten)

Bestehende Finanz-Tabellen bleiben **unverändert**. Neu (Prisma, additive Migrationen):

```
// Plattform
ExternalIntegration  id, userId, provider (GOOGLE_CALENDAR|APPLE_CALDAV|ICS),
                     credentialEnc (AES-256-GCM), status, scopes, expiresAt, lastSyncAt

// Kalender
Calendar             id, userId, name, color, isDefault,
                     source (LOCAL|GOOGLE|APPLE|ICS), integrationId?, externalId?, readOnly
CalendarEvent        id, calendarId, title, description?, location?,
                     startsAt, endsAt, isAllDay, categoryColor?, reminderMinutes?,
                     rrule? (String, RFC 5545), externalId?, etag?, syncStatus?
                     @@unique([calendarId, externalId])   // Muster: Transaction-Dedupe

// Aufgaben
TaskList             id, userId, name, color, sortOrder
Task                 id, userId, taskListId?, title, notes?, priority (LOW|MED|HIGH),
                     dueAt?, completedAt?, rrule?, reminderMinutes?,
                     calendarEventId?   // harter FK für Kalender-Anzeige (SetNull)

// Rezepte (Phase 3)
Recipe               id, userId, title, description?, imageUrl?, prepMin, cookMin,
                     servings, difficulty, mealTypes[], dietary[], instructions[],
                     tags[], isFavorite, nutrition Json?
RecipeIngredient     id, recipeId, name, amount Decimal?, unit?

// Listen (Phase 3)
List                 id, userId, name, type (SHOPPING|PACKING|CHECKLIST|WISHLIST|GENERIC), icon?
ListItem             id, listId, name, amount?, unit?, checked, sortOrder,
                     recipeId? (SetNull)   // Herkunft „aus Rezept“

// Verknüpfungen (Phase 4)
EntityLink           id, userId, sourceType, sourceId, targetType, targetId, linkType
                     @@unique([userId, sourceType, sourceId, targetType, targetId])

// Notizen (Phase 5)
Note                 id, userId, title?, content, tags[], pinned
```

**Anpassungen an Bestehendem (minimal, additiv):**
- `User.dashboardLayout Json?` (Home-Personalisierung, Muster = `notificationSettings`).
- `NotificationType` um `TASK_DUE`, `EVENT_REMINDER`, `CALENDAR_SYNC_ERROR` erweitern (Enum-Erweiterung, additive Migration).
- **Nicht** verallgemeinert wird `Category`: Finanz-Kategorien (mit Keywords/Budget-Bezug) und z. B. Termin-Kategorien sind fachlich verschieden – bewusste Entkopplung statt „God-Table“.

---

## 10. Roadmap

**Phase 0 – Fundament (keine sichtbaren Features):** Frontend-Feature-Ordner + Aufteilung `api.ts`/`types.ts`; Backend-Ordnerstruktur `platform/ | modules/finance/ | …` (reines Verschieben); Widget- und ⌘K-Provider-Registry als Interfaces; CI grün, Verhalten identisch (Regression = bestehende Tests + Smoke).

**Phase 1 – Core Allrounder (MVP):** neue modulare Navigation (Sidebar 2-stufig, Tabbar-Slots); neues Home-Dashboard mit Default-Widgets (Finanzen aggregiert, „Heute“, Aufgaben); Finanz-Dashboard wird Modul-Startseite unter `/finance`; **Aufgaben-Domain** komplett (CRUD, Listen, Prioritäten, Fälligkeit, Wiederholung, Due-Notifications via Cron); **Kalender-Domain lokal** (Monat/Woche/Tag/Agenda, Termine, Erinnerungen, Farben, mehrere Kalender); Redirects alter Routen.

**Phase 2 – Integrationen:** ICS-Abo (read-only, schnell); Google Calendar read-only (OAuth, syncToken-Sync, Cron); danach Google bidirektional; Apple CalDAV (2b, ggf. später); Konflikt-Notifications.

**Phase 3 – Alltag:** Rezepte (CRUD, Zutaten, Bilder-URL, Favoriten, Suche/Filter); Listen-Modul (Einkaufs-/Pack-/Check-/Wunschlisten); Flow Rezept→Einkaufsliste (Portions-Skalierung); ⌘K-Suche über alle Module.

**Phase 4 – Intelligente Verknüpfungen:** Aufgaben im Kalender, Kündigungsfristen → Kalender/Erinnerung, Abo-Widget, Meal-Planner (Wochenplan → Kalender-Layer + Sammel-Einkaufsliste), Einkauf→Ausgabe, Assistent modulübergreifend, EntityLink-UI („Verknüpfen mit …“).

**Phase 5 – Plattform-Erweiterung:** Notizen; danach nach Nutzerwert: Gewohnheiten/Ziele, Reiseplanung (Showcase: Termin+Packliste+Budget), Dokumente (nur mit eigenem Security-Konzept), optionale Offline-Lesbarkeit.

---

## 11. MVP-Definition

| Entscheidung | Was | Begründung |
|---|---|---|
| **Bleibt (unverändert)** | Alle Finanz-Features, Auth/2FA, Notifications, PWA, Designsystem, KI-Assistent (vorerst finanzfokussiert) | Kernwert & Vertrauensanker; kein grundloser Umbau funktionierender Teile |
| **Neu im MVP** | Home-Dashboard (Default-Layout), modulare Navigation, Aufgaben-Modul, lokales Kalender-Modul | Kleinstes Set, das die Allrounder-Vision real erlebbar macht; beide Module sind ohne externe Abhängigkeiten in hoher Qualität baubar |
| **Verschoben** | Google/Apple-Sync (P2), Rezepte/Listen (P3), Meal-Planner & Verknüpfungs-UI (P4), Notizen/Dokumente (P5), Home-Drag&Drop-Personalisierung (P1b: erst ein-/ausblenden, dann anordnen) | Externe OAuth-Flows und Cross-Module-Magie brauchen das stabile Fundament zuerst; Personalisierung ist Politur, nicht Beweis |
| **Entfernt** | Nichts | Es existiert kein Ballast; auch das Sidebar-Promo („Sparpotential“) bleibt, wandert aber ins Finanz-Modul-Kontext |
| **Nur Architektur vorbereitet** | Widget-/⌘K-Provider-Registry, `CalendarProviderInterface`, `ExternalIntegration`-Vault, EntityLink-Entität (Schema ja, UI nein) | Billig jetzt, teuer nachträglich; verhindert den „ständigen Grundumbau“ |

---

## 12. Priorisierte Implementierungs-Tasks

Legende Aufwand: S (<½ Tag) · M (1–2 Tage) · L (3–5 Tage) · XL (>1 Woche)

| # | Task | Ziel / Inhalt | Betroffen | Risiken | Abhängig von |
|---|---|---|---|---|---|
| 1 | **Frontend-Modularisierung** (M) | `features/<domain>`-Struktur, `api.ts`/`types.ts` aufteilen, Barrel-Exports; reine Verschiebung | alle `pages/*`, `lib/api.ts`, `lib/types.ts`, Imports | Merge-Konflikte mit parallelem Werk; Mitigation: ein einziger PR, keine Logikänderung, Tests grün | – |
| 2 | **Backend-Modularisierung** (M) | `platform/`+`modules/finance/`-Ordner, `app.module.ts` bündelt `FinanceModule`; reine Verschiebung | alle `src/*`-Module, Importpfade, tsconfig-Pfade | dito; Prisma/Swagger-Pfade prüfen | – |
| 3 | **Registry-Interfaces** (S) | `DashboardWidgetProvider`, `CommandPaletteProvider` (Frontend), Modul-Public-API-Konvention (Backend) dokumentiert | `platform/` neu | über-abstrahieren; bewusst minimal halten | 1, 2 |
| 4 | **Navigation umbauen** (M) | Sidebar 2-stufig (Module + Finanz-Unterpunkte), Tabbar-Slots, Redirects `/transactions`→`/finance/transactions` … | `Sidebar.tsx`, `MobileTabbar.tsx`, `App.tsx`-Routen, ⌘K-Einträge | Gewohnheits-Bruch für Bestandsnutzer; Redirects + unveränderte Optik mildern | 1 |
| 5 | **Aufgaben-Domain Backend** (M) | Prisma `Task`+`TaskList` (+Enum-Erweiterung `NotificationType`), CRUD-Endpoints mit Ownership+DTO-Validierung, Due-Cron | `schema.prisma` (+Migration), `modules/tasks/` neu, `notifications` | RRULE-Parsing für Wiederholung: bewusst simpel starten (eigene kleine Frequenz-Logik wie `RecurringPayment`, kein RFC-5545-Parser) | 2 |
| 6 | **Aufgaben-Domain Frontend** (M) | Seiten Listen/Heute/Erledigt, Quick-Add, Prioritäten, Fälligkeiten; UI-Kit wiederverwenden | `features/tasks/` neu, Widget + ⌘K-Provider | gering | 3, 4, 5 |
| 7 | **Kalender-Domain Backend** (L) | Prisma `Calendar`+`CalendarEvent`, CRUD, Expansion wiederkehrender Termine für Zeitfenster-Query, Reminder-Cron | `schema.prisma` (+Migration), `modules/calendar/` neu | Recurrence-Expansion ist fehleranfällig → Testsuite mit Zeitzonen-/DST-Fällen Pflicht | 2 |
| 8 | **Kalender-Domain Frontend** (L) | Monats-/Wochen-/Tages-/Agenda-Ansicht, Event-Dialog, Kalenderfarben, mehrere Kalender; Eigenbau auf `date-fns` (keine schwere Kalender-Lib → Freigabe nur falls doch gewünscht) | `features/calendar/` neu, Widget + ⌘K | Kalender-UI ist das größte UI-Stück des MVP; Wochen-/Monatsgrid früh prototypen | 3, 4, 7 |
| 9 | **Home-Dashboard** (M) | `/` wird Home: Widget-Grid mit Finanz-Aggregat (nutzt bestehende Dashboard-API), Heute (Kalender), Aufgaben, Verträge-Hinweis; `User.dashboardLayout` + Ein-/Ausblenden | `features/home/` neu, `home/`-Backend-Aggregat, `users` (Migration) | Performance: Aggregat-Endpoint parallelisiert Modul-Queries; Query-Cache nutzen | 4–8 |
| 10 | **MVP-Härtung** (M) | E2E-Smoke der neuen Flows, A11y-Pass, README/Doku, Demo-Seed um Aufgaben/Termine erweitern | Tests, `demo-seed`, Docs | – | 6, 8, 9 |
| 11 | **Integration-Vault + ICS-Abo** (M) | `ExternalIntegration`-Tabelle (AES-256-GCM via bestehendem `EncryptionService`), ICS-URL-Abo read-only mit Cron-Refresh | Migration, `platform/integrations/`, `modules/calendar/` | ICS-Parsing (`ical.js` o. ä. → **Dependency-Freigabe nötig**) | 7 |
| 12 | **Google Calendar read-only** (L) | OAuth-Flow (eigene Client-Creds per `.env`), `CalendarProviderInterface`, syncToken-Inkremental-Sync, Sync-Cron, Fehler-Notifications | `modules/calendar/providers/google/`, Settings-UI „Integrationen“ | Token-Ablauf im Google-„Testing“-Modus; Quota; sauberes Revoke | 11 |
| 13 | **Google bidirektional** (L) | Create/Update/Delete nach Google, etag-Konflikterkennung, Konflikt-Notification | dito | Konflikt-Logik; Datenverlust-Gefahr → konservativ (nie stumm überschreiben) | 12 |
| 14 | **Apple CalDAV** (XL) | CalDAV-Client (`tsdav`, Freigabe nötig), App-Passwort-UX mit Warnhinweisen, ctag/etag-Sync | `modules/calendar/providers/apple/` | höchster Integrationsaufwand; iCloud-Eigenheiten | 12 |
| 15 | **Rezept-Domain** (L) | Prisma `Recipe`+`RecipeIngredient`, CRUD, Suche/Filter/Favoriten, Bild-per-URL (kein Upload im ersten Schnitt) | Migration, `modules/recipes/`, `features/recipes/` | Bild-Upload bewusst vertagt (Storage/Security) | 2, 3 |
| 16 | **Listen-Domain + Rezept→Einkauf** (M) | `List`+`ListItem`, Listentypen, Abhaken/Aufräumen, „Zutaten übernehmen“ mit Portions-Skalierung | Migration, `modules/lists/`, `features/lists/` | Einheiten-Zusammenführung simpel halten (kein Unit-Parsing-Perfektionismus) | 15 |
| 17 | **Cross-Module-Phase-4-Paket** (L) | Aufgaben im Kalender, Kündigungsfrist→Erinnerung/Termin, Abo-Widget, EntityLink-UI, Assistent-Kontexte | mehrere Module | Scope-Creep → als einzelne kleine PRs schneiden | 6, 8, 16 |

**Benötigte neue Dependencies (alle freigabepflichtig, erst bei der jeweiligen Phase):** Phase 1: *keine* (Kalender-UI auf `date-fns`-Basis). Phase 2: `googleapis` (oder schlanker OAuth-Client), `ical.js`/`node-ical`; für Apple: `tsdav`. Phase 3: keine zwingend.

---

## 13. Risiken

| Risiko | Schwere | Mitigation |
|---|---|---|
| Modularisierung (Tasks 1–2) kollidiert mit parallelen Änderungen | mittel | je ein reiner Move-PR, sofort mergen, keine Logikänderung |
| Kalender-Recurrence/Zeitzonen-Bugs | hoch | kleine eigene Frequenz-Logik im MVP, DST-Testsuite, RFC-5545 erst mit externem Sync |
| OAuth-Token-Sicherheit (Google/Apple) | hoch | bestehender EncryptionService, eigener Vault, Revoke-Flow, niemals Logging |
| Google-App-Verifizierung/Testing-Limits beim Self-Hosting | mittel | Doku wie bei Enable Banking („eigene Creds anlegen“), read-only Start |
| Apple ohne offizielle API | hoch | CalDAV spät, ICS-Abo als früher Ersatz |
| Feature-Überladung / Navigation kippt | mittel | Modul-Bewertungsmatrix als Gate, Top-Level ≤ 9, leere Module unsichtbar |
| Bidirektionaler Sync verliert Daten | hoch | Phase 2 read-only zuerst; Schreiben nur mit etag-Check, konservative Konfliktregel |
| Aufwand KI-Assistent-Erweiterung unterschätzt | gering | erst Phase 4, Provider-Muster |
| Bestandsnutzer verlieren Orientierung | mittel | Redirects, unveränderte Optik, Finanz-Modul vollständig erhalten |

---

## 14. Offene Entscheidungen (bitte mit der Freigabe beantworten – Vorschläge markiert)

- **E1 – Startseite:** `/` wird neues Home, Finanz-Dashboard zieht nach `/finance` *(Vorschlag: ja)*.
- **E2 – Kalender-UI:** Eigenbau auf `date-fns` (schlank, designkonform) vs. Kalender-Library *(Vorschlag: Eigenbau)*.
- **E3 – Rezepte:** rein user-eigene Rezepte (self-hosted-Logik) vs. zusätzlich geteilter Instanz-Katalog wie Standby Web *(Vorschlag: user-eigen; Katalog später)*.
- **E4 – Apple-Priorität:** CalDAV in Phase 2b fest einplanen oder zunächst nur ICS-Abo *(Vorschlag: ICS zuerst, CalDAV nach Bedarf)*.
- **E5 – MVP-Umfang:** Aufgaben **und** Kalender in Phase 1, oder Kalender vorziehen/nachziehen *(Vorschlag: beide, Aufgaben zuerst mergen)*.
- **E6 – Naming/Branding:** Bleibt der Claim „Persönliche Finanzverwaltung“ → z. B. „Dein Alltag. Eine App.“ (README/Login-Screens) *(Vorschlag: mit Phase 1 anpassen)*.

---

## 15. Empfohlene nächste Schritte

1. Freigabe dieses Plans (inkl. Antworten zu E1–E6).
2. Umsetzung Phase 0 (Tasks 1–3) als zwei reine Struktur-PRs – danach ist die Codebasis bereit, ohne dass sich für Nutzer irgendetwas ändert.
3. Danach Phase 1 in der Task-Reihenfolge 4 → 5/6 → 7/8 → 9 → 10.
