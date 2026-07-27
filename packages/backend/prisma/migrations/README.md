# Namenskonvention der Migrationen

Prisma wendet Migrationen in **lexikografischer Reihenfolge des Ordnernamens**
an – nicht numerisch. Deshalb ist der Präfix hier **genau ein Zeichen** aus
`0`–`9`, danach `a`–`z`:

```
0_init  1_password_reset  …  9_meal_plan  a_notes_trips_links  b_… c_…
```

Ein zweistelliger Präfix wäre ein Fehler: `10_` sortiert vor `1_` (weil
`'0' < '_'`). Eine so benannte Migration liefe auf einer frischen Datenbank
zu früh und schlüge fehl, während bestehende Installationen unauffällig
weiterlaufen – ein Fehler, der erst beim Neuaufsetzen sichtbar wird.

**Nächste freie Kennung:** `d_`.

Bereits angewendete Migrationen dürfen nicht umbenannt werden: Prisma merkt
sich den Ordnernamen in `_prisma_migrations` und würde sie sonst erneut
ausführen.
