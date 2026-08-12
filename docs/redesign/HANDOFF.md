# Handoff: Orynthia Redesign — Variante A („Kommandozentrale")

## Überblick

Redesign der Orynthia-Weboberfläche (`rxf-sys/Orynthia`, `packages/frontend`). Der Auftrag hatte zwei Teile:

1. **Semantisches Farbsystem einführen.** Im Bestand kommt Farbe aus dem Serien- oder Kategorieindex (`Dashboard.tsx`: `Einnahmen = var(--pos)`, `Ausgaben = var(--indigo)`; `CATEGORY_PALETTE` enthält Grün `#1f8a5b` und Rot-Pink `#e76b8d`). Nach dem Redesign leitet sich Statusfarbe **immer aus dem Datenwert** ab, kategoriale Skalen sind wertfrei.
2. **Kühlere, sattere Akzente.** Der Peach-Gradient (`--peach #fda481`) tritt zurück, neuer Primärakzent ist Violett → Azur.

Es wurden drei Navigations-/Layoutvarianten gebaut. **Der Nutzer hat sich für Variante A entschieden — nur diese ist umzusetzen.** B und C liegen im Prototyp weiterhin bei und dienen als Kontext, nicht als Auftrag.

## Zu den Design-Dateien

Die Datei in diesem Bundle ist eine **Design-Referenz in HTML** — ein Prototyp, der Aussehen und Verhalten zeigt, **kein Produktionscode zum Kopieren**. `Orynthia Redesign.dc.html` nutzt ein hauseigenes Prototyping-Runtime (`support.js`, `<x-dc>`-Template + `class Component`); das ist bewusst kein React-Code und soll **nicht** portiert werden.

Zielumgebung ist die bestehende App: **React 18 + TypeScript + Vite + Tailwind CSS**, Struktur `packages/frontend/src/features/<modul>/pages/*.tsx`, UI-Bausteine in `src/components/ui/*`, Tokens in `src/index.css` + `tailwind.config.ts`, Charts mit **Recharts**. Aufgabe ist es, die im Prototyp gezeigten Screens **mit diesen vorhandenen Mitteln nachzubauen** — Tailwind-Klassen statt Inline-Styles, die bestehenden `Card`/`Btn`/`Tag`/`Progress`-Komponenten statt neuer Einzelfälle, `lucide-react` statt des im Prototyp handgezeichneten Icon-Sets.

## Fidelity

**High-fidelity.** Farben, Typo, Abstände, Radien und Zustände sind final und unten exakt dokumentiert. Die Umsetzung soll pixelnah sein, aber über die bestehenden Tailwind-Tokens und UI-Komponenten laufen — neue Hex-Werte gehören in `index.css`/`tailwind.config.ts`, nicht in einzelne Komponenten.

---

## 1. Design-Tokens

### 1.1 Farb-Tokens (CSS-Variablen, beide Themes vollständig)

Im Prototyp heißen sie `--o-*`. **Für die Umsetzung die bestehenden Namen aus `src/index.css` behalten** und nur die Werte ersetzen; die Zuordnung steht in der rechten Spalte.

| Rolle | Dark | Light | Bestands-Token in `index.css` |
|---|---|---|---|
| Seitenhintergrund | `#0f1118` | `#f3f4f8` | `--bg` (war `#121424` / `#f4f1ee`) |
| Bühne / hinter dem Rahmen | `#08090d` | `#e7e9f0` | neu (nur im Mockup-Rahmen nötig) |
| Karte | `#171a24` | `#ffffff` | `--bg-elev` (war `#1b1f33` / `#fff`) |
| Erhöhte Fläche, Chip, Inputfeld | `#1e2231` | `#f6f7fb` | neu: `--bg-elev-2` |
| Linie / Rahmen | `#272c3c` | `#e3e5ec` | `--line` |
| Leise Linie (Listentrenner) | `#20242f` | `#edeef4` | neu: `--line-2` |
| Text primär | `#eef0f6` | `#171a24` | `--text-1` |
| Text sekundär | `#c4cadc` | `#414b68` | `--text-2` |
| Text tertiär (Labels) | `#8a92ab` | `#737d99` | `--text-3` |
| Text quartär (Hinweise) | `#5c6480` | `#9aa0b4` | neu: `--text-4` |
| **Akzent primär (Violett)** | `#7c5cff` | `#6a48f5` | neu: `--violet` |
| **Akzent sekundär (Azur)** | `#2f7dff` | `#1e6ef0` | neu: `--azure` |
| Status ok | `#22c58a` | `#12855c` | `--pos` |
| Status warnung | `#f0a93a` | `#a86c0c` | `--warn` |
| Status kritisch | `#f2596b` | `#c01a2f` | `--neg` |
| Status info | `#5d96ef` | `#2a6fdb` | `--info` |
| Status inaktiv | `#5c6480` | `#9aa0b4` | neu: `--idle` |

**Weiterhin gültige Bestands-Tokens:** `--indigo #37415c` und `--navy #181a2f` bleiben als Struktur-/Textfarben. `--peach #fda481` bleibt im Token-Set, wird aber **nur noch** für „Neu"/„Beta"-Badges und die Streak-Flamme benutzt — nicht mehr als Flächen- oder Gradient-Akzent.

**Achtung Light-Theme:** Das warme Off-White `#f4f1ee` muss auf das neutrale `#f3f4f8` wechseln. Gegen die kühlen Akzente wirkt der Warmton schmutzig — das ist keine Geschmacksfrage, sondern der Grund, warum Light sonst bricht.

### 1.2 Markenverlauf

```css
--grad-brand: linear-gradient(135deg, #7c5cff, #2f7dff);
```

Ersetzt den bisherigen Indigo→Peach-Verlauf. Verwendung: Primärbuttons, Avatar-Fallback, Markenzeichen, aktive Rail-Pills. Immer mit dem Schlagschatten `0 4px 14px rgba(124, 92, 255, 0.35)` (nur bei Primärbuttons und dem Markenzeichen, nicht bei Flächen).

### 1.3 Kategoriale Skala (wertfrei)

Ersetzt `CATEGORY_PALETTE` in `src/lib/categoryColors.ts` **und** die duplizierten `cat-1…8` in `tailwind.config.ts` (beide Stellen müssen gleichzeitig geändert werden, sonst driften sie auseinander):

```
#7c5cff  #2f7dff  #3aa3a5  #8a92ab  #b97aff  #4d6bd8  #5f7f9c  #6f5aa8
```

Kein Grün, kein Rot — damit in einem Kategorie-Donut oder einer Depot-Allokation keine Bewertung mitgelesen wird. „Sonstige"-Segmente bekommen `--text-4` statt einer Skalenfarbe.

### 1.4 Typografie

| Rolle | Familie | Größe | Gewicht | Sonstiges |
|---|---|---|---|---|
| Display / Seitentitel | Instrument Serif, *italic* | 32 px (Modulseiten), 52 px (Home-Begrüßung, mobil 34 px) | 400 | `line-height: 1.02–1.1`, `letter-spacing: -.02em` |
| Große Kennzahl | Inter | 66 px (Home-Hero, mobil 38 px) | 800 | `letter-spacing: -.035em`, `line-height: 1.02`, `tabular-nums` |
| Kennzahl Karte | Inter | 20–32 px | 700–800 | `tabular-nums` |
| Abschnittsüberschrift | Inter | 13 px | 700 | `letter-spacing: .1em`, `text-transform: uppercase`, Farbe `--text-3` |
| Kartentitel | Inter | 16 px | 700 | — |
| Body | Inter | 13–15 px | 400–500 | `line-height: 1.55–1.65`, `text-wrap: pretty` |
| Tabellenkopf / Label | Inter | 10–11 px | 700 | `letter-spacing: .06–.09em`, uppercase, `--text-3` |
| Metazeile | Inter | 11–12 px | 400–600 | `--text-3` |
| Statuspille | Inter | 11 px | 700 | — |

Beide Familien sind im Bestand schon eingebunden (`.h-display` nutzt Instrument Serif italic). **Alle Geldbeträge, Prozente und Zählwerte brauchen `font-variant-numeric: tabular-nums`** — im Bestand gibt es dafür die `tnum`-Utility.

### 1.5 Abstände, Radien, Schatten

Abstandsskala (px): `2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 26 · 34 · 44`

| Rolle | Wert |
|---|---|
| Radius Pille / Chip / Ring | `999px` |
| Radius klein (Icon-Fläche, Badge, Feld) | `6–10px` |
| Radius Karte innen (Kachel in Karte) | `12–15px` |
| Radius Karte | `16px` (Modulseiten), `20px` (Home-Karten), `22px` (Home-Hero) |
| Radius Markenzeichen | `7px` bei 36 px, `5px` bei 28 px (≈18,75 % — abgeleitet aus `public/icon.svg`, `rx="96"` bei `512`) |
| Kartenpolster | `26px` Desktop / `18px` mobil (Home), `16–20px` (Modulseiten) |
| Hero-Polster | `34px` Desktop / `20px` mobil |
| Abstand zwischen Home-Abschnitten | `44px` |
| Abstand zwischen Karten im Raster | `20px` (Home), `12–14px` (Modulseiten) |
| Seitenpolster `main` | `30px 36px 56px` Desktop, `14px 12px 8px` mobil |
| Schatten Primärbutton | `0 4px 14px rgba(124,92,255,.35)` |
| Schatten Overlay / Palette | `0 30px 80px rgba(0,0,0,.6)` |
| Schatten Tooltip | `0 10px 28px rgba(0,0,0,.4)` |
| Übergänge | `300ms`, dazu `prefers-reduced-motion`-Guard (im Bestand vorhanden) |

---

## 2. Das Farbsystem als Regelwerk

Das ist der inhaltliche Kern des Redesigns. Wer nur die Hex-Werte tauscht, hat den Auftrag nicht erfüllt.

### 2.1 Drei getrennte Farbachsen

| Achse | Wofür | Regel |
|---|---|---|
| **Status** | ok / warnung / kritisch / info / inaktiv | Wird **aus dem Datenwert berechnet**, nie aus einem Index. Sitzt auf **Fläche + Icon**. |
| **Kategorial** | Ausgabenkategorien, Depot-Allokation, Kontokürzel | Wertfreie 8er-Skala, **kein Grün/Rot**. Rein zur Unterscheidung. |
| **Nutzerfarbe** | Kalenderfarbe, Gewohnheitsfarbe, Notizfarbe | Vom Nutzer gewählt. Sitzt **ausschließlich auf einer Kante** (`border-left: 3–4px`) oder einem 8-px-Punkt. |

Weil Status auf Flächen sitzt und Nutzerfarben nur auf Kanten, kollidieren sie nicht — auch wenn jemand seine Kalenderfarbe auf Rot stellt.

### 2.2 Statusableitung (verbindlich)

```ts
type StatusKind = 'ok' | 'warn' | 'crit' | 'info' | 'idle';

// Budget: Prozent verbraucht
budgetStatus = (pct: number) => pct > 100 ? 'crit' : pct > 80 ? 'warn' : 'ok';

// Liquiditätsprognose: gegen die Puffergrenze, nicht gegen Null
forecastStatus = (balance: number, buffer = 500) =>
  balance < 0 ? 'crit' : balance < buffer ? 'warn' : 'ok';

// Depot-Position: Gewinn/Verlust je Position (nicht je Serie)
positionStatus = (gain: number) => gain >= 0 ? 'ok' : 'crit';

// Monatssaldo im Cashflow: Einnahmen minus Ausgaben dieses Monats
monthStatus = (net: number) => net >= 0 ? 'ok' : 'crit';

// Frist (Vertrag, Dokument, wiederkehrende Zahlung)
dueStatus = (days: number) => days <= 5 ? 'warn' : days <= 60 ? 'info' : 'ok';

// Aufgabe
taskStatus = (due: Date, now: Date) => due < now ? 'crit' : isToday(due) ? 'info' : 'idle';
```

Jeder Status trägt **Farbe + Icon + Textlabel**:

| Kind | Farbe | Icon (lucide) | Standardlabel |
|---|---|---|---|
| `ok` | `--pos` | `CheckCircle2` | „Im Plan" |
| `warn` | `--warn` | `AlertTriangle` | „Knapp" |
| `crit` | `--neg` | `AlertCircle` | „Überzogen" |
| `info` | `--info` | `Info` | „Info" |
| `idle` | `--idle` | `Ban` | „Inaktiv" |

Labels sind kontextabhängig überschreibbar („Überfällig", „Frist läuft", „Ungenutzt", „Pass prüfen").

**Tint-Formel für Statusflächen:** `color-mix(in oklab, <statusfarbe> 16%, transparent)`, Rahmen dazu `color-mix(in oklab, <statusfarbe> 35–40%, transparent)`. Bei Tailwind entweder als CSS-Variable-Utility oder über `/16`-Opacity-Syntax lösen.

### 2.3 Nie nur Farbe

- **Überzogene Balken werden zusätzlich schraffiert:** `repeating-linear-gradient(45deg, <neg> 0 6px, color-mix(in oklab, <neg> 55%, #000) 6px 12px)`.
- **Prognostizierte Werte gestrichelt:** `stroke-dasharray="6 4"`.
- **Puffergrenze gestrichelt** (`5 5`, in `--warn`), **Nulllinie durchgezogen** (in `--neg`).
- Jede Statuspille hat Icon **und** Text, nie nur einen Farbpunkt.

### 2.4 Was sich gegenüber dem Bestand konkret ändert

| Stelle im Repo | Vorher | Nachher |
|---|---|---|
| `features/finance/pages/Dashboard.tsx` — Cashflow-`BarChart` | `Einnahmen = var(--pos)`, `Ausgaben = var(--indigo)` — Farbe pro Serie | Einnahmen `--text-2`, Ausgaben `--text-4`; **Farbe erscheint nur am Monatssaldo** und als Schraffur, wenn der Monat negativ ist |
| `features/finance/pages/Dashboard.tsx` — Kategorie-`PieChart` | `CATEGORY_PALETTE` mit Grün + Rot-Pink | wertfreie 8er-Skala, „Sonstige" in `--text-4` |
| `features/finance/components/ForecastCard.tsx` | `ReferenceLine y={0}`, keine Risikomarkierung; **Bug:** `tick={{ fill: 'var(--ink-3)' }}` — Token heißt `--text-3`, Achsen erben Default | Nulllinie **und** Puffergrenze 500 €, Risikoband als Fläche, Tiefstwert benannt, Prognose gestrichelt; Tick-Token korrigieren |
| `features/finance/pages/Budgets.tsx` — `Progress` | `color={over ? 'var(--neg)' : cat.color}` — unter 100 % gewinnt die Kategoriefarbe, Status geht verloren | Balken **immer** in der Statusfarbe, Kategoriefarbe wandert auf das Icon; zusätzlich Referenzmarke für den erwarteten Monatsverlauf |
| Kontosalden (`Accounts.tsx`) | negativer Saldo rot | Darlehen/Kredit **neutral** in `--text-2` mit Hinweis „planmäßig, keine Wertung" — Rot bleibt Unterdeckung und Budgetüberzug vorbehalten |
| Depot (`Investments.tsx`) | Inline-Ternaries pro Zeile | `positionStatus(gain)` pro Position, Allokations-Donut wertfrei |

### 2.5 Neu: erwarteter Monatsverlauf als Referenz

Überall, wo ein Monatsbudget dargestellt wird, wird zusätzlich die **Pace** eingezeichnet:

```ts
const pace = Math.round(dayOfMonth / daysInMonth * 100); // am 11.08.2026 → 35 %
```

- Im Balken als 2 px senkrechte Marke in `--text-2` bei `left: {pace}%`, 3 px über und unter den Balken hinausragend.
- Im Ring als dünner Innenring (`r=20.5`, `stroke-width 1.5`, `--text-4`).
- Als Text: „erwartet wären 35 %" bzw. „schneller als der Monat".

Ohne diese Referenz ist „87 % verbraucht" nicht interpretierbar — am 11. des Monats ist das viel, am 28. wenig.

---

## 3. Layout & Shell (Variante A)

```
┌──────────────────────────────────────────────────────────────┐
│ [Offline-Banner, nur wenn offline]                           │
├──────┬───────────┬───────────────────────────────────────────┤
│ Rail │ Modul-    │ Header (sticky)                           │
│ 64px │ Panel     ├───────────────────────────────────────────┤
│      │ 214px     │ [Benachrichtigungs-Inbox, aufklappbar]    │
│      │ (klappt)  │                                           │
│      │           │ main                                      │
└──────┴───────────┴───────────────────────────────────────────┘
```

### 3.1 Icon-Rail (64 px, `flex: 0 0 auto`)

- Hintergrund `--bg-elev`, rechts `1px solid --line`, Polster `14px 0`, `gap: 6px`, zentriert.
- Oben das Markenzeichen: 36 × 36 px, `border-radius: 7px`, Verlauf, weißes „O" in 16 px/800, darunter 8 px Abstand.
- Fünf Gruppen-Buttons à 40 × 40 px, `border-radius: 12px`, Icon 19 px:
  **Home** (`Home`) · **Finanzen** (`Wallet`) · **Zeit** (`Calendar`) · **Haushalt** (`ChefHat`) · **Mehr** (`MoreHorizontal`)
- Aktiv: Fläche `color-mix(in oklab, var(--violet) 18%, transparent)`, Icon `--violet`, plus 3 × 20 px Marke in `--violet` links außen (`left: -12px`, vertikal zentriert, `border-radius: 999px`).
- Unten ein Umschalter für das Panel (`PanelLeft`, 40 × 40, `--text-3`).

### 3.2 Modul-Panel (214 px, klappbar)

- Polster `14px 10px`, `gap: 2px`, eigenes Scrollen.
- Kopfzeile = Gruppenname, 10,5 px/700, `letter-spacing: .09em`, uppercase, `--text-3`, Polster `4px 10px 8px`.
- Einträge: Höhe über Polster `8px 10px`, `border-radius: 10px`, 13,5 px, Icon 16 px in `--text-3`, `gap: 10px`.
  Aktiv: Fläche `--bg-elev-2`, Rahmen `1px solid --line`, Text `--text-1`, Gewicht 650, Icon `--violet`.
- Badges „Neu"/„Beta": 10 px/800, Polster `2px 6px`, `border-radius: 999px`, **Peach `#fda481` auf Navy `#181a2f`** — die einzige verbleibende Peach-Verwendung neben der Streak-Flamme.
- Fuß: Nutzer-Chip, `border-radius: 12px`, Rahmen `--line`, Polster 9 px, Avatar 30 × 30 px mit Verlauf und Initialen, daneben Name 12,5 px/600 und E-Mail 10,5 px `--text-3`, beide mit `text-overflow: ellipsis`.
- **Wichtig:** Hat die aktive Gruppe nur ein Modul (Home), wird das Panel **automatisch eingeklappt** — sonst steht dort eine leere Spalte.

### 3.3 Header (sticky, `z-index: 20`)

- Höhe über Polster `13px 22px`, unten `1px solid --line`, Hintergrund `color-mix(in oklab, var(--bg-elev) 88%, transparent)` + `backdrop-filter: blur(10px)`.
- **Suchfeld/⌘K-Trigger:** `flex: 1 1 0`, `min-width: 210px`, `max-width: 420px`, `border-radius: 999px`, Fläche `--bg-elev-2`, Rahmen `--line`, Polster `9px 14px`, Lupe 16 px, Text 13,5 px `--text-3`, rechts Tastenkappe „⌘K" (11 px, Polster `2px 7px`, `border-radius: 6px`, Rahmen `--line`).
- **Primärbutton „Neu erfassen":** Verlauf, weiß, 13,5 px/700, Polster `10px 18px`, `border-radius: 12px`, Plus-Icon 16 px, `flex: 0 1 auto` (darf vor dem Suchfeld schrumpfen).
- **Icon-Buttons** 38 × 38 px, `border-radius: 11px`, Rahmen `--line`, Fläche `--bg-elev-2`, `flex: 0 0 auto`: Assistent (`MessageSquare`), Benachrichtigungen (`Bell`).
- **Zähler-Badge** auf der Glocke: min. 17 × 17 px, `--neg`, weiß, 10 px/800, `border-radius: 999px`, 2 px Rahmen in `--bg-elev` (damit er sich vom Button abhebt), Position `top: -3px; right: -3px`.
- **Avatar** 38 × 38 px, `border-radius: 999px`, Verlauf, Initialen 12,5 px/700.
- Mobil: statt Suchfeld und Primärbutton nur Markenzeichen + Seitentitel links, rechts Lupe, Glocke, Avatar.

### 3.4 Mobile Tabbar (sticky unten)

Fünf Tabs, `justify-content: space-around`, Polster `8px 4px 12px`, Fläche `--bg-elev`, oben `1px solid --line`. Je Tab Icon 19 px + Label 10,5 px/600, Mindestbreite 56 px, Polster `6px 8px` — **Trefferfläche mindestens 44 px hoch**. Aktiv `--violet`, sonst `--text-3`.
Tabs: Home · Finanzen · Kalender · Aufgaben · Mehr (→ Sheet mit den restlichen 17 Modulen).

### 3.5 Kommandopalette (⌘K)

Overlay `rgba(6,7,11,.66)` + `blur(3px)`, Dialog `min(620px, 92vw)`, oben `12vh` Abstand, `border-radius: 16px`, Fläche `--bg-elev`, Rahmen `--line`, Schatten `0 30px 80px rgba(0,0,0,.6)`, Einblendung `o-fade 180ms ease-out`.
Kopf: Lupe, Eingabe 14,5 px, blinkender 1 px Cursor in `--violet` (`o-pulse 1.2s infinite`), rechts „ESC"-Kappe.
Ergebnisse gruppiert nach Quelle (Rezepte, Seiten, Transaktionen), Gruppentitel 10,5 px/700 uppercase `--text-4`. Zeile: 26 × 26 px Icon-Fläche, Label 13,5 px, rechts Hinweistext 11,5 px `--text-4`; Hover `--bg-elev-2`.

### 3.6 Offline-Banner

Volle Breite über allem, Polster `7px 12px`, zentriert, 12,5 px/600, Fläche `color-mix(in oklab, var(--warn) 18%, transparent)`, unten `1px solid color-mix(in oklab, var(--warn) 35%, transparent)`, Text `--warn`, Icon `WifiOff`. Text: „Offline — zuletzt geladener Stand. Änderungen sind gesperrt." Im Bestand existiert `OfflineBanner.tsx`.

---

## 4. Home (der Screen mit der meisten Arbeit)

Container `max-width: 1180px`, zentriert, `display: flex; flex-direction: column; gap: 44px`, Polster `14px 0 36px`.
Aufbau von oben: **Begrüßung → Hero → Was heute zählt → Geld → Dein Tag → Haushalt**.

### 4.1 Begrüßung

`flex`, `align-items: flex-end`, `justify-content: space-between`, `gap: 24px`, umbrechend.
Links „Hallo Felix" in Instrument Serif italic 52 px (mobil 34 px), `line-height: 1.02`, `letter-spacing: -.025em`; darunter 10 px Abstand, Untertitel 15 px `--text-3`, `line-height: 1.6`, `max-width: 520px`.
Rechts sekundärer Button „Widgets anpassen" (Rahmen `--line`, Fläche `--bg-elev`, 12,5 px/600, Polster `10px 16px`, `border-radius: 11px`).

### 4.2 Hero-Karte

`border-radius: 22px`, Fläche `--bg-elev`, Rahmen `--line`, Polster 34 px (mobil 20 px), `position: relative; overflow: hidden`.
**Lichtschein:** absolut positioniert, `inset: -70% -25% auto auto`, 520 × 520 px, `pointer-events: none`,
`background: radial-gradient(circle at center, color-mix(in oklab, var(--violet) 24%, transparent), transparent 64%)`.
Innen `display: grid; gap: 40px; grid-template-columns: repeat(auto-fit, minmax(min(330px,100%), 1fr)); align-items: start`.

**Linke Spalte:**
- Label „Nettovermögen über 3 Konten", 11,5 px/700, `letter-spacing: .09em`, uppercase, `--text-3`.
- Zahl 66 px/800 (mobil 38 px), `letter-spacing: -.035em`, `line-height: 1.02`, `tabular-nums`, 12 px Abstand nach oben.
- Delta-Pille: `inline-flex`, `gap: 7px`, Polster `7px 14px`, `border-radius: 999px`, 13 px/700, Fläche `color-mix(in oklab, var(--pos) 16%, transparent)`, Text `--pos`, Icon `TrendingUp` 14 px. Text „+676,40 € vs. Juli".
- Kennzahlenleiste: 34 px Abstand, 26 px Polster oben, `border-top: 1px solid --line`, `grid-template-columns: repeat(auto-fit, minmax(min(120px,100%),1fr))`, `gap: 22px 28px`. Je Eintrag Label 11 px/600 `--text-3` und Wert 20 px/700 `tabular-nums`. Vier Einträge: Girokonto `3.847,12 €` · Einnahmen `3.240,00 €` (in `--pos`) · Ausgaben `1.941,28 €` · Sparquote `40 %`.

**Rechte Spalte — Liquiditätschart (SVG, `viewBox="0 0 640 190"`, Höhe 200 px, `preserveAspectRatio="none"`):**
- Kopfzeile: „Liquidität, 60 Tage" links, rechts bei Risiko `AlertCircle` + „8 Risikotage" in `--neg`, beides 12 px/600.
- Ebenen von hinten nach vorn: Risikoband (`rect`, `color-mix(in oklab, var(--neg) 16%, transparent)`) → Puffergrenze (`line`, `--warn`, `stroke-dasharray="5 5"`) → Nulllinie (`line`, `--neg`, 1 px) → Fläche (`linearGradient` `--violet` 0.42 → 0) → Linie (`--violet`, 2,5 px, `stroke-dasharray="6 4"`) → Hover-Punkt (r 5, `--violet`, 2,5 px Rahmen in `--bg-elev`).
- Tooltip absolut bei `left: 52%; top: 8px`: Polster `9px 12px`, `border-radius: 11px`, Fläche `--bg-elev-2`, Rahmen `--line`, Schatten `0 10px 28px rgba(0,0,0,.4)`, Datum 10,5 px `--text-3` + Wert 14 px/700 `tabular-nums`.
- Legende darunter, 11,5 px `--text-3`, `gap: 16px`, umbrechend: Nulllinie (15 × 2 px Fläche) · Puffer 500 € (`border-top: 2px dashed`) · Risikotage (15 × 10 px Fläche). Darunter „Tiefstwert −107,24 € am 29.09.2026" in 12 px.

**Prognoserechnung** (im Prototyp `forecast(days)`, muss serverseitig oder aus echten Daten kommen): Startsaldo Girokonto, pro Tag Median −78,40 €, dazu terminierte Posten am Monatstag — 1. Miete −1.180 €, 2. Sonstiges −250 €, 4. Netflix −17,99 €, 5. KFZ-Rate −285 €, 8. Spotify −12,99 €, 15. Fitness −39,90 €, 20. Mobilfunk −29,99 €, 28. Sonstiges −8,50 €, 30. Gehalt +3.240 €, einmalig 12.09. Reisebudget −1.450 €.

### 4.3 Abschnittsköpfe

`flex`, `align-items: baseline`, `gap: 14px`, 18 px Abstand nach unten:
`<h2>` 13 px/700, `letter-spacing: .1em`, uppercase, `--text-3` → dehnbare 1-px-Linie in `--line` → optional rechts ein Textlink 12 px/700 in `--violet` mit `ArrowRight` 13 px („Finanzen öffnen", „Kalender öffnen").

### 4.4 „Was heute zählt" — Fokus-Band

`grid-template-columns: repeat(auto-fit, minmax(min(290px,100%),1fr))`, `gap: 14px`. Drei **klickbare** Karten:
Rahmen `1px solid <status-tint>`, links `3px solid <statusfarbe>`, `border-radius: 14px`, Fläche `--bg-elev`, Polster `16px 18px`, `align-items: flex-start`, `gap: 13px`.
Links 30 × 30 px Icon-Fläche (`border-radius: 10px`, Status-Tint, Status-Icon), rechts Titel 14 px/650 `line-height: 1.35` und Begründung 12,5 px `--text-3` `line-height: 1.55`, 4 px Abstand, beide `text-wrap: pretty`.

Inhalte (jeweils mit Ziel-Route):
1. **„Lebensmittel ist überzogen"** — „512,40 € von 450,00 € — 20 Tage bis zum Monatsende", `crit` → Budgets
2. **„2 Aufgaben überfällig"** — „älteste seit 06.08.2026 — Kfz-Versicherung vergleichen", `crit` → Aufgaben
3. **„ING-Consent läuft am 14.08. ab"** — „ohne neue Autorisierung stoppt der Kontoabgleich", `warn` → Konten

Das Band ist datengetrieben: es zeigt die höchstpriorisierten offenen Statusmeldungen, nicht drei feste Karten.

### 4.5 „Geld"

`grid-template-columns: repeat(auto-fit, minmax(min(330px,100%),1fr))`, `gap: 20px`.

**Budget-Karte** (`grid-column: 1 / -1` — nie `span 2`, sonst entsteht im einspaltigen Fall eine Phantomspalte):
Kopf „Budgets" 16 px/700 mit `Target` 16 px, rechts 12 px „Am 11. des Monats erwartet: **35 %**".
Erklärsatz 12,5 px `--text-3`, `max-width: 560px`: „Der äußere Ring ist der Verbrauch, der dünne innere Ring der erwartete Monatsverlauf — steht der äußere davor, gibst du schneller aus als geplant."
Darunter `grid-template-columns: repeat(auto-fit, minmax(min(122px,100%),1fr))`, `gap: 16px`. Je Budget eine Kachel: Polster `16px 8px`, `border-radius: 15px`, Fläche `--bg-elev-2`, zentriert, `gap: 9px`.
- Ring: 84 × 84 px, SVG `viewBox="0 0 64 64"`, `transform: rotate(-90deg)`. Spurkreis `r=26`, `stroke-width 6`, `--line`. Verbrauchsbogen `r=26`, `stroke-width 6`, `stroke-linecap: round`, Statusfarbe, `stroke-dasharray` aus `min(pct,100)` von `2π·26 ≈ 163.4`. Pace-Innenring `r=20.5`, `stroke-width 1.5`, `--text-4`, `opacity .9`.
- Zentriert darin die Prozentzahl 14 px/800 `tabular-nums` in Statusfarbe.
- Darunter Kategoriename 12 px/600 mit Emoji, `max-width: 110px`, `ellipsis`; Statuspille 10,5 px/700; Restbetrag 11 px `--text-3` („noch 351,10 €" / „62,40 € drüber").

Sechs Budgets: Lebensmittel 512,40/450 (114 %, `crit`) · Restaurant & Lieferdienst *mit sehr langem Kategorienamen* 98,30/120 (82 %, `warn`) · Transport 86,40/200 (43 %, `ok`) · Shopping 148,90/150 (99 %, `warn`) · Freizeit 38,00/100 (38 %, `ok`) · Abos 57,48/60 (96 %, `warn`).

**Sparziele-Karte:** Kopf + „Öffnen"-Link. Je Ziel: Name 13,5 px/600 mit `ellipsis` und Prozent 12,5 px/700 in Zielfarbe; Balken 8 px, `border-radius: 999px`, Spur `--bg-elev-2`; darunter „1.680,00 € von 2.400,00 €" und Frist, 11,5 px `--text-3`, `space-between`. Farbe: `--pos` bei ≥ 100 %, sonst `--violet` (Sparziele sind kein Statusfall — nur „erreicht" ist einer).
Drei Ziele: Urlaub Andalusien 1.680/2.400 (bis 01.09.2026) · Notgroschen 6.000/6.000 (erreicht) · E-Bike 420/2.800 (bis 01.06.2027).

**Fixkosten-Karte:** Kopf mit `FileText`. Summe 32 px/800 `tabular-nums` („289,37 €"), darunter 12 px „pro Monat · 4 Verträge · 1 pausiert". Nach `border-top` zwei Fristzeilen à 12,5 px: 22 × 22 px Status-Icon-Fläche, Name (`ellipsis`), rechts Frist 11,5 px/600 in Statusfarbe. Mobilfunk Telekom „kündbar bis 30.09.2026" (`warn`), Haftpflicht HUK „kündbar bis 30.11.2026" (`ok`).

### 4.6 „Dein Tag"

**Termine-Karte** (`grid-column: 1 / -1`):
Kopf „Termine & Fristen" mit `Calendar`, rechts eine **Wochenauslastung**: sieben Säulen à 26 px Breite, `align-items: flex-end`, `gap: 9px`, umbrechend. Höhe `14 + last·15` px, Radius 5 px; heute in `--violet`, Tage mit ≥ 3 Einträgen in `color-mix(in oklab, var(--violet) 45%, transparent)`, sonst `--bg-elev-2`. Darunter Kürzel 10 px/700.
Terminliste: je Zeile Polster `13px 0`, unten `1px solid --line-2`, `gap: 14px`; links 4 px breite, über die Zeilenhöhe gestreckte Kante in der **Kalenderfarbe des Nutzers** (`border-radius: 999px`), Titel 14 px/600 mit `ellipsis`, rechts `Clock` 13 px + Zeitangabe 12 px `--text-3`.
Fußnote 11,5 px `--text-4`: „Die farbige Kante ist die Kalenderfarbe des Nutzers — nie ein Status."
Vier Termine: Zahnarzt Dr. Weiß (Heute · 14:30) · Elternabend Grundschule (Mi 12.08. · 19:00) · Linsen-Bolognese kochen (Mi 12.08. · Abendessen) · Steuerunterlagen einreichen (Fr 14.08. · ganztägig).

**Aufgaben-Karte:** drei Zählkacheln (`grid-template-columns: repeat(3,1fr)`, `gap: 12px`), je Polster `18px 6px`, `border-radius: 14px`, Fläche `--bg-elev-2`, Zahl 32 px/800 `line-height: 1`, Label 10,5 px/700 uppercase `--text-3` mit 8 px Abstand. Werte: Offen **9** (`--text-1`), Heute **3** (`--info`), Überfällig **2** (`--neg`).
Darunter Warnzeile: Polster `12px 14px`, `border-radius: 12px`, Fläche `color-mix(in oklab, var(--neg) 12%, transparent)`, Text `--neg` 12,5 px/600 — „Älteste überfällige Aufgabe seit 06.08.2026".

**Gewohnheiten-Karte:** Streak-Zeile: `Flame` 14 px + „12 Tage" in 15 px/700 **Peach `#fda481`**, daneben „4/5 heute erledigt" 12,5 px `--text-3`.
Raster: `grid-template-columns: repeat(14, 1fr)`, `gap: 5px`, 28 Zellen `aspect-ratio: 1`, `border-radius: 4px`. Erfüllt: `color-mix(in oklab, var(--pos) 50–92%, transparent)` (Intensität nach Erfüllungsgrad), nicht erfüllt `--bg-elev-2`. Fußnote „Vier Wochen · dunkler heißt mehr erledigt".

### 4.7 „Haushalt"

**Listen-Karte:** je Zeile Emoji 16 px, Name (`ellipsis`), rechts Offenzahl 12 px `--text-3` `tabular-nums`. „Einkauf Woche 33 · 11 offen", „Packliste Andalusien · 6 offen", „Baumarkt · leer". Unten gestrichelter Button („Liste anlegen"), `margin-top: auto`.

**Reise-Karte:** Titel 17 px/650 `line-height: 1.4` `text-wrap: pretty` — „Andalusien mit den Kindern (Sevilla, Córdoba, Cádiz)". Darunter „12.09.2026 – 22.09.2026 · Budget 2.400,00 €" 12,5 px `--text-3`. Info-Pille „in 32 T" (`--info`-Tint). Fußzeile nach `border-top`, `margin-top: auto`, 12 px `--text-4`: „Noch keine Verknüpfungen — Termine, Packliste oder Notizen zuordnen."

**„Der Fluss der Woche":** Titel 16 px/700, Erklärsatz 12,5 px `--text-3`. Vier Schritte als gestapelte Zeilen (`gap: 9px`): Polster `13px 15px`, `border-radius: 13px`, Fläche `--bg-elev-2`, links 32 × 32 px Icon-Fläche (`border-radius: 10px`, `color-mix(in oklab, var(--violet) 18%, transparent)`, Icon `--violet`), rechts Label 10,5 px/700 uppercase `--text-3` und Wert 13 px/600.
Rezept „Linsen-Bolognese" → Wochenplan „Mi, Abendessen · 4 P." → Einkaufsliste „9 Zutaten übernommen" → Ausgabe „−47,83 € · Lebensmittel".

---

## 5. Modulseiten

Alle 20 Module sind im Prototyp gebaut. Gemeinsames Muster:

**Seitenkopf:** `flex`, `align-items: flex-end`, `space-between`, `gap: 12px`, umbrechend. Links Titel in Instrument Serif italic 32 px + Metazeile 13 px `--text-3`; rechts Aktionen (sekundär: Rahmen `--line`, Fläche `--bg-elev`, 12,5 px/600, Polster `9px 14px`, `border-radius: 11px` — primär: Verlauf, weiß, `9px 15px`). Im Bestand existiert `PageHead.tsx`.

**Kennzahlenreihe:** `repeat(auto-fit, minmax(200px,1fr))`, `gap: 12px`. Karte: `border-radius: 16px`, Polster 16 px, Label 11 px/700 uppercase `--text-3`, Wert 26 px/800 `tabular-nums`, Fußnote 11,5 px `--text-3`. Statusrelevante Kacheln bekommen Tint-Fläche + farbigen Rahmen (z. B. „Überzogen: 1" in `--neg`).

**Filterpillen:** 12 px/700, Polster `7px 14px`, `border-radius: 999px`. Aktiv `--violet` mit weißem Text; inaktiv transparent mit Rahmen `--line` und `--text-2`.

**Listen/Tabellen:** Container `border-radius: 16px`, Fläche `--bg-elev`, Rahmen `--line`, `overflow: hidden`. Zeile: Polster `13px 16px`, unten `1px solid --line-2`, `gap: 13px`; links 36 × 36 px Icon-Fläche in `color-mix(in oklab, <kategoriefarbe> 18%, transparent)`, Mitte Titel 13,5 px/600 + Metazeile 11,5 px `--text-3` (beide `ellipsis`), rechts Datum 11,5 px `--text-4` und Betrag 14 px/700 `tabular-nums` rechtsbündig mit fester Mindestbreite 110 px.

Modulspezifisch, kurz:

| Modul | Kernpunkte |
|---|---|
| **Finanzen · Übersicht** | 4 Kennzahlen; Cashflow-Balken (6 Monate, Farbe nur am Monatssaldo, Schraffur bei Minus); Kategorie-Donut (`r=54`, `stroke-width 17`, wertfrei) mit Legende inkl. Prozent und Betrag; Liquiditätsvorschau mit 30/60/90-Umschalter, 4 Kennzahlen, Risiko-Schraffurmuster (`<pattern>` 8 × 8, 45°) und Erklärbanner zur Ursache; Kontenkarten mit Consent-Warnung |
| **Transaktionen** | Filterzeile mit Suchfeld + Alle/Einnahmen/Ausgaben; Liste wie oben; Einnahmen in `--pos`, Ausgaben neutral |
| **Konten** | Consent-Banner (`warn`) über der Liste; 3 Karten; **negativer Darlehenssaldo neutral** mit Erklärsatz; Fußtext zur Farbregel |
| **Budgets** | 4 Kennzahlen inkl. Monatsverlauf; Filterpillen mit Zählern; Karten mit Statuspille, Balken **plus Pace-Marke**, Prozent, Restbetrag und Einordnung („schneller als der Monat") |
| **Sparziele** | 3 Karten mit Balken, Prozent, Zieldatum, „Einzahlen"-Button |
| **Depot** | Kennzahlkopf mit G/V-Pille; Positionstabelle (Kategoriefarbe als 8 × 28 px Kante, Kurs/Wert/G-V rechtsbündig, Status **pro Position**); Allokations-Donut wertfrei |
| **Wiederkehrend** | Liste mit Status-Icon-Fläche, Rhythmus, nächster Fälligkeit, „in n Tagen" (`warn` ab ≤ 5 Tagen) |
| **Verträge & Abos** | Erkennungsbanner (`info`) „Aus Transaktionen erkannt … als Vertrag übernehmen?"; Karten mit Statuspille, Monats-/Jahresbetrag, Kündigungsfrist; pausierter Vertrag als `idle` |
| **Sparpotenzial** | 3 Kennzahlen (Fixkosten, Abos, Potenzial in `--pos`-Tint); Wechselchancen mit Ersparnis; „Kategorien über deinem Durchschnitt" gegen den eigenen 6-Monats-Median |
| **Kalender** | Monatsraster 7 × 6, Zellen `min-height: 78px`, `min-width: 0; overflow: hidden`; heute mit `--violet`-Tint; Termine als 10,5 px Chips mit 3 px Kante in Kalenderfarbe; Kalender-Legende als Pillen (inkl. schreibgeschütztem ICS-Abo) |
| **Aufgaben** | Drei Gruppen (Überfällig `crit`, Heute `info`, Später `idle`) mit getönter Gruppenkopfzeile; Zeilen mit 19 px Checkbox (2 px Rahmen `--text-4`), Titel, Fälligkeit, Priorität, Statuspille |
| **Gewohnheiten** | Zeile je Gewohnheit: 4 px Kante in Nutzerfarbe, Name + Ziel, Streak mit `Flame`, 28-Tage-Raster, Statuspille; archivierte Gewohnheit in `idle`-Grau |
| **Rezepte** | Filterpillen; Kartenraster mit **Bildplatzhalter** (diagonal gestreift, Beschriftung „Rezeptfoto"), Titel, Zeit/Ernährung/Mahlzeit, „In Wochenplan" |
| **Wochenplan** | Raster `88px + 7 × minmax(120px,1fr)`, `min-width: 760px` mit horizontalem Scrollen; Zeilen = Frühstück/Mittag/Abend/Snack; belegte Slots als Fläche, freie gestrichelt; Primärbutton „Zutaten in Einkaufsliste" **startet die Kette** |
| **Listen** | Erfolgsbanner nach Übernahme („9 Zutaten … gleichnamige Einträge zusammengeführt"); Einträge mit Checkbox, Durchstreichung, Herkunfts-Chip („aus Rezept" / „manuell"); Seitenspalte mit weiteren Listen und **leerem Zustand** für „Baumarkt" |
| **Notizen** | Karten mit 4 px Kante in Nutzerfarbe, „angepinnt"-Chip, Body 12,5 px, `#tag`-Chips; Notiz ohne Titel zeigt „Ohne Titel" |
| **Reisen** | Kopf mit Ort/Zeitraum und Reisebudget (mit Hinweis „Planungsgröße, kein Konto"); **leerer Verknüpfungszustand** mit zwei Aktionen |
| **Dokumente** | Liste mit Schloss-Icon, Dateiname, Gültigkeitspille (`warn` bei ablaufendem Pass, `idle` ohne Ablauf); Hinweis „AES-256-GCM · Download nur über die Sitzung" |
| **KI-Assistent** | Chatverlauf: Nutzerblase mit Verlauf und `border-radius: 14px 14px 4px 14px`, Antwortblase in `--bg-elev-2` mit Bot-Avatar; Antwort nennt konkrete Zahlen und hebt kritische Werte in `--neg` hervor |
| **Einstellungen** | Zwei Karten (Benachrichtigungen, Sicherheit); Toggle 40 × 23 px, Knopf 17 px, an = `--violet`, aus = `--line`; Regeltexte als Fußzeilen („ab 80 % und bei Überzug, täglich 08:00") |

---

## 6. Interaktion & Verhalten

**Navigation.** Rail wählt die Gruppe (und springt auf ihr erstes Modul), Panel wählt das Modul. Panel klappt manuell zu — und **automatisch, wenn die Gruppe nur ein Modul hat**. Route-Wechsel schließt Palette und Inbox.

**Modulübergreifende Kette** (das Alleinstellungsmerkmal, muss funktionieren):
Wochenplan → „Zutaten in Einkaufsliste" → navigiert zu Listen, setzt den Übernahmezustand, zeigt das Erfolgsbanner → „Einkauf als Ausgabe buchen" → navigiert zu Transaktionen und markiert die Buchung. Der Fortschritt ist Zustand, kein Text: Schritte vor dem Fortschritt sind aktiv (`--violet`-Tint, `--violet`-Rahmen), danach grau (`--text-4`).

**Hover/Active/Focus.** Palette-Zeilen und Listenzeilen bekommen `--bg-elev-2` bei Hover. Alle Buttons `cursor: pointer`. Fokusringe sind im Prototyp nicht ausgeführt — **in der Umsetzung sichtbare `:focus-visible`-Ringe (2 px `--violet`, 2 px Offset) ergänzen**; Modal und Palette brauchen eine Fokusfalle (im Bestand `Modal.tsx` vorhanden).

**Animation.** Nur zwei Keyframes: `o-fade` (opacity 0→1, `translateY(6px)→0`, 180–200 ms `ease-out`) für Inbox und Palette, `o-pulse` (opacity 1→.45→1, 1,2 s, endlos) für den Eingabecursor. Alles unter `prefers-reduced-motion: reduce` auf `.01ms` reduzieren.

**Responsives Verhalten.**
- Desktop: Rail 64 + Panel 214 + Inhalt.
- Mobil (Rahmen 390 px): keine Rail, keine Panel; Header verkürzt; Tabbar unten; `main`-Polster `14px 12px 8px`.
- **Alle Raster nutzen `minmax(min(<wunsch>, 100%), 1fr)`** — eine harte Untergrenze sprengt das Layout auf schmalen Breiten.
- **Karten über die volle Zeile nutzen `grid-column: 1 / -1`, nie `span 2`** — sonst entsteht im einspaltigen Fall eine Phantomspalte.
- Größen, die zwischen Desktop und Mobil springen (Hero-Zahl 66/38 px, Begrüßung 52/34 px, Hero-Polster 34/20 px, Kartenpolster 26/18 px), **an einen Breakpoint oder Container-Query koppeln — nicht an `vw`**.
- Der Wochenplan scrollt horizontal (`min-width: 760px`), alle anderen Tabellen brechen um.

**Fehler-, Leer- und Randzustände** (bewusst im Prototyp enthalten, bitte übernehmen):
abgelaufener ING-Banking-Consent · negativer KFZ-Darlehenssaldo (neutral) · Budget über 100 % (schraffiert) · leere Liste „Baumarkt" · Reise ohne Verknüpfungen · Notiz ohne Titel · pausierter Vertrag (`idle`) · archivierte Gewohnheit · sehr langer Kategoriename („Restaurant & Lieferdienst mit sehr langem Kategorienamen") · schreibgeschützter ICS-Kalender · Offline-Modus.

---

## 7. Zustand

| Zustand | Typ | Zweck |
|---|---|---|
| `route` | Modul-ID | aktives Modul |
| `group` | `'home' \| 'fin' \| 'time' \| 'house' \| 'more'` | aktive Rail-Gruppe |
| `railOpen` | boolean | Modul-Panel offen (erzwungen zu bei einelementiger Gruppe) |
| `theme` | `'dark' \| 'light'` | Theme; im Prototyp per Inline-Variablen auf `documentElement`, in der App über `class="dark"` + Tailwind |
| `paletteOpen`, `notifOpen` | boolean | Overlays, schließen sich gegenseitig aus |
| `offline` | boolean | im Prototyp simuliert, in der App aus `navigator.onLine` + Sync-Zustand |
| `txFilter` | `'all' \| 'in' \| 'out'` | Transaktionsfilter |
| `budgetFilter` | `'all' \| 'over' \| 'warn' \| 'ok'` | Budgetfilter |
| `fcDays` | `30 \| 60 \| 90` | Prognosefenster |
| `flow` | `0 \| 1 \| 2` | Fortschritt der Wochenplan→Liste→Ausgabe-Kette |

Nicht Zustand, sondern **abgeleitet** (in der App als Selektoren/`useMemo`, nicht im Render): Statusarten, Prozentwerte, Pace, Prognosepunkte, Donut-Segmente, Aggregate. Der Prototyp berechnet das alles in einer `renderVals()`-Funktion aus Rohdaten — dieselbe Trennung sollte in der Umsetzung erhalten bleiben (`lib/status.ts`, `lib/forecast.ts`, `lib/format.ts`).

**Datenbedarf pro Screen:** Konten mit Saldo, Typ, Sync-Zeit, Consent-Ablauf · Transaktionen mit Datum, Empfänger, Kategorie, Konto, Betrag · Budgets mit Betrag, Verbrauch, Kategorie · Sparziele · Depotpositionen mit Menge, Kurs, Einstand · wiederkehrende Zahlungen mit Rhythmus und nächster Fälligkeit · Verträge mit Monatsbetrag und Kündigungsfrist · Termine mit Kalender, Farbe und Schreibrecht · Aufgaben mit Fälligkeit und Priorität · Gewohnheiten mit Tagesprotokoll · Rezepte, Wochenplan-Slots, Listeneinträge mit Herkunft · Notizen mit Tags · Reisen · Dokumente mit Ablaufdatum.

**Formate: durchgehend `de-DE`.** Geld `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })` → `1.234,56 €`. Datum `dd.MM.yyyy`. Wochentage kurz „Mo…So". Prozent mit schmalem Leerzeichen vor `%`. Im Bestand liegen die Helfer in `src/lib/utils.ts`.

---

## 8. Assets & Icons

- **Icons:** `lucide-react` (im Repo bereits Abhängigkeit). Benutzte Namen: `Home, Wallet, Calendar, CalendarRange, CheckSquare, ChefHat, ClipboardList, StickyNote, Plane, FolderLock, Goal, Bot, Settings, LineChart, ArrowLeftRight, Building2, Target, PiggyBank, TrendingUp, TrendingDown, Repeat, FileText, Sparkles, MoreHorizontal, Menu, Search, Bell, Plus, Sun, Moon, Monitor, Smartphone, WifiOff, MessageSquare, PanelLeft, X, AlertCircle, AlertTriangle, CheckCircle2, Info, Ban, Clock, Flame, ChevronRight, ChevronDown, ArrowRight, Filter, Download, RefreshCw, MapPin, ShoppingCart, Link2, Trash2, Circle, Utensils`. Standardgrößen 13/14/16/19 px, `stroke-width: 2`, `linecap/linejoin: round`.
  *Hinweis:* Der Prototyp enthält ein **handgezeichnetes Ersatz-Icon-Set**, weil externe CDNs in der Prototyping-Umgebung blockiert waren. Es ist **nicht** zu übernehmen — in der App `lucide-react` verwenden.
- **Markenzeichen:** `packages/frontend/public/icon.svg` liegt bei. Der Verlauf darin ist auf Violett→Azur zu aktualisieren; die Geometrie (abgerundetes Quadrat `rx=96/512`, weißes „O") bleibt.
- **Kategorie-Emojis** wie im Bestand: 🛒 🍽️ 🚌 🛍️ 🎟️ 📺 🏠 💼 🚗 🧴 🧳 🔧.
- **Bilder:** keine echten Bilder im Prototyp. Rezeptkarten nutzen einen gestreiften Platzhalter — für die Umsetzung braucht es entweder echte Rezeptfotos oder einen bewusst gestalteten Platzhalter.
- **Fonts:** Inter (400–800) und Instrument Serif (italic), beide im Bestand schon geladen.

---

## 9. Dateien in diesem Bundle

| Datei | Inhalt |
|---|---|
| `Orynthia Redesign.dc.html` | Der vollständige Prototyp: Variantenwähler, Farbsystem-Legende, **Variante A (umzusetzen)**, dazu B und C als Kontext. Enthält die Mockup-Leiste (Variante, Hell/Dunkel, Desktop/Mobil, Offline). Öffnet im Browser nur zusammen mit `support.js`. |
| `support.js` | Runtime des Prototyps. **Nicht portieren** — nur damit die HTML-Datei lokal läuft. |
| `icon.svg` | Markenzeichen aus `packages/frontend/public/icon.svg`. |
| `github.md` | Zuordnung Screen → Repo-Quelldateien, Stand des letzten Abgleichs. |

**Bedienung des Prototyps:** oben links Variante wählen (A ist die relevante), daneben Hell/Dunkel und Desktop/Mobil umschalten, „Offline simulieren" zeigt den Offline-Zustand. In Variante A links über die Icon-Rail die Gruppe, im Panel das Modul wählen.

## 10. Umsetzungsreihenfolge (Vorschlag)

1. **Tokens** in `src/index.css` und `tailwind.config.ts` (beide Themes), `CATEGORY_PALETTE` an einer Stelle konsolidieren.
2. **`lib/status.ts`** mit den Ableitungsfunktionen aus 2.2 und einem `StatusBadge`, das Farbe + Icon + Label zusammen ausgibt — ab hier keine Inline-Ternaries für Farben mehr.
3. **Shell**: `Layout.tsx` auf Rail + Panel umbauen, `Header.tsx`, `MobileTabbar.tsx`, Palette, Inbox.
4. **Home** (der aufwendigste Screen, siehe 4).
5. **Charts** anpassen: `ForecastCard.tsx` (Nulllinie, Puffer, Risikoband, `--ink-3`-Bug), Cashflow-Balken, beide Donuts.
6. **Budgets** mit Pace-Referenz, dann die übrigen Finanzmodule.
7. **Zeit- und Haushaltsmodule**, zuletzt Assistent und Einstellungen.
8. **Kette** Wochenplan → Liste → Ausgabe als echten Fluss verdrahten.
9. **Rand- und Leerzustände** aus 6 durchgehen, Fokusringe und Tastaturbedienung ergänzen.
