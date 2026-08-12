repo: rxf-sys/Orynthia
branch: main
path: packages/frontend

## Last sync
date: 2026-08-11T11:58:00Z

### Updated in this project
- Variante A („Kommandozentrale") gebaut: alle 21 Screens, Light/Dark, Desktop/Mobil
- Semantisches Farbsystem eingeführt (Status aus dem Datenwert, kategoriale Skala wertfrei)
- Neue kühle Akzente (Violett/Azur) ersetzen den Peach-Gradient; Peach nur noch für Badges
- Charts neu: Forecast mit Null-/Pufferlinie und Risikoband, Budgets gegen Monatsverlauf, Gewohnheiten-Raster

## Screen map
| Screen (Projekt) | Repo-Quellen |
|---|---|
| Shell (Rail, Header, Tabbar, ⌘K, Inbox, Offline) | src/components/{Layout,Sidebar,Header,MobileTabbar,CommandPalette,NotificationBell,OfflineBanner}.tsx |
| Home | src/features/home/pages/Home.tsx |
| Finanzen · Übersicht | src/features/finance/pages/Dashboard.tsx, src/features/finance/components/ForecastCard.tsx |
| Transaktionen | src/features/finance/pages/Transactions.tsx, src/features/finance/api.ts |
| Konten | src/features/finance/pages/Accounts.tsx |
| Budgets | src/features/finance/pages/Budgets.tsx |
| Sparziele / Depot / Wiederkehrend / Verträge / Sparpotenzial | src/features/finance/pages/{SavingsGoals,Investments,RecurringPayments,Contracts,SavingsPotential}.tsx |
| Kalender / Aufgaben / Gewohnheiten | src/features/{calendar,tasks,habits}/* |
| Rezepte / Wochenplan / Listen / Notizen / Reisen / Dokumente | src/features/{recipes,lists,notes,trips,documents}/* |
| KI-Assistent / Einstellungen | src/features/{assistant,settings}/* |
| Farb-/Typo-Tokens, Formate | src/index.css, tailwind.config.ts, src/lib/{utils,categoryColors}.ts |
