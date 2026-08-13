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

**3. Shell** — `components/navigation.ts`, `Sidebar/Header/MobileTabbar/CommandPalette/OfflineBanner`

Icon-Rail (64 px) wählt den Bereich, Modul-Panel (214 px) das Modul. Das Panel
klappt manuell zu und automatisch, wenn die Gruppe nur ein Modul hat. Die
Navigation liegt jetzt in **einer** Registry statt in drei Listen, die schon
einmal auseinandergelaufen sind; auch der Seitentitel kommt von dort.

**4. Home** — `features/home/`

Begrüßung, Hero (Nettovermögen, Veränderung gegenüber dem Vormonat,
Kennzahlenleiste, Liquiditätsverlauf als eigenes SVG statt Recharts, damit der
Startbildschirm die Chart-Bibliothek nicht lädt), datengetriebenes Fokus-Band
und die drei Abschnitte Geld / Dein Tag / Haushalt.

Das Fokus-Band zeigt die drei dringendsten offenen Meldungen, gewichtet aus
Budgets, Aufgaben, Liquidität, Kündigungsfristen und ablaufenden Dokumenten —
keine festen Karten. Ist nichts offen, verschwindet es. Die Budget-Ringe tragen
den Verbrauch außen und den erwarteten Monatsverlauf als dünnen Innenring.

Die Widget-Anpassung bleibt erhalten und ist den Abschnitten zugeordnet. Das
frühere „Finanzen"-Widget entfällt: seine Zahlen stehen jetzt im Hero; an seine
Stelle tritt die im Handoff vorgesehene Sparziele-Karte.

**7. Übrige Modulseiten**

Aufgaben (Gruppen als getönte Statuszeilen), wiederkehrende Zahlungen und
Verträge (Fristen über `dueStatus`, pausiert als `idle`), Dokumente
(Gültigkeit als Status statt eigener Ternary-Kette), Gewohnheiten und Notizen
(Nutzerfarbe auf der **linken Kante** statt oben — Farbachse 3).

Die System-Kategoriefarben lagen als eigentliche Ursache im Backend: sie
enthielten Grün und Rot. `CategoriesService` nutzt jetzt die wertfreie Skala
und **zieht bestehende Instanzen beim Start nach** — selbst angelegte
Kategorien bleiben unangetastet, die gehören dem Nutzer.

**8. Kette Wochenplan → Liste → Ausgabe** — `stores/flowStore.ts`

Der Fortschritt ist Zustand statt Text: der Wochenplan übergibt Liste, Anzahl
und Mahlzeiten, die Liste zeigt daraus ihr Erfolgsbanner und bietet den
nächsten Schritt an, die gebuchte Ausgabe wird in der Transaktionsliste
markiert und angescrollt. Die Fluss-Karte auf Home zeigt, wie weit die Kette
ist; Schritte dahinter bleiben grau.

Bewusst nicht persistiert: die Kette ist eine Handlung innerhalb einer
Sitzung. Ein harter Reload beendet sie — das ist ehrlicher, als einen
Fortschritt anzuzeigen, dessen Anlass niemand mehr erinnert. In-App-Navigation
behält ihn.

**9. Rand- und Leerzustände**

| Zustand | Wo |
|---|---|
| Abgelaufener Banking-Consent | Warnbanner über der Kontenliste, ab 21 Tagen Restlaufzeit |
| Negativer Darlehenssaldo | neutral mit „planmäßig, keine Wertung" |
| Budget über 100 % | Statusfarbe + Schraffur |
| Leere Liste, Notiz ohne Titel | vorhanden |
| Reise ohne Verknüpfungen | jetzt mit zwei Aktionen statt nur einer Erklärung |
| Pausierter Vertrag / Zahlung | `idle` |
| Archivierte Gewohnheit | `idle`-Pille |
| Schreibgeschützter ICS-Kalender | Schloss in der Verwaltung, Hinweis im Termin-Dialog, aus der Auswahl gefiltert |
| Offline-Modus | Banner über der gesamten Breite, Schreibzugriffe gesperrt |

Kalender zusätzlich: heute mit Violett-Tint, Termin-Chips tragen die
Kalenderfarbe als **Kante** statt als Fläche — sonst konkurriert die
Nutzerfarbe mit den Statusflächen.

Rezeptkarten ohne Foto zeigen einen bewusst gestalteten Platzhalter
(diagonale Streifen, Beschriftung „Rezeptfoto") statt einer leeren Fläche —
so ist erkennbar, dass ein Bild fehlt und nichts kaputt ist.

## Offen

**Feinschliff der Maße** auf den Modulseiten nach Abschnitt 5
(Kennzahlenreihe, Filterpillen, einheitlicher Listencontainer). Das
Farbsystem und die Zustände sitzen überall; die Abstände und Radien folgen
noch nicht durchgängig der Skala aus Abschnitt 1.5.

## Bewusste Abweichungen

**Kein Primärbutton „Neu erfassen" im Header (Handoff 3.3).** Ein solcher
Button stand dort, zeigte auf die alte Finanz-Route und wurde auf
ausdrücklichen Wunsch entfernt. Als modulabhängige Aktion wäre er sinnvoll —
das ist aber eine Produktentscheidung und braucht eine Ansage.

**Der Kategorie-Donut** nimmt weiterhin die Skala statt der gespeicherten
Farbe. Die System-Farben sind zwar jetzt wertfrei, eine selbst angelegte
Kategorie könnte aber Rot sein — im Donut würde das als Bewertung gelesen.
Auf dem Icon bleibt die Nutzerfarbe erhalten.
