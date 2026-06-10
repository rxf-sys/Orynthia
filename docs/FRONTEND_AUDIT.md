# Frontend Audit & Quality Assurance — Orynthia

**Datum:** 2026-06-10
**Scope:** `packages/frontend` (React 18, Vite 6, Tailwind 3, React Query 5, Zustand 5, react-router 6)
**Methodik:** Vollständiges statisches Code-Audit aller 46 Quelldateien (4 parallele Audit-Durchläufe: Seiten A/B, Auth & Infrastruktur, UI-Komponenten & Design-System), verifiziert durch Production-Build, TypeScript-Check, ESLint und Test-Suite. Kein Browser-/E2E-Test möglich (Backend + DB in dieser Umgebung nicht provisioniert) — alle Findings sind im Quellcode mit Datei:Zeile belegt und reproduzierbar.

**Verifikations-Baseline (alle grün):**

| Check | Ergebnis |
| --- | --- |
| `tsc -b` | ✅ 0 Fehler |
| `eslint . --max-warnings 0` | ✅ 0 Warnungen |
| `vitest run` | ✅ 12/12 Tests (nur `utils.ts`) |
| `vite build` | ✅ — aber **892 kB JS in einem Chunk** (252 kB gzip) |

---

# Executive Summary

**Gesamtbewertung: 6.5 / 10**

Die Codebasis ist überdurchschnittlich sauber: strikt typisiertes TypeScript ohne `any`-Wildwuchs, konsistentes Token-basiertes Design-System (Light/Dark via CSS-Variablen), httpOnly-Cookie-Auth mit Refresh-Queue statt localStorage-Token, React Query mit korrekter Invalidierung, durchgängige Confirm-Dialoge für destruktive Aktionen, Lint und Build grün.

**Größte Schwächen**

1. **Accessibility ist systematisch lückenhaft** — kein Fokus-Trap in Modals, Labels nicht mit Inputs verknüpft, kein `aria-current`, kein Skip-Link, keine `autocomplete`-Attribute. Das sind Verstöße gegen WCAG 2.1 Level A, und weil sie in den Basis-Komponenten (`Modal`, `Field`) liegen, betreffen sie jede Seite.
2. **Ein einziges 892-kB-Bundle** — Recharts, alle 15 Seiten und alle Vendor-Libs laden beim ersten Paint, auch auf der Login-Seite.
3. **Service-Worker cached `index.html` cache-first** — nach jedem Deploy droht eine veraltete oder weiße Seite, bis der Nutzer manuell neu lädt.
4. **Vorgetäuschte Funktionalität** — die Such-Inputs in Header und Sidebar (inkl. „⌘K“-Hint) haben keinerlei Handler; die Benachrichtigungs-Einstellungen zeigen „Einstellung gespeichert“, persistieren aber nichts.

**Größte Chancen**

- Route-basiertes Code-Splitting + Recharts-Lazy-Loading halbiert das Initial-Bundle mit ~2 h Aufwand.
- Zwei Fixes in Basis-Komponenten (`Field` mit `useId`, `Modal` mit Fokus-Trap) heben die Accessibility der gesamten App auf einen Schlag.
- Die Formulardisziplin (disabled-States, Feld-Level-Fehler statt Toasts) lässt sich über ein gemeinsames Form-Pattern vereinheitlichen — `react-hook-form` + `zod` sind bereits installiert, werden aber **nirgends genutzt**.

**Kritische Probleme:** 6 (siehe unten) — kein Daten-Verlust-Risiko, aber Deploy-Stabilität, irreführende UI und WCAG-A-Blocker.

---

# Kritische Findings (Priorität: Hoch)

| # | Bereich | Problem | Auswirkung | Empfehlung |
| --- | --- | --- | --- | --- |
| K1 | PWA / Deploy — `public/sw.js:5,30-41` | Service Worker cached `/` und `/index.html` **cache-first** (stale-while-revalidate), Version hart auf `v1`. Nach einem Deploy liefert der SW das alte HTML mit alten Asset-Hashes aus; sind die alten Chunks serverseitig gelöscht, bleibt die Seite weiß. | Jeder Bestandsnutzer kann nach jedem Release eine veraltete oder kaputte App sehen. | Navigations-Requests (`request.mode === 'navigate'`) network-first mit Cache-Fallback behandeln; `index.html` aus `STATIC_ASSETS` entfernen; zusätzlich in nginx `Cache-Control: no-cache` für `index.html` setzen. **Aufwand: S (1–2 h)** |
| K2 | Settings — `Settings.tsx:453-466` | Benachrichtigungs-Toggles leben nur in lokalem `useState`; der Toast „Einstellung gespeichert“ ist faktisch falsch — nach Reload ist alles zurückgesetzt. | Vertrauensverlust; Nutzer glauben, Budget-Warnungen o. Ä. konfiguriert zu haben. | Entweder Backend-Mutation anbinden oder Tab als „in Arbeit“ kennzeichnen und Toast entfernen. **Aufwand: S–M** |
| K3 | A11y Basis — `ui/Modal.tsx:35-48`, `ui/ConfirmDialog.tsx` | Modal hat keinen Fokus-Trap (Tab wandert hinter das Overlay) und keine Fokus-Rückgabe an den Trigger beim Schließen. `role="dialog"`/Escape sind vorhanden, der Rest fehlt. | WCAG 2.1 A (2.4.3 / 2.1.2) verletzt; Tastatur- und Screenreader-Nutzer verlieren den Kontext — betrifft alle Modals der App. | Im `useEffect`: `document.activeElement` merken, Tab-Handler mit zyklischem Fokus über fokussierbare Elemente, beim Cleanup `.focus()` auf Trigger. Alternativ `focus-trap-react` (~3 kB). **Aufwand: S (2–3 h)** |
| K4 | A11y Basis — `ui/Field.tsx:11-24` | `<label>` hat kein `htmlFor`; die Field-Komponente verknüpft Label nie mit dem Input-Child. Da fast jedes Formular `Field` nutzt, sind praktisch alle Inputs der App unbeschriftet. | WCAG 2.1 A (1.3.1 / 4.1.2) verletzt; Label-Klick fokussiert nicht, Screenreader lesen nur „Eingabefeld“. | `useId()` in `Field`, Label mit `htmlFor`, Kind via `cloneElement` (oder Render-Prop) mit `id` + `aria-describedby` (für `hint`) versorgen. **Aufwand: S (2 h), wirkt app-weit** |
| K5 | Performance — `vite build` Output | Ein monolithischer Chunk: `index-*.js` 892.66 kB (251.69 kB gzip). Recharts, alle Seiten, date-fns, lucide laden bereits auf `/login`. | Langsamer First Load v. a. mobil (LCP/TTI); jede Code-Änderung invalidiert den gesamten Cache. | `React.lazy` + `Suspense` pro Route (mindestens Dashboard/Investments/Forecast wegen Recharts), `manualChunks` für `recharts` + `react-dom`. Erwartung: Initial-JS < 300 kB. **Aufwand: M (0,5 Tag)** |
| K6 | UX / tote UI — `Header.tsx:45-49`, `Sidebar.tsx:139-146` | Beide Such-Inputs (Desktop-Header mit „⌘K“-Badge, Mobile-Sidebar) haben keinerlei `onChange`/`onSubmit`/Shortcut-Handler — reine Dekoration. | Nutzer tippen Suchbegriffe ins Leere; das prominente ⌘K verspricht ein Feature, das nicht existiert. | Kurzfristig entfernen oder hinter Feature-Flag; mittelfristig globale Suche (Transaktionen/Verträge) implementieren. **Aufwand: S (entfernen) / L (implementieren)** |

---

# Mittlere Findings (Priorität: Mittel)

| # | Bereich | Problem | Auswirkung | Empfehlung |
| --- | --- | --- | --- | --- |
| M1 | Formulare app-weit — u. a. `Contracts.tsx:212-299`, `RecurringPayments.tsx:139-200`, `SavingsGoals.tsx:150-187`, `Settings.tsx:118-141`, `Assistant.tsx:148-162` | Submit-Buttons sind bei `isPending` disabled, die Eingabefelder jedoch nicht; in `Settings.tsx:164-171` fehlt das disabled sogar auf dem **„Endgültig löschen“**-Button des Account-Delete-Dialogs. | Doppel-Submits bei langsamem Netz (doppelte Verträge/Zahlungen), Editieren während laufendem Request. | Einheitliches Pattern: `<fieldset disabled={isPending}>` um Formular-Inhalte; Delete-Confirm-Button an `isPending` koppeln. **Aufwand: S–M** |
| M2 | Validierung app-weit — z. B. `Budgets.tsx:146`, `Contracts.tsx:203-207`, `Investments.tsx:333-334` | Validierung erfolgt per Hand (`if (!amount || amount <= 0) toast.error(...)`) statt mit den installierten `react-hook-form`+`zod`; Fehler erscheinen nur als Toast, nie am Feld; negative/absurd große Kosten (Contracts) sind speicherbar. | Nutzer wissen nicht, welches Feld falsch ist; inkonsistente Regeln pro Seite; Datenqualität leidet. | Zod-Schemas pro Formular + `react-hook-form`-Resolver, Feld-Level-Fehlertexte mit `role="alert"` + `aria-describedby`. **Aufwand: M–L (inkrementell pro Seite)** |
| M3 | Auth-Seiten — `Login.tsx:98-117`, `Register.tsx:132-162`, `ResetPassword.tsx:59-89` | Keine `autocomplete`-Attribute (`email`, `current-password`, `new-password`). | Passwort-Manager funktionieren nicht zuverlässig; iOS/Android-Autofill scheitert. | Attribute ergänzen (5 Inputs). **Aufwand: S (15 min)** |
| M4 | Navigation A11y — `Sidebar.tsx:156-162`, `MobileTabbar.tsx:27-36`, `Layout.tsx` | Kein `aria-current="page"` auf aktiven NavLinks, kein Skip-Link („Zum Inhalt springen“), Dropdowns (User-Menü, NotificationBell) ohne Pfeiltasten-Navigation/`role="menu"`. | Screenreader-Nutzer wissen nicht, wo sie sind; Tastaturnutzer müssen durch die gesamte Sidebar tabben. | `aria-current` via NavLink-Render-Prop; Skip-Link mit `sr-only focus:not-sr-only`; ArrowKey-Handling in beiden Dropdowns. **Aufwand: S–M** |
| M5 | Mobile IA — `MobileTabbar.tsx:18` | Tab „Mehr“ (Menü-Icon) navigiert direkt zu `/settings` statt ein Menü zu öffnen; 6 von 11 Bereichen (Konten, Verträge, Investments, Assistent, Sparpotenzial, Wiederkehrend) sind mobil nur über den Hamburger im Header erreichbar. | Irreführendes Icon/Label; wichtige Bereiche mobil schwer auffindbar. | „Mehr“-Tab öffnet Sheet/Drawer mit den restlichen Routen (oder löst den Sidebar-Drawer aus). **Aufwand: M** |
| M6 | Theming — `index.css:62-81` | Dark-Theme überschreibt `--pos`/`--neg`/`--warn` nicht; die Light-Werte (#1f8a5b, #c2474b, #b5780f) haben auf dunklem Grund schwachen Kontrast. Zusätzlich grenzwertig: `text-ink-2` (#4a4f70) für Notification-Texte im Light-Theme (~4.2:1). | Statusfarben (Gewinn/Verlust, Budget-Warnung) im Dark-Mode schwer erkennbar — Kernelement einer Finanz-App. | Hellere Dark-Mode-Varianten definieren; Kontraste mit axe/Contrast-Checker auf ≥ 4.5:1 prüfen. **Aufwand: S** |
| M7 | Charts/Daten-UX — `Dashboard.tsx:254 vs. 273` | PieChart rendert **alle** Ausgaben-Kategorien, die Legende daneben nur `slice(0, 5)` — Segmente ohne Zuordnung. | Nutzer können Segmente nicht identifizieren. | Gleiche Datenbasis für Chart und Legende: Top 5 + „Sonstige“-Sammelsegment. **Aufwand: S** |
| M8 | Fehlerzustände — `ForecastCard.tsx:62-66`, `Dashboard.tsx:70-76`, `Contracts.tsx:160-162` | Mehrere Queries behandeln nur `isLoading`, nie `isError`: Forecast zeigt ewigen Spinner, Hero-Kacheln zeigen während des Ladens `0 €` statt Skeleton. | API-Ausfall ist für Nutzer unsichtbar bzw. zeigt falsche Nullwerte (bei Finanzdaten besonders heikel). | Konsistentes Pattern `isError → Fehlerkarte mit Retry`, Skeletons statt 0-Fallbacks. **Aufwand: M** |
| M9 | API-Layer — `lib/api.ts:29-33,68` | Kein `timeout` in `axios.create`; bei finalem Refresh-Fehler harter `window.location.href = '/login'` (voller Reload, potenziell mehrfach bei parallelen 401). | Hängende Requests blockieren UI unbegrenzt; doppelte Redirects. | `timeout: 30000` setzen; statt Hard-Redirect `useAuthStore.getState()`-Reset, Router übernimmt via `ProtectedRoute`. **Aufwand: S** |
| M10 | Zahleneingaben — `Transactions.tsx:240-250`, `Investments.tsx:196-200,386` | `type="number"` für Beträge (Komma-Eingabe je nach Browser/Locale fehleranfällig); Kurs-Update via `window.prompt()` akzeptiert leeren String → `Number('') === 0`, Kurs wird auf 0 gesetzt; `step="0.00000001"` praktisch unbedienbar. | Deutsche Nutzer scheitern an Dezimaleingaben; Depotwerte können versehentlich genullt werden. | `inputMode="decimal"` + tolerantes Parsing (`,`→`.`), Leerstring-Guard im Prompt-Handler, Prompt durch kleines Modal ersetzen. **Aufwand: M** |
| M11 | Security — `ResetPassword.tsx:9-11`, `nginx`-Config | Reset-Token verbleibt bis zum Submit in der URL (History/Referer-Leak); CSP erlaubt `style-src 'unsafe-inline'`; kein erkennbares CSRF-Token-Schema (Mitigation hängt allein an SameSite-Cookie-Attribut des Backends). | Token-Leakage möglich; reduzierte XSS/CSRF-Tiefenverteidigung. | Token nach dem Lesen per `history.replaceState` aus URL entfernen; `Referrer-Policy: no-referrer` setzen; SameSite-Attribut im Backend verifizieren. **Aufwand: S–M** |
| M12 | A11y-Status — `ui/Progress.tsx:14`, `NotificationBell.tsx:105-112` | Progress-Bars ohne `role="progressbar"`/`aria-valuenow` (Budgets, Sparziele); Unread-Badge ohne `aria-live`. | Fortschritt und neue Benachrichtigungen sind für Screenreader unsichtbar. | ARIA-Attribute ergänzen; Bell-Button `aria-label` mit Count. **Aufwand: S** |
| M13 | Routing — `App.tsx:43-48,85` | `PublicRoute` rendert `null` während `isLoading` (Blank-Flash); Catch-All `*` leitet still auf `/` um — es gibt keine 404-Seite. | Kurzer weißer Screen beim Kaltstart; Tippfehler-URLs landen kommentarlos auf dem Dashboard. | Loading-UI wie in `ProtectedRoute` wiederverwenden; dedizierte 404-Seite mit Link zurück. **Aufwand: S** |
| M14 | Tests | Nur `utils.test.ts` (12 Tests, Format-Helfer). Auth-Flows, API-Interceptor (401→Refresh→Retry), Routing-Guards und sämtliche Formulare sind ungetestet. | Regressionen in kritischen Pfaden bleiben unbemerkt; Refactorings riskant. | Priorisiert: Interceptor-Tests (msw), `authStore`, `ProtectedRoute`/`PublicRoute`, ein Formular-Smoke-Test pro Seite. **Aufwand: L (inkrementell)** |
| M15 | PWA — `manifest.webmanifest` | Nur ein SVG-Icon, keine PNG-192/512-Varianten, kein `maskable`. | „Zum Homescreen hinzufügen“ zeigt auf etlichen Android-Geräten kein/falsches Icon. | PNG 192/512 + `purpose: maskable` ergänzen. **Aufwand: S** |

---

# Niedrige Findings (Priorität: Niedrig)

| # | Bereich | Problem | Auswirkung | Empfehlung |
| --- | --- | --- | --- | --- |
| L1 | `Transactions.tsx:653`, `Investments.tsx:563` | `void pickCategoryColor;` / `void cn;` — Dead-Code-Tricks gegen Unused-Import-Lint. | Verwirrt; kaschiert tote Importe. | Importe entfernen statt voiden. |
| L2 | `SavingsPotential.tsx:73` | Ternary `count === 1 ? 'Posten' : 'Posten'` — beide Zweige identisch (Copy-Paste). | Kein sichtbarer Schaden, aber offensichtlich unbeabsichtigt. | Singular/Plural korrekt: `'Posten' : 'Posten'` → z. B. `'Abo' : 'Abos'`. |
| L3 | `Contracts.tsx:21-43` | Hex-Farben pro Vertragstyp hartkodiert statt aus Design-Tokens. | Theme-Drift, Dark-Mode-Kontrast ungeprüft. | Auf `categoryColors.ts`-Mechanik / CSS-Variablen umziehen. |
| L4 | `SavingsGoals.tsx:347-355` | „Monate verbleibend“ rechnet pauschal mit 30 Tagen/Monat. | Prognose um Tage daneben. | `date-fns` `differenceInCalendarMonths` nutzen (bereits installiert). |
| L5 | `Settings.tsx:280-287` | Passwort-Sichtbarkeits-Toggle: `aria-label` statisch „Passwort anzeigen“, wechselt nicht mit State; QR-Code fix `h-48 w-48` (kann bei 320 px knapp werden). | Kleinere A11y/Responsive-Mängel. | Dynamisches Label; `max-w-full h-auto`. |
| L6 | `stores/authStore.ts` | `logout()` setzt nur State, kein expliziter Redirect — Nutzer bleibt auf geschützter Route, bis Guard greift. | Funktioniert via Guard, aber undeterministisch wirkende UX. | Nach Logout `navigate('/login')` im aufrufenden Handler. |
| L7 | `index.css` | Keine `prefers-reduced-motion`-Behandlung trotz `animate-fade-in`/Transitions überall. | Motion-sensitive Nutzer. | Globale Reduce-Motion-Media-Query. |
| L8 | `index.html` | Google Fonts (2 Familien, 5 Gewichte) render-blocking von fremder Origin; kein `font-display`-Kontrollpunkt außer `display=swap` (vorhanden). | FOUT/Latenz, DSGVO-Graubereich (Google-Server). | Fonts self-hosten (`@fontsource/inter`), Gewichte reduzieren. |
| L9 | `Dashboard.tsx:312-348,373` | `acc.bankName[0]` ohne Leerstring-Fallback; `slice(0, 6)` als Magic Number. | Glyph-Glitch bei leerem Banknamen. | Fallback `'?'`; Konstante extrahieren. |
| L10 | `ErrorBoundary.tsx:19` | `console.error` mit vollem Error-Objekt auch in Prod. | Minimales Info-Leak-Risiko, Konsolen-Rauschen. | Auf `import.meta.env.DEV` begrenzen oder an Monitoring senden. |
| L11 | `ui/Avatar.tsx`, `ui/CategoryIcon.tsx`, `ui/PageHead.tsx` | Avatar ohne `aria-label`; Subtitle als `<div>` statt `<p>`. | Kosmetische Semantik-Lücken. | `aria-label={name}`, `<p>`-Element. |
| L12 | `Header.tsx:8-17` | `TITLE_MAP` deckt nur 8 von 11 Routen ab (fehlend: investments, assistant, savings-potential) → Such-Placeholder fällt auf „Orynthia“ zurück; Grammatik teils schief („In Sparzielen suchen“). | Inkonsistente Beschriftung. | Map vervollständigen (oder mit Suche zusammen entfernen, s. K6). |

---

# UX-Verbesserungen

1. **Tote Suche entfernen oder bauen** (K6) — aktuell das größte Erwartungs-Leck der App.
2. **Feld-Level-Validierung statt Toast-Only** (M2) — Fehler dort anzeigen, wo sie entstehen; Toasts nur für Server-Fehler.
3. **„Mehr“-Tab mobil ehrlich machen** (M5) — Sheet mit allen Bereichen statt Sprung zu Einstellungen.
4. **Skeletons statt 0-€-Werte beim Laden** (M8) — bei Finanzdaten wirken falsche Nullen wie Datenverlust.
5. **404-Seite statt Silent-Redirect** (M13).
6. **Inline-Kategorie-Wechsel in Transaktionen** (`Transactions.tsx:394-398`): sofortige Mutation beim Select-Change ist mobil fehlertippanfällig — Undo-Toast ergänzen.
7. **Benachrichtigungs-Tab**: ehrlich machen (K2) — nichts untergräbt Vertrauen schneller als ein falscher „Gespeichert“-Toast.
8. **Passwort-Match live validieren** (Register/Reset/Settings) statt erst beim Submit.
9. **Assistant**: Textarea während `pending` disablen; Vorschlags-Fragen kontextabhängig zeigen.
10. **Empty-States mit Aktion**: teils vorhanden (gut!), bei Verträgen/Investments um direkten CTA ergänzen.

# Performance-Optimierungen

1. **Code-Splitting pro Route** (`React.lazy`) + `manualChunks` für `recharts` (~400 kB des Bundles) und Vendor — größter Einzelhebel (K5).
2. **Recharts nur laden, wo Charts sichtbar sind** (Dashboard, Forecast, Investments) — Login/Transaktionen brauchen es nicht.
3. **Fonts self-hosten** und auf 3 Gewichte reduzieren (L8) — eliminiert externen render-blocking Request.
4. **Service-Worker-Strategie korrigieren** (K1) — auch ein Performance-Thema: aktuell wird Cache-Hit mit Korrektheit erkauft.
5. **`lucide-react` Importe sind bereits named** (tree-shakebar) — gut, kein Handlungsbedarf.
6. **Listen**: Transaktionen sind server-paginiert (25/Seite) — gut. Verträge/Investments rendern ungebremst; ab ~200 Einträgen Pagination/Virtualisierung erwägen.
7. **`useMemo`** für Gruppierungen/Summen in `Contracts`/`RecurringPayments`/`SavingsGoals` (derzeit Berechnung bei jedem Render — bei aktuellen Datenmengen unkritisch, aber billig zu fixen).

# Accessibility-Verbesserungen

Reihenfolge nach Hebelwirkung:

1. `Field` mit `useId`/`htmlFor`/`aria-describedby` (K4) — repariert fast alle Formulare zentral.
2. Fokus-Trap + Fokus-Rückgabe in `Modal`/`ConfirmDialog` (K3).
3. `autocomplete` auf Auth-Inputs (M3).
4. `aria-current="page"` in Sidebar/Tabbar, Skip-Link, Dropdown-Tastaturnavigation (M4).
5. Dark-Mode-Statusfarben + Kontrast-Pass mit axe (M6).
6. `role="progressbar"` + Werte auf Progress; `aria-live` für Notification-Badge (M12).
7. Fehlermeldungen mit `role="alert"` an Feldern (mit M2 zusammen).
8. `prefers-reduced-motion` (L7).

# SEO

Geringe Relevanz (App hinter Login, `lang="de"`, Meta-Description vorhanden). Fehlend, falls öffentliche Seiten relevant werden: Open-Graph-Tags, `robots.txt`, per-Route-`<title>` (aktuell statisch „Orynthia“ — auch für Tab-Verwaltung/History der Nutzer sinnvoll: `document.title` pro Route setzen, **Aufwand S**).

# Quick Wins (≤ 1 h pro Punkt, hoher Nutzen)

| Maßnahme | Findings |
| --- | --- |
| `autocomplete`-Attribute auf 5 Auth-Inputs | M3 |
| `timeout: 30000` in axios | M9 |
| Leerstring-Guard im Kurs-Prompt (`Investments.tsx:196`) | M10 |
| disabled auf „Endgültig löschen“-Button | M1 |
| Legende = Chart-Daten im Dashboard-Pie | M7 |
| `Posten/Posten`-Ternary, `void`-Dead-Code | L1, L2 |
| 404-Seite + PublicRoute-Spinner | M13 |
| `aria-current` via NavLink-Render-Prop | M4 |
| `document.title` pro Route | SEO |
| Manifest-PNG-Icons | M15 |

# Roadmap

## Sofort umsetzen (diese Woche)

1. **K1** Service-Worker: network-first für Navigationen (Deploy-Sicherheit).
2. **K2** Benachrichtigungs-Toast ehrlich machen.
3. **K3 + K4** Modal-Fokus-Trap und `Field`-Label-Verknüpfung (zwei zentrale Komponenten, app-weite Wirkung).
4. **K6** Tote Such-Inputs entfernen.
5. Alle Quick Wins (Summe < 1 Tag).

## Nächster Sprint

1. **K5** Code-Splitting + Recharts-Chunk.
2. **M1** `<fieldset disabled>`-Pattern app-weit.
3. **M2** Zod + react-hook-form für die 3 wichtigsten Formulare (Transaktion, Vertrag, Sparziel).
4. **M4–M6** Navigation-A11y, Mobile-„Mehr“-Sheet, Dark-Mode-Statusfarben.
5. **M8** Konsistente Error-/Skeleton-States.
6. **M14** Test-Grundstock: API-Interceptor, authStore, Route-Guards.

## Langfristig

1. Globale Suche (⌘K-Command-Palette) — das tote UI-Element in echten Mehrwert verwandeln.
2. Vollständige WCAG-2.1-AA-Konformität inkl. axe-CI-Check.
3. E2E-Smoke-Suite (Playwright) für Auth + je einen CRUD-Flow pro Seite.
4. Benachrichtigungs-Einstellungen serverseitig persistieren + echte Push-/E-Mail-Anbindung.
5. Font-Self-Hosting, CSP-Härtung (Nonce-basiert), Referrer-Policy.

---

*Hinweis zur Reproduzierbarkeit: Alle Findings referenzieren Datei und Zeile auf Stand des Branches `claude/determined-fermi-8l09ai` (Basis: `f46d8e9`). Vier als nicht haltbar erkannte Verdachtsfälle aus den Audit-Durchläufen (u. a. ein vermeintlich falscher `EmptyState`-Icon-Prop und fehlender Pagination-Reset bei Filterwechsel) wurden gegen den Code geprüft und verworfen.*
