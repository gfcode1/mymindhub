# BinHub

PWA offline-first e mobile-first per tenere insieme **note**, **todo**, **bookmark**, **calendario** e **note vocali**. Tutti i dati restano sul dispositivo (IndexedDB): nessun account, nessun server, nessun tracciamento.

## Funzionalità

- **Note** con Markdown, anteprima sanitizzata, autosalvataggio, tag, pin e archivio.
- **Todo** con scadenze, priorità, sotto-attività, filtri e completamento rapido.
- **Bookmark** con validazione URL, descrizione, tag, archivio e fallback a iniziali (nessuna richiesta esterna).
- **Calendario** con viste mese/settimana/giorno, eventi e todo in scadenza.
- **Note vocali** registrate con MediaRecorder, waveform, player, tag e download audio.
- **Ricerca globale** offline su note, todo, link, eventi e vocali.
- **Backup** completo in ZIP (dati + audio) con importazione unisci/sostituisci.
- Tema chiaro/scuro/sistema, accento configurabile, installazione PWA e funzionamento offline.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Dexie (IndexedDB) · Zustand · MiniSearch · Zod · vite-plugin-pwa (Workbox).

## Sviluppo

```bash
pnpm install
pnpm dev
```

## Comandi

```bash
pnpm dev        # sviluppo
pnpm build      # typecheck + build di produzione
pnpm preview    # anteprima della build (necessaria per testare il service worker)
pnpm typecheck  # TypeScript
pnpm lint       # oxlint
pnpm test       # Vitest
```

## Struttura

```
src/
  components/     UI riutilizzabile
  features/       dashboard, notes, todos, bookmarks, calendar, voice, search, settings
  db/             schema Dexie, repository, seed, export/import backup
  hooks/          dati live (Dexie), tema, PWA, storage
  lib/            utilità date, URL, ricerca, navigazione
  types/          modelli e schemi Zod
  tests/          unit test
```

## Dati e backup

- Database: IndexedDB `binhub` (Dexie). Le cancellazioni sono soft-delete con undo.
- Backup: archivio `.binhub.zip` contenente `manifest.json`, `data.json` e `audio/*`. L'importazione valida schema e versione con Zod.
- Il browser può sfrattare IndexedDB (soprattutto su iOS): l'app richiede lo storage persistente quando possibile e ricorda di esportare un backup.
- I dati non vengono mai inviati a servizi esterni. Anche le favicon dei bookmark non vengono recuperate online.

## PWA

- Installabile su Android/desktop dal prompt del browser; su iOS da **Condividi → Aggiungi a Home**.
- Service worker generato da Workbox: precache dell'app shell e degli asset, aggiornamento con prompt.
- Per testare offline: `pnpm build && pnpm preview`, apri l'app, poi imposta il browser offline e ricarica.

## Deploy su Neocities

Prerequisiti: account Neocities e API key (Neocities → Settings → API key). Il deploy usa `async-neocities`, incluso nelle devDependencies: non serve Ruby.

```bash
cp .env.deploy.example .env.deploy
# compila NEOCITIES_SITE (senza .neocities.org) e NEOCITIES_API_KEY

pnpm deploy:neocities:dry    # build + anteprima, nessun upload
pnpm deploy:neocities        # build + deploy
pnpm deploy:neocities:prune  # come sopra + rimozione file orfani (distruttivo)
```

Note specifiche di Neocities:

- Il routing usa `HashRouter` (`/#/notes/...`), perché Neocities non supporta rewrite SPA lato server.
- Il manifest è generato come `manifest.json` (non `.webmanifest`): Neocities serve quest'ultimo con un MIME errato che impedisce l'installazione PWA.
- `.env.deploy` è ignorato da Git e non viene mai committato. Lo script non stampa mai la chiave.
- `--prune`/`pnpm deploy:neocities:prune` cancella i file remoti non presenti in `dist/`. Fai prima un dry-run.
- Dopo un deploy riapri l'app per ricevere il prompt di aggiornamento del service worker.
- **Limite CSP di Neocities (account free)**: l'header `Content-Security-Policy` usa `worker-src blob:` e blocca la registrazione del service worker. L'app funziona online e i dati restano in IndexedDB, ma su Neocities non può funzionare offline e il caching PWA è disabilitato dal browser. Per l'offline completo serve un host con CSP permissiva (Netlify, Cloudflare Pages, GitHub Pages) o un piano/accordo Neocities che consenta `worker-src 'self'`.

## Limiti v1

- Nessuna sincronizzazione multi-dispositivo (il modello dati è già predisposto con `updatedAt`/`deletedAt`).
- Trascrizione vocale non inclusa (campo `transcript` già previsto).
- Le date degli input nativi seguono la lingua del browser.
- Il deploy su Neocities usa URL con hash per garantire i deep link senza rewrite lato server.
