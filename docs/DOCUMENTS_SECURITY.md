# Security-Konzept: Dokumenten-Ablage

Dieses Dokument beschreibt die Schutzmaßnahmen des Dokumenten-Moduls. Der
Allrounder-Plan stuft Dokumente als das Modul mit dem **höchsten
Datenschutzrisiko** ein (Ausweise, Verträge, Arztberichte) und verlangt vor der
Umsetzung ein eigenes Security-Konzept — das ist dieses Dokument.

**Stand:** 2026-07-26 · **Modul:** `packages/backend/src/modules/documents/`

---

## 1. Schutzziel

Hochgeladene Dateien sind personenbezogene Daten besonderer Sensibilität. Wer
Zugriff auf das Dateisystem oder ein Datenbank-Backup erlangt, darf daraus
**keine lesbaren Dokumente** gewinnen. Zusätzlich darf eine hochgeladene Datei
niemals dazu führen, dass fremder Code im Kontext der Anwendung ausgeführt wird.

## 2. Verschlüsselung at rest

| Aspekt | Umsetzung |
|---|---|
| Verfahren | AES-256-GCM (authentifiziert), identisch zu Banking-Sessions und 2FA-Secrets |
| Schlüssel | `ENCRYPTION_KEY` aus der `.env` (64 Hex-Zeichen), nie in der Datenbank |
| Format | `iv (12 B) | auth-tag (16 B) | ciphertext`, als Binärdatei (kein base64-Overhead) |
| Ablageort | Dateisystem unter `DOCUMENTS_PATH`, **nicht** in der Datenbank |
| Dateirechte | `0600` — nur der App-User darf lesen |

Die Datenbank enthält ausschließlich Metadaten (Titel, Dateiname, MIME-Typ,
Größe, Tags, Prüfsumme, Storage-Schlüssel). Ein reines DB-Backup ist damit
wertlos ohne Dateisystem, ein reines Dateisystem-Backup wertlos ohne
`ENCRYPTION_KEY`.

> **Konsequenz für Backups:** Ohne gesicherten `ENCRYPTION_KEY` sind
> gesicherte Dokumente unwiederbringlich verloren — dieselbe Regel wie bei
> Banking-Verbindungen. Siehe README, Abschnitt Backups.

## 3. Path Traversal strukturell ausgeschlossen

Der Ablagepfad wird **nie** aus Nutzereingaben gebildet. Beim Upload erzeugt
der Server einen zufälligen 24-Byte-Storage-Schlüssel (48 Hex-Zeichen); der
Originalname wird ausschließlich als Anzeigename gespeichert, um Pfadanteile
und Steuerzeichen bereinigt. Vor jedem Dateizugriff prüft der Storage-Service
zusätzlich, dass der Schlüssel exakt dem Hex-Muster entspricht.

## 4. Upload-Prüfungen

1. **Größenlimit:** 20 MB pro Datei, doppelt erzwungen (Multer-Limit und
   Service-Prüfung).
2. **MIME-Whitelist:** PDF, JPEG, PNG, WebP, HEIC, TXT, CSV sowie Word-/Excel-
   Formate. Aktive Inhalte (HTML, SVG, JavaScript) und Archive sind **nicht**
   erlaubt.
3. **Endung muss zum Typ passen** — eine `.exe` mit `application/pdf` wird
   abgewiesen.
4. **Magic-Bytes-Prüfung** für PDF, JPEG und PNG: Der tatsächliche Inhalt muss
   zur Deklaration passen. Eine als PDF getarnte HTML-Datei fliegt hier auf.
5. **Prüfsumme:** SHA-256 des Klartexts wird gespeichert und bei jedem Download
   erneut verifiziert.

## 5. Download-Härtung

Dateien werden **immer als Anhang** ausgeliefert, nie inline gerendert:

```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename*=UTF-8''…
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'none'; sandbox
Cache-Control: private, no-store
```

Selbst wenn eine getarnte Datei alle Eingangsprüfungen überstünde, kann sie im
Browser keinen Code im Kontext der App ausführen. Der Download-Endpoint liegt
hinter demselben JWT-Guard wie alle anderen Ressourcen; es gibt **keine**
signierten oder öffentlichen Datei-URLs.

## 6. Zugriffskontrolle

Jeder Zugriff (Lesen, Download, Ändern, Löschen) filtert serverseitig auf
`userId`; fremde IDs liefern 404 statt 403, um keine Existenz preiszugeben.
Beim Löschen eines Dokuments werden Metadaten, verschlüsselter Blob und alle
Verknüpfungen entfernt. Scheitert das Anlegen der Metadaten nach dem Schreiben
der Datei, wird der Blob wieder gelöscht — es entstehen keine verwaisten Daten.

Dokumente sind über `EntityLink` mit Alltags-Modulen verknüpfbar (z. B. Reise ↔
Dokument). Eine Verknüpfung entsteht nur, wenn **beide** Enden dem Nutzer
gehören. Finanz-Entitäten bleiben von Verknüpfungen ausgeschlossen.

## 7. Bewusst akzeptierte Restrisiken

| Risiko | Bewertung |
|---|---|
| **Kein Virenscan** | Orynthia ist self-hosted und einnutzerorientiert; hochgeladene Dateien werden nie an Dritte ausgeliefert und nie serverseitig geöffnet. Ein ClamAV-Sidecar wäre für Mehrbenutzer-Szenarien nachrüstbar (`docker-compose`-Profil), ist hier aber unverhältnismäßig. |
| **Schlüssel im Prozessspeicher** | Der `ENCRYPTION_KEY` liegt zur Laufzeit im Speicher. Wer den Server-Prozess kompromittiert, kann entschlüsseln — das gilt gleichermaßen für Banking-Daten und ist ohne HSM nicht auflösbar. |
| **Keine Client-seitige Verschlüsselung** | Ende-zu-Ende-Verschlüsselung würde serverseitige Vorschau und Suche unmöglich machen und den Schlüsselverlust unwiederbringlich machen. Für ein Self-Hosted-Setup ist Verschlüsselung at rest der angemessene Kompromiss. |
| **Keine Vorschau** | Bewusst: eine Inline-Vorschau würde die Attachment-Regel aus Abschnitt 5 aufweichen. |

## 8. Betrieb

`DOCUMENTS_PATH` muss auf ein **persistentes Volume** zeigen (Default:
`./data/documents`). Im Docker-Setup ist das Verzeichnis als benanntes Volume
eingebunden, damit Dokumente Updates überleben. Das Verzeichnis gehört in die
Backup-Routine — zusammen mit der `.env`.
