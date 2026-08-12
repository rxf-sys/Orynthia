Implementiere das Orynthia-Redesign (Variante A, „Kommandozentrale") im bestehenden Frontend.

## Kontext

Repo: rxf-sys/Orynthia, Branch main, Arbeitsbereich `packages/frontend`.
Stack: React 18 + TypeScript + Vite + Tailwind CSS, Recharts, lucide-react.
Struktur: Seiten unter `src/features/<modul>/pages/*.tsx`, UI-Bausteine in `src/components/ui/*`,
Shell in `src/components/{Layout,Sidebar,Header,MobileTabbar}.tsx`,
Tokens in `src/index.css` + `tailwind.config.ts`, Formate in `src/lib/utils.ts`,
Kategoriefarben in `src/lib/categoryColors.ts`.

## Aufgabe

Im Ordner `design_handoff_orynthia_redesign/` liegt eine vollständige Design-Spezifikation.
Lies **zuerst `README.md` komplett** — dort stehen alle exakten Werte (Farben, Typo, Abstände,
Radien, Zustände, Screen-für-Screen-Beschreibungen, Umsetzungsreihenfolge).

`Orynthia Redesign.dc.html` ist die begleitende **Design-Referenz**: ein HTML-Prototyp, der
Aussehen und Verhalten zeigt. Er läuft auf einem hauseigenen Prototyping-Runtime (`support.js`,
`<x-dc>`-Template plus `class Component`) und ist **kein Produktionscode** — nicht portieren,
nicht daraus kopieren. Öffne ihn im Browser, um Layout und Interaktion nachzuvollziehen
(Variante A wählen; die Leiste oben schaltet Hell/Dunkel, Desktop/Mobil und Offline).
Varianten B und C liegen nur als Kontext bei und sind nicht umzusetzen.

Baue die Screens mit den **vorhandenen Mitteln des Repos** nach: Tailwind-Klassen statt
Inline-Styles, die bestehenden `Card`/`Btn`/`Tag`/`Progress`/`PageHead`-Komponenten statt neuer
Einzelfälle, `lucide-react` statt des im Prototyp handgezeichneten Ersatz-Icon-Sets (das existiert
nur, weil im Prototyping-Umfeld keine externen CDNs erreichbar waren).

## Worauf es inhaltlich ankommt

Der Kern des Redesigns ist nicht der Farbtausch, sondern ein **semantisches Farbsystem** mit drei
strikt getrennten Achsen:

1. **Status** (ok/warn/crit/info/idle) wird **aus dem Datenwert berechnet**, nie aus einem Serien-
   oder Kategorieindex, und sitzt auf **Fläche + Icon**. Jeder Status trägt Farbe **und** Icon
   **und** Textlabel — nie Farbe allein.
2. **Kategorial** ist eine wertfreie 8er-Skala **ohne Grün und Rot**, rein zur Unterscheidung.
3. **Nutzerfarben** (Kalender, Gewohnheiten, Notizen) sitzen **ausschließlich auf einer Kante**
   oder einem Punkt, damit sie nie mit Status verwechselt werden.

Konkret zu korrigieren (Details und Fundstellen in README Abschnitt 2.4):
- `Dashboard.tsx`: Cashflow-Balken färben aktuell **pro Serie** (`Einnahmen = --pos`,
  `Ausgaben = --indigo`). Farbe darf nur noch am **Monatssaldo** erscheinen; negative Monate
  zusätzlich schraffiert.
- `Dashboard.tsx`: `CATEGORY_PALETTE` enthält Grün `#1f8a5b` und Rot-Pink `#e76b8d` und kollidiert
  damit mit den Statusfarben. Ersetzen — und die Duplizierung zwischen `lib/categoryColors.ts` und
  `tailwind.config.ts` auflösen.
- `Budgets.tsx`: `Progress color={over ? 'var(--neg)' : cat.color}` — unter 100 % gewinnt die
  Kategoriefarbe und der Status geht verloren. Balken immer in der Statusfarbe, Kategoriefarbe
  wandert auf das Icon.
- `ForecastCard.tsx`: hat nur `ReferenceLine y={0}`; es fehlen Puffergrenze (500 €), Risikoband und
  der benannte Tiefstwert. Außerdem echter Bug: `tick={{ fill: 'var(--ink-3)' }}` — das Token heißt
  `--text-3`, die Achsen erben derzeit die Default-Farbe.
- `Accounts.tsx`: negative Kredit-/Darlehenssalden sind rot. Sie sind planmäßig und müssen
  **neutral** dargestellt werden — Rot bleibt Unterdeckung und Budgetüberzug vorbehalten.
- Neu überall, wo ein Monatsbudget erscheint: der **erwartete Monatsverlauf** als Referenzmarke
  (Tag/Tage-im-Monat). Ohne sie ist „87 % verbraucht" nicht interpretierbar.

Zweite Entscheidung: der Peach-Gradient tritt zurück, neuer Primärakzent ist **Violett → Azur**
(`linear-gradient(135deg, #7c5cff, #2f7dff)`). `--peach #fda481` bleibt nur noch für „Neu"/„Beta"-
Badges und die Streak-Flamme. Im Light-Theme muss das warme Off-White `#f4f1ee` dem neutralen
`#f3f4f8` weichen — gegen die kühlen Akzente wirkt der Warmton sonst schmutzig.

## Umfang

Alle 20 Module, Light und Dark, Desktop und Mobil. Der aufwendigste Screen ist Home
(README Abschnitt 4): Begrüßung, Hero mit Nettovermögen und Liquiditätsprognose, ein
datengetriebenes Fokus-Band „Was heute zählt", dann die Abschnitte Geld, Dein Tag und Haushalt.

Der modulübergreifende Fluss **Wochenplan → Einkaufsliste → Ausgabe** muss als echter Zustand
funktionieren, nicht als Text (README Abschnitt 6).

Bitte die im Prototyp bewusst enthaltenen Rand- und Leerzustände mit übernehmen: abgelaufener
Banking-Consent, negativer Darlehenssaldo, Budget über 100 %, leere Liste, Reise ohne
Verknüpfungen, Notiz ohne Titel, pausierter Vertrag, archivierte Gewohnheit, sehr langer
Kategoriename, schreibgeschützter ICS-Kalender, Offline-Modus.

## Fallstricke, die im Prototyp schon Fehler verursacht haben

- Raster brauchen `minmax(min(<wunsch>, 100%), 1fr)` — eine harte Untergrenze sprengt schmale
  Breiten.
- Karten über die volle Zeile brauchen `grid-column: 1 / -1`, **nie** `span 2`: im einspaltigen
  Fall entsteht sonst eine Phantomspalte.
- Größen, die zwischen Desktop und Mobil springen, an einen Breakpoint oder eine Container-Query
  koppeln — **nicht** an `vw`.
- Alle Geldbeträge, Prozente und Zählwerte brauchen `tabular-nums`.
- Formate durchgehend `de-DE` (`1.234,56 €`, `dd.MM.yyyy`).

## Vorgehen

Halte dich an die Umsetzungsreihenfolge in README Abschnitt 10: erst Tokens, dann `lib/status.ts`
mit den Ableitungsfunktionen und einem `StatusBadge` (ab da keine Inline-Ternaries für Farben
mehr), dann Shell, dann Home, dann Charts, dann die übrigen Module.

Fasse vor dem Start kurz zusammen, wie du die Token-Umbenennung und `lib/status.ts` schneiden
willst — das ist die Entscheidung, an der alles andere hängt.

Ergänze außerdem, was der Prototyp offen lässt: sichtbare `:focus-visible`-Ringe
(2 px `--violet`, 2 px Offset), Tastaturbedienung für Palette und Modals, und echte Rezeptbilder
oder einen bewusst gestalteten Platzhalter.
