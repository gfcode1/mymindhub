# BinHub — Analisi approfondita del codice

> **Data:** 20 ottobre 2026  
> **Perimetro:** `src/` (~18.000 righe), `extension/src/` (~1.160 righe), configurazioni Vite/TS/PWA, workflow CI e script di deploy.  
> **Modalità:** revisione statica + typecheck + lint + test automatici + due test di regressione temporanei sul merge dei backup.  
> **Esito sintetico:** base solida e ben strutturata, ma con **tre aree da mettere in sicurezza prima di aggiungere sincronizzazione o AI**: integrità dei backup in modalità merge, gestione dei Blob audio, apertura di file non fidati dal Vault.

---

## Indice

1. [Sintesi esecutiva](#1-sintesi-esecutiva)
2. [Metodo e verifiche](#2-metodo-e-verifiche)
3. [Architettura in breve](#3-architettura-in-breve)
4. [Bug e rischi](#4-bug-e-rischi)
   - [P0 — perdita dati / sicurezza](#41-p0--perdita-dati-o-sicurezza)
   - [P1 — funzionalità compromesse](#42-p1--funzionalità-compromesse)
   - [P2/P3 — qualità, UX e manutenzione](#43-p2p3--qualità-ux-e-manutenzione)
   - [Accessibilità](#44-accessibilità)
   - [Sicurezza e privacy](#45-sicurezza-e-privacy)
5. [Proposte di miglioramento UI/UX](#5-proposte-di-miglioramento-uiux)
6. [Proposte di nuove funzioni](#6-proposte-di-nuove-funzioni)
7. [Miglioramenti alle funzioni esistenti](#7-miglioramenti-alle-funzioni-esistenti)
8. [Roadmap consigliata](#8-roadmap-consigliata)
9. [Quick wins](#9-quick-wins)
10. [Piano di test](#10-piano-di-test)
11. [Appendici](#11-appendici)

---

## 1. Sintesi esecutiva

### Punti di forza

- **Architettura chiara e coerente**: pagine React → hook live (`useData`) → Dexie; `seed.ts` funge da repository, come dichiarato in `AGENTS.md`.
- **Local-first reale**: nessun backend, nessun account, IndexedDB + PWA offline, backup ZIP con audio, cifratura opzionale AES-GCM/PBKDF2.
- **TypeScript rigoroso**: typecheck pulito con `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`.
- **Test suite utile**: 16 file, **92 test verdi**; coprono DB, backup replace, ricorrenze, crypto, spese, vocali, link, habits, alarms.
- **UI mobile-first curata**: design system custom coerente, token Tailwind v4, dialog nativi, gesture pointer per la lavagna, safe area iOS.
- **PWA e deploy base-aware**: `VITE_BASE`, manifest, shortcuts, share target, Workbox; deploy GitHub Pages e Neocities documentati.
- **Estensione browser tipizzata**: protocollo condiviso con l'app (`captureProtocol.ts`), coda locale e relay same-origin.

### Rischi principali

| # | Rischio | Gravità | Dove |
|---|---|---|---|
| 1 | Il merge di un backup può **andare in errore e annullare l'intera importazione** se esiste già un diario con la stessa data ma id diverso | **P0** | `src/db/backup.ts:512-517`, `src/db/db.ts:69` |
| 2 | Il merge duplica i log delle abitudini (stessa abitudine + data) | **P0** | `src/db/backup.ts:527-534`, `src/db/db.ts:73` |
| 3 | Tutte le note vocali caricano **tutti i Blob audio** in memoria anche in Dashboard, Ricerca e Collegamenti | **P0** | `src/hooks/useData.ts:113-124` |
| 4 | Apertura di file Vault via `blob:` URL same-origin: potenziale **stored XSS** con SVG/HTML | **P0** | `src/features/vault/VaultPage.tsx:90-99` |
| 5 | Note/bookmark/lavagne inesistenti mostrano **spinner infinito**; elementi soft-deleted restano apribili via URL | **P1** | `src/hooks/useData.ts:47,78,209` |
| 6 | Archiviare un'abitudine la rende **irrecuperabile dall'UI** | **P1** | `src/features/habits/HabitsPage.tsx:42` |
| 7 | Race tra blur e salvataggio del `TagInput`: l'ultimo tag digitato può andare perso | **P1** | `src/components/ui/TagInput.tsx:52-60` |
| 8 | I todo completati compaiono **non spuntati** nell'agenda del calendario | **P1** | `src/features/calendar/CalendarPage.tsx:88,478-486` |
| 9 | `monthKey` interpreta le date come UTC: il 1° del mese può finire nel mese precedente | **P1** | `src/lib/expenses.ts:18-23` |
| 10 | Backup e import bloccano il main thread (`zipSync`/`unzipSync`, JSON enorme) | **P1** | `src/db/backup.ts:195,249` |

### Giudizio complessivo

La codebase è **ben sopra la media** per un progetto local-first: separazione delle responsabilità, tipi condivisi, test e documentazione sono già a buon punto. Le priorità non sono “riscrivere”, ma:

1. **chiudere i buchi di integrità dei dati** (merge backup, soft-delete, tag orfani);
2. **ridurre il consumo di memoria** (vocali e lettori caricati interamente);
3. **mettere in sicurezza il Vault** e aggiungere una CSP;
4. **rifinire accessibilità e coerenza UI**;
5. solo dopo, valutare sincronizzazione, cifratura at-rest e AI.

---

## 2. Metodo e verifiche

### Comandi eseguiti

| Comando | Esito |
|---|---|
| `pnpm exec tsc -p tsconfig.app.json --noEmit` | ✅ Nessun errore |
| `pnpm exec oxlint` | ⚠️ Solo warning noti `react(set-state-in-effect)` e un `exhaustive-deps` in `VoicePage` |
| `pnpm test` | ✅ 16 file, 92 test passati |
| Test temporanei di regressione sul merge | ❌ 2 test falliti: `ConstraintError` sul diario, 2 log habit invece di 1 (file temporaneo rimosso) |

### Cosa non è stato verificato

- Test manuali su iOS/Safari e Android reali.
- Profilazione memoria con centinaia di vocali/file.
- Import di backup molto grandi o malevoli.
- Accessibilità con screen reader reali (le valutazioni sono statiche).
- Deploy reale su GitHub Pages/Neocities.

### Scala di severità usata

| Livello | Significato |
|---|---|
| **P0** | Perdita/corruzione dati, blocco dell'import, vulnerabilità sfruttabile |
| **P1** | Funzione principale rotta o con perdita di dati in casi realistici |
| **P2** | Comportamento scorretto, performance, accessibilità, manutenzione |
| **P3** | Rifinitura, coerenza, documentazione |

---

## 3. Architettura in breve

```
App.tsx (HashRouter, lazy pages)
   └── AppShell (header mobile, sidebar desktop, bottom nav, quick add)
        └── Feature pages
             ├── useData.ts / useLinks.ts / useTimer.ts / usePwa.ts
             ├── db/seed.ts (repository: CRUD, soft delete, restore, seed)
             └── Dexie DB "binhub" (IndexedDB)
                   ├── notes, todos, bookmarks, events, voiceNotes
                   ├── journalEntries, habits, habitLogs, timeEntries
                   ├── links, expenses, budgets, vaultItems/vaultFiles
                   ├── whiteboards/whiteboardData, alarms, tags, settings
                   └── backup.ts (ZIP + manifest + crypto)
```

### Convenzioni rilevanti

- **Soft delete**: quasi tutte le entità hanno `deletedAt`; le query dei hook filtrano `!deletedAt`, ma le letture per id **no** (vedi B05).
- **Settings**: una sola riga `key: 'app'`; modifiche tramite `saveSettings`.
- **Tag**: normalizzati lower-case; `registerTags` aggiunge, ma nessun processo li rimuove.
- **Backup**: manifest con `schemaVersion` (attualmente 11) e payload Zod; file audio/vault/lavagne inclusi nello ZIP.
- **Routing**: HashRouter intenzionale; non va cambiato.
- **PWA**: manifest `manifest.json` (per Neocities), base-aware, service worker disabilitato in dev.

### Volumi e indici

- Il DB usa indici per data, tag e link, ma **molti hook caricano l'intera tabella** con `toArray()` e filtrano/sortano in JS.
- Le tabelle più pesanti sono `voiceNotes` (Blob audio), `bookmarks` (`readerContent` fino a 300 KB) e `vaultFiles` (ArrayBuffer).
- `useNotes`, `useBookmarks`, `useLinkTargets` eseguono **due query complete** (attive + archiviate) per la stessa tabella.

---

## 4. Bug e rischi

### 4.1 P0 — perdita dati o sicurezza

#### B01 — Il merge di un diario con la stessa data manda in errore tutto l'import

- **Dove:** `src/db/backup.ts:512-517`, indice univoco in `src/db/db.ts:69`.
- **Sintomo:** import di un backup da un altro dispositivo in modalità “Unisci” → `ConstraintError` e transazione annullata. Verificato con un test temporaneo: `A mutation operation in the transaction failed because a constraint was not satisfied`.
- **Causa:** il diario ha indice univoco `&date`. Il merge cerca l'esistente per data, ma poi fa `put(entry)` con l'**id del backup**. Se l'id è diverso da quello locale, si tenta di inserire una seconda riga con la stessa data.
- **Impatto:** l'utente perde l'intero merge (note, todo, spese, ecc.) e riceve un errore poco comprensibile.
- **Fix:** riusare l'id esistente, come già fatto per i budget:

```ts
await db.journalEntries.put(existing ? { ...entry, id: existing.id } : entry)
```

- **Test da aggiungere:** due DB con stesso `date`, id diversi, `updatedAt` del backup più recente → il merge deve mantenere una sola riga, con id locale.

#### B02 — Il merge duplica i log delle abitudini

- **Dove:** `src/db/backup.ts:527-534`, indice non univoco in `src/db/db.ts:73`.
- **Sintomo:** dopo un merge, `habitLogs.count()` passa da 1 a 2 per la stessa coppia `(habitId, date)`. Verificato con test temporaneo.
- **Causa:** `[habitId+date]` è un indice normale, non `&`, e il merge inserisce il log del backup con id diverso.
- **Impatto:** `toggleHabitLog` usa `.first()`: con duplicati lo stato “fatto/non fatto” diventa incoerente; streak e conteggi possono sballare.
- **Fix immediato:** riusare l'id esistente nel merge.
- **Fix strutturale:** migrazione DB v13 che deduplica e crea indice `&[habitId+date]`; `toggleHabitLog` usa `put` con la chiave composta o un id deterministico (`habitId:date`).
- **Test:** merge da altro dispositivo; toggle dopo merge; conteggio streak.

#### B03 — Tutti i Blob audio vengono caricati ovunque

- **Dove:** `src/hooks/useData.ts:113-124`; consumatori: `DashboardPage.tsx:57`, `VoicePage.tsx:87`, `useGlobalSearch`, `useLinkTargets` (`useLinks.ts:38`).
- **Sintomo:** aprire Dashboard o Ricerca carica in memoria **tutti** i Blob delle note vocali, anche se servono solo titolo, durata o trascrizione.
- **Causa:** `VoiceNote` contiene `blob: Blob`; `useVoiceNotes` fa `db.voiceNotes.toArray()` e restituisce l'oggetto completo.
- **Impatto:** con 50 vocali da 5 MB si allocano ~250 MB solo per mostrare dei contatori; su mobile il browser può terminare la tab. La ricerca globale ricostruisce l'indice a ogni modifica e tiene i Blob vivi.
- **Fix consigliato:** separare i metadati dal contenuto:
  - tabella `voiceNotesMeta` (id, titolo, durata, waveform, transcript, tag, date) usata da tutti gli hook;
  - `voiceNotes` resta solo per il Blob, letta on-demand dal player/backup;
  - in alternativa, un hook `useVoiceNoteMeta()` che usa una tabella separata o un worker.
- **Fix minimo:** non usare `useVoiceNotes` in Dashboard/Ricerca/Link; creare `useVoiceNoteCount`, `useVoiceNoteTitles`, `useTranscripts` con query dedicate. Attenzione: `.map(({blob,...meta}) => meta)` **non evita** il caricamento del Blob da IndexedDB.
- **Test/perf:** misurare `performance.memory`/DevTools con 100 vocali finte; la Dashboard non deve caricare Blob.

#### B04 — Apertura di file Vault non fidati nello stesso origin

- **Dove:** `src/features/vault/VaultPage.tsx:90-99` (`getVaultBlob` → `URL.createObjectURL` → `window.open`); upload libero in `VaultPage.tsx:100-120`; `createVaultFile` in `src/db/seed.ts`.
- **Sintomo:** un file SVG/HTML caricato manualmente nel Vault viene aperto in una nuova tab `blob:` con l'origine dell'app.
- **Causa:** il blob viene aperto come documento top-level; un SVG può contenere script e, in alcuni browser, il documento `blob:` eredita l'origine del creatore. Non c'è CSP e non c'è sanitizzazione dei file.
- **Impatto:** potenziale **stored XSS same-origin**: accesso a IndexedDB (note, spese, vault), esfiltrazione tramite richieste esterne. La gravità dipende dal browser, ma il modello di minaccia è reale perché il Vault accetta qualsiasi file.
- **Fix:**
  - per immagini: mostrare in `<img>` (gli script SVG non girano in `<img>`);
  - per PDF: `<iframe sandbox>` senza `allow-scripts` oppure download;
  - per HTML/SVG/testo: forzare il download con nome file e `type: application/octet-stream`; non aprire mai come documento;
  - validare il MIME e rifiutare `image/svg+xml` o sanitizzarlo;
  - aggiungere CSP (`default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`) compatibile con lo script inline del tema (hash/nonce);
  - nell'estensione, accettare solo `data:image/png` e `data:image/jpeg` per gli screenshot.
- **Test:** caricare un SVG con `<script>` e verificare che non venga eseguito; test manuale su Chrome/Firefox/Safari.

---

### 4.2 P1 — funzionalità compromesse

#### B05 — “Non trovato” irraggiungibile e soft-deleted apribile

- **Dove:** `src/hooks/useData.ts:47-49,78-80,209-211`; pagine `NoteEditorPage.tsx:94-110`, `ReaderPage.tsx:23-39`, `WhiteboardEditorPage.tsx:44-62`.
- **Sintomo:** aprendo `/notes/id-inesistente` o un URL salvato dopo l'eliminazione, lo spinner resta per sempre. Il ramo `note === null` / `!bookmark` non viene mai raggiunto.
- **Causa:** `db.notes.get(id)` restituisce `undefined` sia durante il caricamento sia quando la riga non esiste. I hook restituiscono direttamente quel valore e non filtrano `deletedAt`.
- **Impatto:** UX bloccata; un elemento cancellato resta modificabile via URL (le modifiche vengono salvate su una riga con `deletedAt` valorizzato).
- **Fix:**

```ts
export function useNote(id?: string) {
  return useLiveQuery(async () => {
    if (!id) return null
    const note = await db.notes.get(id)
    return note && !note.deletedAt ? note : null
  }, [id])
}
// undefined = loading, null = missing
```

Applicare lo stesso pattern a bookmark, whiteboard, eventi e vocali se si aggiungono route di dettaglio.

#### B06 — Le abitudini archiviate sono irrecuperabili

- **Dove:** `src/features/habits/HabitsPage.tsx:42` (`visible = habits.filter(!archived)`), editor con checkbox “Archiviata” a `:333-338`.
- **Sintomo:** si archivia un'abitudine, sparisce dalla lista e non c'è alcun tab/sezione “Archiviate”. Non è più possibile disarchiviarla né eliminarla.
- **Causa:** la pagina non espone le abitudini archiviate, ma l'unico controllo per cambiare `archived` è dentro l'editor della singola abitudine.
- **Impatto:** perdita funzionale permanente (recuperabile solo modificando IndexedDB o un backup).
- **Fix:** aggiungere un filtro/tab “Attive / Archiviate” come in Note e Bookmark; mostrare le archiviate in sola lettura con azioni “Ripristina” ed “Elimina”. In alternativa, una sezione comprimibile in fondo.

#### B07 — Race condition del TagInput su blur + salvataggio

- **Dove:** `src/components/ui/TagInput.tsx:52-60`.
- **Sintomo:** si digita un tag e si clicca subito “Salva” (o un suggerimento): a volte il tag non viene salvato.
- **Causa:** `onBlur` chiama `commit()`, che fa `onChange([...value, draft])`; il click sul bottone usa ancora la closure con il vecchio `value` e chiama `onChange([...oldValue, tag])`, sovrascrivendo il commit appena fatto. Il salvataggio del modal legge lo stato precedente al re-render.
- **Impatto:** perdita silenziosa dell'ultimo tag, soprattutto su mobile.
- **Fix:** esporre un `ref` con `flush()` chiamato prima di ogni `save`; oppure tenere il draft nel componente padre e committarlo in `onChange`; oppure usare `onPointerDown` sul bottone Salva per forzare il commit prima del click. Aggiungere test con Testing Library.

#### B08 — Todo completati non spuntati nel calendario

- **Dove:** `src/features/calendar/CalendarPage.tsx:88` (`selectedTodos` non filtra `done`), rendering a `:478-486` (checkbox sempre vuota).
- **Sintomo:** nell'agenda del giorno un todo completato appare con checkbox vuota; cliccandolo viene “toggolato” e torna aperto.
- **Causa:** i pallini del mese e la vista settimana filtrano `!done`, mentre `selectedTodos` no; `DayAgenda` non riceve lo stato `done`.
- **Fix:** filtrare `!todo.done` come nel resto della pagina, oppure passare `done` e mostrare una checkbox spuntata/disabled con stile coerente.

#### B09 — Mese sbagliato per le spese del primo del mese + data vuota

- **Dove:** `src/lib/expenses.ts:18-23`; `ExpensesPage.tsx:54,74-90`.
- **Sintomo:** in fusi orari negativi (es. America), una spesa datata `2026-10-01` può essere mostrata nel mese di settembre; svuotando il campo data, la spesa viene salvata con `date: ''` e non compare in nessun mese.
- **Causa:** `new Date('YYYY-MM-DD')` interpreta la stringa come UTC; `format` usa il fuso locale. Inoltre `add()` non valida `date`.
- **Fix:** usare `parseISO` (locale) o costruire la data da `[y,m,d]`; validare `date` con `todayKey()` come fallback e mostrare errore se vuota; aggiungere `min`/`max` ragionevoli. Test con `TZ=America/New_York`.

#### B10 — Errori di salvataggio della lavagna nascosti

- **Dove:** `src/features/whiteboards/WhiteboardEditorPage.tsx:92-101`.
- **Sintomo:** se IndexedDB fallisce (quota piena, DB chiuso), lo stato passa comunque a “Salvato”.
- **Causa:** `.catch(() => { setStatus('saved') })`.
- **Impatto:** l'utente crede di aver salvato un disegno che andrà perso.
- **Fix:** stato `'error'`, toast con azione “Riprova”, salvataggio del buffer in memoria e retry; log dell'errore. Non marcare mai `saved` in caso di errore.

#### B11 — Backup/import bloccano il main thread

- **Dove:** `src/db/backup.ts:195` (`zipSync`), `:249` (`unzipSync`), `:166` (JSON.stringify del payload).
- **Sintomo:** con audio o file Vault grandi l'interfaccia si congela per secondi/minuti; su iOS la tab può essere terminata.
- **Causa:** compressione/decompressione sincrona e serializzazione completa in memoria.
- **Fix:** usare la variante asincrona di fflate in un Web Worker, leggere i Blob in streaming, mostrare progresso e consentire l'annullamento; per l'import, validare dimensione massima e numero di file prima di decomprimere.

#### B12 — I tag non vengono mai rimossi

- **Dove:** `src/db/seed.ts:70` (`removeUnusedTags` definita ma mai chiamata); `registerTags` a `:57`.
- **Sintomo:** dopo aver eliminato l'ultima nota con un tag, il tag resta nei suggerimenti e in Impostazioni.
- **Causa:** nessun flusso chiama la pulizia; inoltre `removeUnusedTags` considera anche gli elementi soft-deleted, quindi non rimuoverebbe comunque i tag usati solo da righe cancellate.
- **Fix:** chiamare una pulizia debounced dopo delete/update; filtrare `deletedAt`; aggiungere gestione tag (rinomina, eliminazione, colore) in Impostazioni. Attenzione: i tag sono usati da note, todo, bookmark e vocali.

#### B13 — Bookmark duplicati e Reader disallineato dopo cambio URL

- **Dove:** `src/features/bookmarks/BookmarksPage.tsx:310-330`; `src/db/seed.ts` (`findBookmarkByUrl` usato solo da `capture.ts`).
- **Sintomo:** si possono creare più bookmark con lo stesso URL dalla UI; cambiando l'URL di un bookmark, il vecchio `readerContent` resta e viene mostrato/ricercato come se appartenesse al nuovo URL.
- **Fix:** in `save()`, normalizzare e cercare un duplicato (`findBookmarkByUrl`); proporre “Apri esistente” o “Unisci”. Se l'URL cambia, azzerare `readerContent`/`readerUpdatedAt` e chiedere conferma.

#### B14 — Autosave delle note perso alla chiusura della tab

- **Dove:** `src/features/notes/NoteEditorPage.tsx:68-93`.
- **Sintomo:** si scrive e si chiude subito la tab: il debounce di 650 ms e il cleanup di unmount non vengono eseguiti, quindi le ultime modifiche vanno perse.
- **Causa:** non c'è flush su `pagehide`/`beforeunload`/`visibilitychange`.
- **Fix:** salvare su `visibilitychange === 'hidden'` e `pagehide`; ridurre il debounce a ~300 ms; mantenere una bozza in `localStorage` come rete di sicurezza; mostrare “Salvato” solo dopo la promise risolta.

#### B15 — Nessun ErrorBoundary e boot non resiliente

- **Dove:** `src/App.tsx:99-160`.
- **Sintomo:** un errore in un componente lazy, un chunk mancante offline o un errore IndexedDB producono schermo bianco o spinner infinito; `seedIfNeeded().catch(() => undefined)` nasconde il problema.
- **Causa:** manca un error boundary; `useSettings` restituisce `loaded: false` per sempre se la lettura fallisce; `seedIfNeeded` non distingue “già seedato” da “errore”.
- **Fix:** `ErrorBoundary` attorno alle route e attorno a ogni lazy chunk, con “Ricarica” e “Apri Impostazioni”; schermata di errore boot con dettagli; timeout/retry per IndexedDB; `navigator.storage.persist()` già presente ma va gestito l'esito.

#### B16 — Import “Sostituisci” senza seconda conferma

- **Dove:** `src/features/settings/SettingsPage.tsx:469-480`.
- **Sintomo:** un click su “Sostituisci” cancella tutti i dati e importa il backup, senza conferma ulteriore.
- **Impatto:** rischio elevato di perdita dati per errore, soprattutto su mobile.
- **Fix:** `ConfirmDialog` esplicito che riassume cosa verrà cancellato, con conferma testuale o checkbox “Ho capito”; disabilitare se il file non è stato validato; suggerire un export prima.

---

### 4.3 P2/P3 — qualità, UX e manutenzione

| ID | Problema | Dove | Impatto | Fix suggerito |
|---|---|---|---|---|
| B17 | Soft-delete senza cestino/purge: righe e Blob restano per sempre | `src/db/seed.ts:118,182,256,353,409,412,652,746,813` | Spazio occupato, privacy (“Elimina” non elimina davvero), backup esclude ma DB no | Cestino con retention (30 gg), purge manuale, cancellazione definitiva che rimuove anche Blob e link |
| B18 | `SCHEMA_VERSION` backup = 11, DB = 12 | `src/db/backup.ts:20`, `src/db/db.ts:109-122` | Backup etichettati con versione vecchia; il manifest Zod non accetta 12 | Allineare a 12, aggiungere default/migrazioni e un test di compatibilità |
| B19 | Import ZIP senza limiti: zip bomb / memoria | `src/db/backup.ts:249` | Crash o esaurimento memoria con file malevolo | Limite dimensione decompressa, numero file, rapporto compressione; validazione prima di `unzipSync` |
| B20 | Immagini remote nel Markdown | `NoteEditorPage.tsx` (react-markdown) | Aprire una nota può fare richieste esterne e leakare IP, contraddicendo il local-first | Bloccare immagini remote di default, placeholder “Carica immagine” o cache locale opt-in |
| B21 | `ConfirmDialog` mostra un testo fuori contesto | `src/components/ui/Modal.tsx:143` | “Questa azione viene eseguita solo sul tuo dispositivo” in ogni conferma, anche di eliminazione | Rimuovere il body o passare un contenuto specifico |
| B22 | BootScreen hardcoded in italiano | `src/App.tsx:160` | Utente EN vede italiano al primo avvio | Usare `boot.opening` (già presente in i18n) |
| B23 | Locale italiano hardcoded in alcuni date format | `src/lib/dates.ts:41`, `VoicePage.tsx:82,681` | Mesi italiani per utenti EN | Passare sempre `locale` da `useI18n`; default derivato dalla lingua |
| B24 | `formatHumanDuration(0)` restituisce “1 min” | `src/lib/dates.ts:145-146` | Durate inferiori a ~90 s mostrate come “1 min” | Gestire `seconds <= 0` → “0 min” e arrotondare solo > 0 |
| B25 | `now` congelato al mount in Dashboard/Habits/Journal/TimeAudit | `DashboardPage.tsx:52`, `HabitsPage.tsx:33`, `JournalPage.tsx:25`, `TimeAuditPage.tsx:23` | Dopo mezzanotte l'app mostra il giorno precedente | `useNow(60_000)` + ricalcolo `todayKey`; test con fake timers |
| B26 | Cambio mese non sincronizza il giorno selezionato | `CalendarPage.tsx:100-110` | Calendario su novembre ma agenda su ottobre | Selezionare lo stesso giorno del nuovo mese o mostrare un'agenda mensile |
| B27 | Sidebar desktop senza scroll | `src/components/layout/AppShell.tsx:83` | Su schermi bassi le ultime voci (Sveglie, Lavagne) finiscono fuori schermo | `overflow-y-auto` sulla `nav` + gruppo “Altro” |
| B28 | Risultati ricerca e collegamenti puntano alla lista, non all'elemento | `src/hooks/useData.ts:354-414`, `src/hooks/useLinks.ts:58-85` | Click su un todo/bookmark/evento non apre il dettaglio | Deep link con `?id=` o route dedicate (`/todos/:id`, `/bookmarks/:id`, ...) |
| B29 | Utilizzo storage non aggiornato dopo upload/delete | `usePwa.ts:47-70`; `VaultPage.tsx` | Impostazioni mostrano dati vecchi | `refresh()` dopo upload/delete e a ogni ritorno in Settings |
| B30 | `useMemo` del TimeAudit si ricalcola a ogni render | `TimeAuditPage.tsx:22-29` | Perf minore, ma inutile | Memoizzare `start`/`end` su `range` e `now` |
| B31 | Coda estensione senza dead-letter | `extension/src/queue.ts`, `background.ts` | Un item in errore permanente resta in coda e viene ritentato all'infinito | Max tentativi, stato “failed”, pulsante “Rimuovi” |
| B32 | Messaggio d'errore import usa “Importazione completata” | `SettingsPage.tsx:144` | Messaggio fuorviante in caso di errore | Usare `t('settings.importError')` dedicato |
| B33 | Manifest PWA con `lang: 'it'`, theme-color fisso e diverso dalla UI | `vite.config.ts:24,29`, `index.html` | Metadata incoerenti per utenti EN | Aggiornare `lang`/`theme-color` a runtime o accettare `it` come default documentato |
| B34 | Doppie query complete per note/bookmark attive+archiviate | `useData.ts:28-45,82-96`; `useLinks.ts:32-36` | Carica due volte intere tabelle | Un'unica query + partizione in memoria, o hook `useAllNotes()` condiviso |
| B35 | Estrazione Reader bloccata da CORS sulla maggior parte dei siti | `src/lib/reader.ts:52-76` | Funzione “Estrai testo” fallisce spesso | Messaggio chiaro + fallback “incolla testo” (già presente) + opzione estensione/reader proxy locale |
| B36 | Sveglie solo mentre l'app è aperta; notifica senza click/snooze | `AlarmWatcher.tsx:11-70` | Allarme perso a app chiusa; click non riporta all'app | Snooze, `notificationclick` nel SW, catch-up al ritorno in foreground, vibrazione |
| B37 | Diario storico non modificabile/eliminabile | `JournalPage.tsx` | Non si può correggere un giorno passato | Selettore data + editor; usare `deleteJournalEntry` già presente |
| B38 | Spese non modificabili | `updateExpense` in `seed.ts` mai usata | Errore di importo costringe a cancellare/ricreare | Modale di modifica con validazione |
| B39 | Errori di upload Vault non gestiti | `VaultPage.tsx:100-120` | File troppo grande → promise rejection non mostrata | try/catch, controllo quota, toast, rollback |
| B40 | Nessuna CSP | `index.html` | Superficie XSS maggiore | CSP con hash/nonce per lo script tema; test su PWA |
| B41 | Anche i file Vault vengono caricati interamente in backup | `backup.ts:177-186` | Memoria alta con PDF/video | Streaming/worker e limite per file |
| B42 | `previewUrl`/`currentAudio` globali nella pagina vocali | `VoicePage.tsx:559` | Possibili perdite se più player/route | Ref locale o store dedicato |
| B43 | Ricerca senza normalizzazione accenti | `useData.ts:417-432` | “citta” non trova “città” | Tokenizer personalizzato con rimozione diacritici |
| B44 | `useGlobalSearch` non indicizza Vault, lavagne, spese, tempo | `useData.ts:322-432` | Ricerca incompleta | Aggiungere documenti e href dedicati |
| B45 | Nessun test per merge backup e soft-delete | `src/tests/db.test.ts` | Regressioni non intercettate (B01/B02) | Test dedicati (vedi §10) |
| B46 | CI solo su push main, non su PR; estensione non testata | `.github/workflows/deploy-pages.yml` | Errori scoperti tardi | Workflow `ci.yml` su PR con typecheck, lint, test, build app + extension |
| B47 | `AGENTS.md` non menziona molte feature nuove | `AGENTS.md` | Onboarding agenti meno preciso | Aggiornare mappa moduli, tabelle, comandi |
| B48 | `select` senza chevron visivo | `src/components/ui/Field.tsx:31-38` | Controllo poco riconoscibile | Icona ChevronDown assoluta o `appearance-auto` |
| B49 | Checkbox custom con check bianco fisso | `Field.tsx:81-92` | Contrasto scarso su accenti chiari (lime/amber) | Usare `currentColor`/`accent-ink` |
| B50 | `formatHumanDuration` e `formatClock` incoerenti | `dates.ts:145`, `timer.ts:7` | “1 min” vs “00:30” | Unificare le API di formattazione |

---

### 4.4 Accessibilità

Valutazione statica (WCAG 2.2 AA come riferimento).

| Elemento | Problema | Gravità | Fix |
|---|---|---|---|
| Token `text-faint` | `#8a908c` su bianco = **3.26:1**; su canvas = **3.01:1**; dark `#6f7772` su `#111614` = **3.97:1** | **Alta** | Alzare a ≥ 4.5:1 (es. `#6b736e` light, `#8b948e` dark) e usarlo solo per testo ≥ 18.66px bold / 24px |
| Accento teal default | Bianco su `#0d9488` = **3.74:1** | **Alta** | In light usare `#0f766e` (5.47:1) o rendere il testo dei bottoni bold/large; verificare tutti e 6 gli accenti |
| Swatch colore evento/lavagna | `aria-label` è l'hex (`#0d9488`) | Media | Nomi umani (“Teal”, “Indaco”, …) + `aria-pressed` |
| Canvas lavagna | Nessuna alternativa testuale, nessuna modalità keyboard | Media | Descrizione, export, strumenti con scorciatoie, focus ring |
| `Select` | Freccia rimossa senza sostituto visivo | Media | Chevron decorativo |
| `SegmentedControl` | Scroll orizzontale senza indicazione | Bassa | Gradiente/scroll snap + `aria-label` del gruppo |
| Liste lunghe | Nessuna `aria-live` per filtri/ricerca | Bassa | Annuncio conteggio risultati |
| Dialog | Focus trap nativo OK; body scroll può sbloccarsi con modal annidati | Bassa | Contatore/stack di modali per `overflow` |
| Contrasto warning/success | Testo su sfondi soft da verificare | Media | Test automatico con axe/playwright |
| Touch target | Alcune icone 28–32px | Bassa | Minimo 44×44 su mobile |

Aggiungere in CI un test `axe-core` sulle pagine principali (Playwright) e un controllo di contrasto sui token.

---

### 4.5 Sicurezza e privacy

| Tema | Stato | Raccomandazione |
|---|---|---|
| XSS Vault | Rischio potenziale (B04) | Sandbox/immagini/download, MIME allowlist, CSP |
| CSP | Assente | Aggiungere header/meta con hash per lo script inline del tema |
| Markdown | `rehype-sanitize` attivo, HTML raw non renderizzato | Bene; bloccare immagini remote per privacy |
| Backup cifrato | AES-GCM 256, PBKDF2 310k, header autenticato | Bene; valutare Argon2id (WASM) o iterazioni PBKDF2 più alte e un indicatore di forza password |
| Dati at-rest | IndexedDB in chiaro | Documentare chiaramente; opzionale cifratura per nota/Vault |
| “Vault” | Non è un vault cifrato: è un archivio file | Rinominare o implementare cifratura; non dare falsa percezione di sicurezza |
| Soft-delete | Dati “eliminati” ancora presenti | Cestino + purge + informativa |
| Estensione | Permessi host opzionali ampi, bridge same-origin | Limitare ai domini configurati, validare MIME screenshot, dead-letter |
| Zip bomb | Nessun limite | Limiti di dimensione/rapporto prima di decomprimere |
| Segreti | `.env.deploy` ignorato e permessi 600 | Bene; non stamparlo mai, non includerlo nei backup |
| Telemetria | Nessuna | Bene, coerente con local-first |
| Web Speech | Audio inviato al provider browser | Consenso già presente; mantenere opt-in e spiegare chiaramente |

---

## 5. Proposte di miglioramento UI/UX

### 5.1 Principi guida

1. **Local-first visibile:** l'utente deve capire in ogni momento dove sono i dati, se sono salvati e quando è l'ultimo backup.
2. **Una cosa alla volta:** ridurre la densità nelle schermate operative (note, todo, calendario) e usare progressive disclosure per Vault/Lavagne/Spese.
3. **Coerenza prima di varietà:** stessi pattern per liste, filtri, empty state, conferme, undo.
4. **Mobile non è un desktop ridotto:** azioni primarie in basso, target ≥ 44px, bottom sheet, niente hover-only.
5. **Accessibilità come requisito, non rifinitura:** contrasto, focus, tastiera, screen reader.

### 5.2 Miglioramenti globali

| # | Proposta | Beneficio | Sforzo |
|---|---|---|---|
| U01 | Ricalibrare i token `faint`/`accent` per WCAG AA | Leggibilità, inclusività | S |
| U02 | Sidebar desktop scrollabile + gruppi (“Operatività”, “Contenuti”, “Altro”) | Evita voci fuori schermo | S |
| U03 | ErrorBoundary + skeleton loader per pagina | Niente schermo bianco, percezione di velocità | M |
| U04 | Command palette (⌘K): ricerca + azioni (“Nuova nota”, “Avvia timer”, “Backup”) | Produttività desktop | M |
| U05 | Cestino centralizzato con retention e “Svuota” | Recupero errori, igiene dati | M |
| U06 | Indicatore di stato locale (salvato / offline / ultimo backup) nella shell | Fiducia nel local-first | S |
| U07 | Undo coerente per tutte le azioni distruttive (già presente in parte) | Riduce paure | S |
| U08 | Conferme distruttive con riepilogo e checkbox “Ho capito” | Evita perdite | S |
| U09 | Selezione multipla + azioni bulk su note/todo/vocali/file | Gestione grandi archivi | M |
| U10 | Virtualizzazione liste lunghe (vocali, spese, sessioni, backup) | Performance | M |
| U11 | Filtri persistenti per pagina (localStorage/URL) | Continuità | S |
| U12 | Empty state con azione primaria e suggerimento contestuale | Onboarding | S |
| U13 | Scorciatoie: `n` nota, `t` todo, `/` ricerca, `Esc` chiudi, `⌘S` salva | Power user | S |
| U14 | Tema “auto” già presente: aggiungere preview live e contrasto verificato | Fiducia | S |
| U15 | Micro-animazioni solo su trasformazioni/opacità; rispettare `prefers-reduced-motion` (già fatto) | Fluidità | S |
| U16 | Badge “offline” anche su desktop e stato service worker | Chiarezza | S |
| U17 | Toast con azione “Annulla” e timeout configurabile | Recupero | S |
| U18 | Ricerca globale con filtri per tipo/tag/data e snippet evidenziati | Ritrovamento | M |
| U19 | Coerenza date: sempre `locale` e formato relativo dove utile | Meno ambiguità | S |
| U20 | Pagina “Aiuto / Scorciatoie / Stato sistema” | Supporto | S |

### 5.3 Miglioramenti per pagina

| Pagina | Problemi attuali | Proposte |
|---|---|---|
| **Dashboard** | `now` congelato; widget non configurabili; statistiche statiche | Orologio live, refresh a mezzanotte, widget riordinabili, card “streak”, “prossimo evento”, “backup”, “cestino” |
| **Note** | Nessun ordinamento, filtro tag o bulk; doppia query | Ordinamento (recenti, titolo, pin), filtro tag, selezione multipla, vista lista/griglia, contatore parole |
| **Editor nota** | Toolbar minima, nessun focus mode, autosave fragile | Toolbar espandibile, slash commands, focus mode, salvataggio su visibilitychange, anteprima split su desktop, template, allegati |
| **Todo** | Nessun progetto/lista, ricorrenza o reminder; drag assente | Liste/progetti, todo ricorrenti, reminder, drag & drop, linguaggio naturale (“domani 18:00”), subtask inline, bulk complete |
| **Bookmark** | Duplicati, nessun import, reader disallineato | Dedup, import HTML bookmark, favicon opzionale locale, filtri tag/stato, bulk archive |
| **Reader** | Estrazione CORS, tipografia base, nessuna evidenziazione | Tipografia regolabile, highlight, TTS, progresso lettura, “Aggiungi a nota”, stato offline |
| **Calendario** | Nessuna griglia oraria, nessun drag/ICS, giorno selezionato non sincronizzato | Vista settimana/giorno a griglia, drag & drop, ICS import/export, reminder, eventi multi-giorno, legenda colori |
| **Vocali** | Nessun trim/velocità, Blob pesanti, nessuna cartella | Trim, playback 0.5–2×, trascrizione locale, cartelle/tag, bulk delete, blocco registrazione, waveform più leggera |
| **Diario** | Solo oggi, storico non editabile, nessun mood | Selettore data, editing storico, mood, prompt guidati, calendario dei giorni scritti, autosave |
| **Abitudini** | Archiviate invisibili, target settimanale non mostrato | Tab attive/archiviate, progresso target, heatmap, note per log, reminder, riordino |
| **Timer** | Nessun ciclo pausa, notifiche deboli, sessione non editabile | Cicli lavoro/pausa, notifiche, modifica sessione attiva, inserimento manuale |
| **Time audit** | `now` congelato, nessun grafico/export | Navigazione periodo, grafici, export CSV, modifica/merge sessioni |
| **Spese** | Nessuna modifica, data non validata, no ricorrenti | Modale edit, spese ricorrenti, CSV import/export, grafici, categorie gestite, multi-valuta |
| **Vault** | Nessuna cifratura, nessuna preview, upload fragile | Cifratura opzionale, preview sicure, drag & drop, quota, tag, versioning, download multiplo |
| **Lavagne** | Solo penna/gomma, niente zoom/forme/testo | Forme, testo, zoom/pan, sfondi, template, export SVG, retry salvataggio |
| **Sveglie** | Solo app aperta, no snooze/azioni notifica | Snooze, azioni notifica, test suono, vibrazione, catch-up |
| **Impostazioni** | Sezioni lunghe, backup poco granulare | Ricerca impostazioni, export per modulo, auto-backup, gestione tag, diagnostica, sicurezza |
| **Ricerca** | Solo query, niente filtri/snippet | Filtri tipo/tag/data, snippet, cronologia, ricerche salvate, scorciatoie |
| **Welcome** | “Ho già un backup” non apre l'import | Aprire direttamente il file picker/import; opzione “non caricare dati demo” |
| **Shell** | “Altro” non attivo sulle route del More; sidebar corta | Stato attivo del More, sidebar scrollabile, badge offline desktop |

---

## 6. Proposte di nuove funzioni

Le proposte sono allineate con `idee.txt` e con la natura local-first.

### 6.1 Priorità alta (dopo i bug P0/P1)

| ID | Funzione | Valore | Complessità | Note |
|---|---|---|---|---|
| N01 | **Cestino e retention** | Recupero, privacy, spazio | M | Soft-delete già pronto; serve UI + purge Blob/link |
| N02 | **Export/import granulare** (Markdown, CSV, ICS, JSON per modulo) | Interoperabilità e backup leggeri | M | Non sostituisce il backup ZIP |
| N03 | **Auto-backup locale** (File System Access API) | Riduce rischio perdita dati | M | Solo Chromium; fallback reminder |
| N04 | **Cifratura at-rest opzionale** | Privacy su dispositivi condivisi | L | Chiave derivata da passphrase, AES-GCM per record; migrazione |
| N05 | **Ricerca con filtri e snippet** | Ritrovamento rapido | M | MiniSearch già presente; aggiungere campi e UI |
| N06 | **Todo ricorrenti + reminder** | Uso quotidiano | M | Riusare `recurrence.ts`; notifiche best-effort |
| N07 | **Wiki-link `[[nota]]` + backlink/graph** | Conoscenza collegata | M | EntityLinks già esistente |
| N08 | **Calendario a griglia + ICS** | Pianificazione reale | L | Vista settimana/giorno, import/export |
| N09 | **Trascrizione locale (Whisper WASM)** | Privacy vs Web Speech cloud | L | Modello scaricabile opt-in, worker |
| N10 | **Template** (note, todo, checklist, lavagne) | Velocità | S | Salva/istanzia template |

### 6.2 Sincronizzazione e AI (le idee di `idee.txt`)

| ID | Funzione | Valore | Complessità | Dipendenze |
|---|---|---|---|---|
| N11 | **Sync locale P2P via WebRTC/CRDT** | Multi-dispositivo senza server | XL | Cifratura, modello di conflitto (Yjs/Automerge), pairing QR |
| N12 | **Assistente AI RAG + azioni** | Ricerca semantica e automazioni | XL | Provider compatibile OpenAI/OpenRouter/OpenCode Go, tool calling, conferma azioni, chiavi locali |
| N13 | **AI nelle note** (riscrivi, traduci, riassumi, correggi) | Produttività | L | Diff/anteprima, undo, opt-in, costo per richiesta |
| N14 | **Password manager con Vault cifrato + autofill** | Sostituisce il “Vault” attuale | XL | Cifratura, estensione, integrazione form, threat model |
| N15 | **App desktop/mobile** | Notifiche native, filesystem, background | L | Tauri (desktop) / Capacitor (mobile), riuso PWA |
| N16 | **AI locale opzionale** (Ollama/WebLLM) | Privacy totale | L | Richiede hardware; fallback cloud |

**Raccomandazione sull'ordine:** non partire da sync o AI. Prima servono **cestino, cifratura, modello di conflitto e backup affidabile**; altrimenti sync e AI amplificano i bug esistenti (duplicati, soft-delete, Blob).

### 6.3 Altre funzioni ad alto valore

| ID | Funzione | Perché |
|---|---|---|
| N17 | Promemoria per todo/eventi (in-app + notifiche) | Colma il gap tra calendario e todo |
| N18 | Import da Markdown/CSV/ICS/bookmark HTML | Migrazione da altre app |
| N19 | Lavagne con forme, testo, zoom, export SVG | Uso reale oltre lo scarabocchio |
| N20 | Spese ricorrenti + grafici + multi-valuta | Gestione finanziaria seria |
| N21 | Abitudini con heatmap, obiettivi e note | Motivazione e analisi |
| N22 | Diario con mood, prompt e calendario | Abitudine quotidiana |
| N23 | Template e quick capture avanzata | Velocità di cattura |
| N24 | Share target POST/file handling | Condivisione da mobile |
| N25 | Scorciatoie e menu contestuale nell'estensione | Cattura più rapida |
| N26 | Diagnostica dati (integrità, orfani, duplicati) | Manutenzione e fiducia |
| N27 | Cestino per Vault/Lavagne/Vocali con purge Blob | Spazio e privacy |
| N28 | Multi-finestra/PiP per timer e note | Workflow desktop |
| N29 | Esportazione “stampa/PDF” di note e diario | Condivisione |
| N30 | Statistiche personali (note/settimana, tempo, spese) | Riflessione e motivazione |

---

## 7. Miglioramenti alle funzioni esistenti

### 7.1 Data layer

- **Proiezioni**: creare hook “meta” per vocali, bookmark e note (senza Blob/`readerContent`) e usarli in Dashboard/Ricerca/Link.
- **Query mirate**: usare gli indici Dexie (`updatedAt`, `dueDate`, `date`, `start`, `[habitId+date]`) invece di `toArray()` + sort in JS.
- **Una query per tabella**: `useAllNotes` + partizione attive/archiviate, invece di due `toArray()`.
- **Paginazione/virtualizzazione**: limite + `offset` o `useVirtualizer` per liste grandi.
- **Transazioni**: le operazioni multi-tabella (delete + cleanup link/tag/blob) devono essere atomiche.
- **Cascade**:
  - delete entità → soft-delete dei link uscenti/entranti;
  - delete voce → rimuovi/soft-delete log collegati (per le abitudini);
  - purge → rimuovi Blob e righe figlie.
- **Schema versioning**: un'unica costante condivisa tra DB e backup; test di migrazione da v1 a vN.
- **Validazione**: Zod anche in scrittura (non solo backup), almeno per import e capture.

### 7.2 Backup

- Correggere B01/B02 (merge per chiave naturale).
- Rendere asincrono e cancellabile (worker + progress).
- Validare dimensione/rapporto prima di decomprimere.
- Aggiungere test di merge, backup vuoto, backup con file mancanti, backup corrotto, password errata.
- Introdurre backup incrementale o “solo dati” vs “dati + media”.
- Aggiornare `SCHEMA_VERSION` e documentare le migrazioni.
- Mostrare un riepilogo pre-import (conteggi, data export, versione) e una conferma per “Sostituisci”.
- Aggiungere integrità (hash) e, opzionalmente, firma.

### 7.3 Ricerca

- Filtri per tipo, tag, data, stato (archiviate incluse su richiesta).
- Snippet con evidenziazione del match.
- Normalizzazione diacritici e stemming leggero.
- Indicizzazione di Vault, lavagne, spese, sessioni.
- Deep link ai dettagli (B28).
- Cronologia e ricerche salvate.
- Worker per l'indice se i contenuti crescono.

### 7.4 i18n

- Localizzare messaggi di errore di backup/import (`backup.ts` lancia stringhe italiane).
- Passare sempre `locale` a `formatDate`.
- `BootScreen` con `boot.opening`.
- Manifest `lang` e `theme-color` coerenti o documentati.
- Test che tutte le chiavi `it` esistano in `en` (già garantito dal tipo) e che i plurali usati da `tCount` esistano.
- Formati valuta/data per lingua (già fatto per le spese).

### 7.5 Performance

- B03 (Blob vocali), B11 (backup), B34 (doppie query).
- Memoizzare `start`/`end` nel TimeAudit.
- Evitare `setState` in effect dove derivabile (warning oxlint).
- Virtualizzare liste lunghe.
- Ridurre il numero di hook live montati contemporaneamente (EntityLinks carica molti dati).
- Considerare `useDeferredValue` per la ricerca.

### 7.6 Sicurezza

- B04 + CSP + MIME allowlist + sandbox.
- Bloccare immagini remote nelle note (B20).
- Limiti ZIP (B19).
- Documentare che IndexedDB è in chiaro e che il Vault non è cifrato.
- Estensione: permessi host limitati, screenshot solo PNG/JPEG, dead-letter queue.
- Non loggare mai contenuti sensibili o chiavi.

### 7.7 Accessibilità

- Token contrasto, focus, target touch.
- Etichette umane per colori.
- Canvas alternativa.
- `aria-live` per ricerca/filtri/salvataggio.
- Test axe in CI.
- Supporto tastiera per liste e dialog.

### 7.8 Estensione browser

- Dead-letter (B31).
- Menu contestuale e scorciatoie.
- Cattura selezione → nota/todo con titolo dalla prima riga (come nella UI).
- Anteprima della coda e degli errori.
- Supporto Firefox (MV3) come valutazione.
- Allineare i limiti (`MAX_SCREENSHOT_CHARS`) e la validazione MIME.

### 7.9 CI e qualità

- Workflow `ci.yml` su PR: typecheck, lint, test, build app, typecheck/build estensione.
- Test e2e Playwright per i flussi critici (crea nota, todo, backup/restore, calendario).
- Test di accessibilità axe sulle pagine principali.
- Test di performance/memoria con dati sintetici.
- Aggiornare `AGENTS.md` con nuove tabelle/moduli e “gotcha”.

---

## 8. Roadmap consigliata

### Sprint 0 — “Fermare le perdite” (2–3 giorni)

| Task | Riferimento | Criterio di accettazione |
|---|---|---|
| Fix merge diario e habit log | B01, B02 | Test di regressione verdi; import merge con date duplicate non fallisce |
| Fix not-found + soft-deleted | B05 | URL invalido mostra “non trovato”; elemento cancellato non è modificabile |
| Sandbox Vault + MIME allowlist | B04 | SVG/HTML non eseguono script; solo PNG/JPEG dall'estensione |
| Hook meta vocali | B03 | Dashboard/Ricerca non caricano Blob |
| ErrorBoundary + boot resiliente | B15 | Errore simulato mostra schermata di recupero |
| Test merge/soft-delete | B45 | Nuovi test in `db.test.ts` |

### Sprint 1 — “UX e accessibilità” (4–6 giorni)

- B06 archivio abitudini.
- B07 TagInput.
- B08 calendario.
- B09 spese/data.
- B10 lavagna.
- B16 conferma replace.
- U01–U03, U05, U06, U08, U09.
- B21, B22, B23, B24, B25, B27.
- Test axe + contrasto.

### Sprint 2 — “Produttività” (1–2 settimane)

- Cestino e purge (N01).
- Export/import granulare (N02).
- Ricerca con filtri/snippet (N05).
- Todo ricorrenti + reminder (N06).
- Wiki-link/backlink (N07).
- Calendario a griglia base (N08).
- Template (N10).
- Modifica spese + CSV (N20).
- Abitudini: archivio, target, heatmap (N21).
- Lavagne: forme/testo/zoom base (N19).

### Sprint 3 — “Fiducia e scala” (2–4 settimane)

- Cifratura at-rest opzionale (N04).
- Auto-backup locale (N03).
- Trascrizione locale (N09).
- Diagnostica dati (N26).
- App desktop/mobile (N15).
- Sync P2P/CRDT (N11) solo dopo modello di conflitto e cifratura.
- AI RAG/azioni e AI note (N12/N13) con opt-in, conferma azioni e controllo costi.
- Password manager (N14) come progetto separato con threat model dedicato.

### Stime indicative

| Area | Sforzo | Rischio |
|---|---|---|
| Bug P0 | S–M | Basso, ma richiede test |
| Bug P1 | M | Medio |
| UX/accessibilità | M | Basso |
| Cestino + backup async | M | Medio |
| Ricerca + calendario | M–L | Medio |
| Cifratura + sync | L–XL | Alto (migrazioni, conflitti) |
| AI | L–XL | Alto (privacy, costi, prompt injection) |

---

## 9. Quick wins

- [ ] Riusare l'id esistente nel merge di diario e habit log.
- [ ] Restituire `null` per “non trovato” e filtrare `deletedAt` nei hook per id.
- [ ] Creare `useVoiceNoteMeta` e sostituirlo in Dashboard/Ricerca/Link.
- [ ] Aprire i file Vault in `<img>`/`<iframe sandbox>` o forzarne il download.
- [ ] Aggiungere `ConfirmDialog` prima di “Sostituisci” backup.
- [ ] Marcare `error` (non `saved`) quando la lavagna non salva.
- [ ] Filtrare i todo completati nell'agenda del calendario.
- [ ] Validare la data delle spese e correggere `monthKey`.
- [ ] `flush()` del TagInput prima di ogni salvataggio.
- [ ] Tab “Archiviate” nelle abitudini.
- [ ] Chiamare `removeUnusedTags` dopo delete/update (filtrando i soft-deleted).
- [ ] Localizzare BootScreen e i messaggi di errore backup.
- [ ] Sidebar con `overflow-y-auto`.
- [ ] Alzare il contrasto di `faint` e dell'accento teal.
- [ ] Aggiungere ErrorBoundary e test di merge in CI.

---

## 10. Piano di test

### 10.1 Test di regressione da aggiungere

| Test | Obiettivo |
|---|---|
| `merge keeps one journal entry when date exists but id differs` | B01 |
| `merge reuses local id for journal` | B01 |
| `merge does not duplicate habit logs` | B02 |
| `deleted note is not returned by useNote-like query` | B05 |
| `missing note resolves to null, not undefined` | B05 |
| `TagInput flushes draft before save` | B07 |
| `calendar hides or checks completed todos` | B08 |
| `monthKey uses local date for YYYY-MM-DD` (`TZ=America/New_York`) | B09 |
| `rejects empty expense date` | B09 |
| `whiteboard persist failure sets error state` | B10 |
| `backup merge is atomic on invalid payload` | B01/B19 |
| `vault rejects/neutralizes SVG` (unit/security) | B04 |
| `import rejects oversized archive` | B19 |
| `backup works with 0 items and with missing media` | robustezza |
| `tag cleanup removes only unused, non-deleted tags` | B12 |

### 10.2 Test e2e suggeriti (Playwright)

- Primo avvio → onboarding → crea nota → modifica → ricarica → contenuto presente.
- Crea todo con scadenza → appare in Dashboard e Calendario → completa → sparisce dall'agenda.
- Backup → modifica dati → import replace → dati ripristinati.
- Backup da “dispositivo A” → merge su “dispositivo B” → nessun duplicato/errore.
- Voice: registra (mock MediaRecorder) → salva → ricarica → player presente.
- Vault: upload PNG → preview; upload SVG → non esegue script.
- PWA: build + preview, offline, reload, dati presenti.
- Estensione: bookmark → dedup; selection → nota; reader → contenuto; screenshot PNG.

### 10.3 Performance

- Dashboard con 100 note, 100 todo, 50 vocali (mock Blob): memoria e tempo di mount.
- Ricerca con 1.000 documenti: latenza < 100 ms.
- Backup 500 MB simulati: nessun freeze > 100 ms (worker).
- Lista vocali/spese: 60 fps durante scroll (virtualizzazione).

### 10.4 Accessibilità

- axe-core su Dashboard, Note, Todo, Calendario, Impostazioni.
- Contrasto token (script automatico).
- Navigazione completa da tastiera.
- Screen reader su modali e segmented control.

---

## 11. Appendici

### A. Mappa rapida dei file chiave

| File | Ruolo |
|---|---|
| `src/App.tsx` | Routing, boot, watcher globali |
| `src/components/layout/AppShell.tsx` | Shell, nav, quick add, more sheet |
| `src/db/db.ts` | Schema Dexie e migrazioni (v1–v12) |
| `src/db/seed.ts` | Repository CRUD, soft delete/restore, seed demo |
| `src/db/backup.ts` | Export/import ZIP, merge/replace, cifratura |
| `src/hooks/useData.ts` | Live query e ricerca globale |
| `src/hooks/useLinks.ts` | Link e target risolti |
| `src/hooks/useTimer.ts` | Timer persistente |
| `src/lib/crypto.ts` | AES-GCM/PBKDF2 |
| `src/lib/recurrence.ts` | Ricorrenze eventi/compleanni |
| `src/lib/reader.ts` | Estrazione testo e reading time |
| `src/lib/captureProtocol.ts` | Protocollo estensione |
| `src/types/models.ts` | Modelli + schemi Zod |
| `extension/src/*` | Estensione Chrome/Edge |
| `vite.config.ts` | PWA, base, Workbox |
| `.github/workflows/deploy-pages.yml` | CI/deploy |

### B. Comandi utili

```bash
pnpm typecheck            # tsc -b
pnpm lint                 # oxlint
pnpm test                 # vitest run
pnpm test:watch           # vitest
pnpm exec vitest run src/tests/db.test.ts
pnpm build                # tsc -b && vite build
pnpm preview              # test service worker
pnpm typecheck:extension
pnpm release:extension
```

### C. Non-goals / vincoli da rispettare

- **Niente backend, account o auth**: il local-first è il prodotto.
- **HashRouter**: non sostituire con BrowserRouter.
- **`manifestFilename: 'manifest.json'`**: necessario per Neocities.
- **Nessun segreto nei backup o nel repository**: `.env.deploy` resta ignorato.
- **`dist/` non committato**.
- **`idee.txt` è dell'utente**: non modificarlo senza richiesta.
- **Tema**: mantenere allineati `useTheme.ts`, script inline in `index.html`, chiavi `binhub-theme`/`binhub-accent`.
- **Base path**: usare `%BASE_URL%`/`import.meta.env.BASE_URL`, mai path assoluti.

### D. Nota finale

Questa analisi privilegia i problemi che possono **perdere dati** o **rompere la fiducia** nell'app. Le proposte di nuove funzioni (sync, AI, password manager) sono valide, ma il loro valore sarebbe vanificato se l'import dei backup continuasse a fallire, i file del Vault eseguissero script o l'app consumasse centinaia di MB per mostrare una Dashboard. La sequenza consigliata è quindi: **integrità → sicurezza → accessibilità/performance → produttività → sync/AI**.
