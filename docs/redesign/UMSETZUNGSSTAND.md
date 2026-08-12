# Redesign Variante A — Umsetzungsstand

Spezifikation: [`HANDOFF.md`](HANDOFF.md) · Auftrag: [`AUFTRAG.md`](AUFTRAG.md) ·
Screen→Quelle: [`SCREEN_MAP.md`](SCREEN_MAP.md)

Die Umsetzung folgt der Reihenfolge aus HANDOFF Abschnitt 10.

## Umgesetzt

**1. Tokens** — `src/index.css`, `tailwind.config.ts`

Bestandsnamen behalten, Werte ersetzt (beide Themes). Neu: `--violet`,
`--azure`, `--idle`. Die Rolle „erhöhte Fläche/Chip" (in der Spec `--bg-elev-2`)
hatte der Bestand bereits als `--bg-soft` — bewusst nicht doppelt angelegt,
sonst driften die beiden auseinander. Light wechselt vom warmen `#f4f1ee` auf
das neutrale `#f3f4f8`. Der Markenverlauf ist Violett→Azur; Peach bleibt im
Token-Set, aber nur für „Neu"/„Beta"-Badges und die Streak-Flamme.

Status-Tints (`--pos-bg` …) sind keine handgepflegten Hex-Paare mehr, sondern
`color-mix(in oklab, <status> 16%, transparent)` nach der Tint-Formel aus 2.2 —
damit passen Fläche und Rahmen automatisch zur Statusfarbe, in beiden Themes.

Die Paletten-Duplizierung ist aufgelöst: `tailwind.config.ts` importiert die
Skala aus `lib/categoryColors.ts`. Es gibt keine zweite Liste mehr.

**2. `lib/status.ts` + `StatusBadge`**

Alle Ableitungen aus 2.2 als reine Funktionen, die eine `StatusKind`
zurückgeben — nie eine Farbe. Farbe, Icon und Label kommen ausschließlich aus
`STATUS_STYLE`. Dazu `pace()`/`paceHint()` für den erwarteten Monatsverlauf.
`StatusBadge` gibt immer Farbe **und** Icon **und** Text aus; in der
`iconOnly`-Variante trägt es dasselbe als `aria-label`.

**5./6. Die konkreten Korrekturen aus 2.4**

| Stelle | Änderung |
|---|---|
| `Dashboard.tsx` Cashflow | Einnahmen `--text-2`, Ausgaben `--text-4`; Farbe nur am neuen Saldo-Balken, negative Monate zusätzlich schraffiert (SVG-`<pattern>`) |
| `Dashboard.tsx` Kategorie-Donut | wertfreie Skala; **auch die in der Datenbank hinterlegten Kategoriefarben werden ignoriert** — sie enthalten Grün und Rot und würden im Donut als Bewertung mitgelesen. „Sonstige" in `--text-4` |
| `ForecastCard.tsx` | Nulllinie **und** Puffergrenze (500 €), Risikoband als Fläche, Prognose gestrichelt, Tiefstwert benannt, Legende; Achsen-Bug `--ink-3` → `--text-3` behoben |
| `Budgets.tsx` | Balken immer in der Statusfarbe (vorher gewann unter 100 % die Kategoriefarbe), Kategoriefarbe auf dem Icon, Schraffur bei Überzug, Pace-Marke + „Erwartet wären X %" |
| `Accounts.tsx` | Verbindlichkeiten neutral statt rot, mit Hinweis „planmäßig, keine Wertung" |
| `Investments.tsx` | `positionStatus()` je Position, Kategoriefarbe als Kante |

**Ergänzungen, die der Prototyp offen lässt:** sichtbare `:focus-visible`-Ringe
(2 px `--violet`, 2 px Offset) auf allem Fokussierbaren; `formatPercent()` mit
schmalem **geschütztem** Leerzeichen, damit Zahl und `%` nicht umbrechen.

**Abgesichert:** 10 Tests in `src/__tests__/status.test.ts` — inklusive der
Zusicherung, dass die kategoriale Skala kein Grün und kein Rot enthält und
jeder Status Farbe, Icon und Label trägt.

## Offen

**3. Shell** — Icon-Rail (64 px) + klappbares Modul-Panel (214 px) statt der
heutigen einspaltigen Sidebar, Header nach 3.3, Tabbar nach 3.4, Palette nach
3.5. Der größte strukturelle Eingriff.

**4. Home** — Begrüßung, Hero mit Nettovermögen und Liquiditätschart,
Fokus-Band „Was heute zählt", Abschnitte Geld/Dein Tag/Haushalt (HANDOFF 4).

**7. Übrige Modulseiten** nach dem Muster aus 5 — Kennzahlenreihe,
Filterpillen, Listencontainer.

**8. Kette Wochenplan → Liste → Ausgabe** als echter Zustand (HANDOFF 6).

**9. Rand- und Leerzustände** aus 6 durchgehen, Tastaturbedienung der Palette.

## Bekannte Abweichung

`CategoryIcon` nutzt weiterhin die in der Datenbank gespeicherte
Kategoriefarbe. Die System-Kategorien tragen dort Grün und Rot. Für den Donut
ist das umgangen (siehe oben), auf dem Icon steht die Farbe aber neben einer
Statuspille. Sauber wäre, die Seed-Farben der System-Kategorien im Backend auf
die wertfreie Skala umzustellen — das ist eine Datenänderung und gehört in
denselben Schritt wie die übrigen Modulseiten.
