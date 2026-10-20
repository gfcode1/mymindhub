# BinHub

PWA offline-first e mobile-first per tenere insieme **note**, **todo**, **bookmark**, **calendario** e **note vocali**. Tutti i dati restano sul dispositivo (IndexedDB): nessun account, nessun server, nessun tracciamento.

## Funzionalità

- **Note** con Markdown, anteprima sanitizzata, autosalvataggio, tag, pin e archivio.
- **Todo** con scadenze, priorità, sotto-attività, filtri e completamento rapido.
- **Bookmark** con validazione URL, descrizione, tag, archivio, stato di lettura e fallback a iniziali (nessuna richiesta esterna).
- **Reader mode**: testo estratto o incollato, salvato localmente, ricercabile e incluso nel backup; stato Da leggere/In corso/Finito.
- **Calendario** con viste mese/settimana/giorno, eventi, todo in scadenza, ricorrenze (giornaliere, settimanali, mensili, annuali) e compleanni con età.
- **Note vocali** registrate con MediaRecorder, waveform, player, tag e download audio.
- **Ricerca globale** offline su note, todo, link, eventi, vocali, diario e abitudini.
- **Dettatura e trascrizione** con Web Speech API (opt-in): testo nelle note e nel diario, trascrizione live dei vocali.
- **Backup** completo in ZIP (dati + audio) con importazione unisci/sostituisci, anche con protezione opzionale tramite password.
- **Sveglie**: orario, giorni della settimana, attivazione, suono e notifiche best-effort mentre l’app è aperta.
- **Lavagne**: whiteboard con penna, gomma, colori, spessori, undo/redo, esportazione PNG e salvataggio locale dei tratti.
- **Vault**: file e documenti in IndexedDB, checklist riutilizzabili con spunte azzerabili, ricerca e categorie.
- **Spese e budget**: movimenti di spesa/entrata, riepilogo mensile per categoria, budget totale e per categoria.
- **Collegamenti bidirezionali** tra note, todo, link, eventi e vocali, con backlink visibili su entrambi gli elementi.
- **Timer Pomodoro / cronometro** avviabile anche da todo e note, con sessione persistente tra i reload.
- **Time audit** settimanale e mensile con totale, suddivisione per categoria e storico sessioni.
- **Diario** giornaliero con tre campi rapidi (fatto, blocchi, riflessione) e storico.
- **Abitudini** con frequenza giornaliera o per giorni, streak e griglia degli ultimi 7 giorni.
- **Lingua** italiano/inglese e pagina di benvenuto al primo avvio.
- **Incolla dagli appunti** e Web Share Target: salva testo o link classificandoli automaticamente.
- Icone **OpenMoji** (CC BY-SA 4.0, © HfG Schwäbisch Gmünd) in creazione rapida e dashboard.
- Tema chiaro/scuro/sistema, accento configurabile, installazione PWA e funzionamento offline.

## Estensione browser

`extension/` contiene **BinHub Capture** per Chrome/Edge: bookmark, selezione→nota/todo, Reader, clipboard e screenshot verso BinHub, con coda locale e relay iniettato.

```bash
pnpm build:extension    # output in extension/dist
pnpm release:extension  # zip in extension/release
```

Istruzioni e limiti in [`extension/README.md`](extension/README.md).

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

# Estensione Chrome/Edge
pnpm typecheck:extension  # TypeScript estensione
pnpm build:extension      # build in extension/dist
pnpm release:extension    # build + zip in extension/release
```

## Struttura

```
src/
  components/     UI riutilizzabile
  features/       dashboard, notes, todos, bookmarks, calendar, voice, journal, habits, welcome, search, settings
  db/             schema Dexie, repository, seed, export/import backup
  hooks/          dati live (Dexie), tema, PWA, storage
  lib/            utilità date, URL, ricerca, navigazione
  types/          modelli e schemi Zod
  tests/          unit test
extension/        estensione Chrome/Edge (MV3)
```

## Dati e backup

- Database: IndexedDB `binhub` (Dexie). Le cancellazioni sono soft-delete con undo.
- Backup: archivio `.zip` contenente `manifest.json`, `data.json`, `audio/*`, `vault/*` e `whiteboards/*`. In alternativa si può esportare un file `.binhub` cifrato con AES-GCM 256 e chiave derivata via PBKDF2-SHA256. L'importazione valida schema e versione con Zod e riconosce automaticamente i file cifrati.
- La password del backup non viene salvata: se la perdi, il file cifrato non è recuperabile. La cifratura protegge il backup, non i dati live in IndexedDB.
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

## Deploy su GitHub Pages

Repository: `gfcode1/mymindhub` · URL: `https://gfcode1.github.io/mymindhub/`

Configurazione una-tantum:

1. GitHub → **Settings → Pages**.
2. **Build and deployment → Source: GitHub Actions**.

Deploy:

```bash
pnpm deploy:github        # controlli + commit locale
git push origin main      # il push lo fai tu
```

Lo script non esegue il push di default. Opzioni utili:

```bash
pnpm deploy:github:dry             # controlli + anteprima modifiche
pnpm deploy:github -- --push       # commit + push
pnpm deploy:github -- --include-untracked
```

Il workflow `.github/workflows/deploy-pages.yml` esegue test, lint, build con la base corretta (`/mymindhub/`), carica l'artefatto e pubblica su Pages. Su GitHub Pages non c'è il CSP restrittivo di Neocities, quindi service worker e offline funzionano.

La build per Neocities forza `VITE_BASE=/` e resta indipendente dal deploy GitHub.

## Limiti v1

- Nessuna sincronizzazione multi-dispositivo (il modello dati è già predisposto con `updatedAt`/`deletedAt`).
- L’estrazione automatica del reader dipende dal CORS del sito: se il browser blocca la richiesta, il testo va incollato manualmente. Il contenuto resta comunque locale.
- Le sveglie funzionano solo con l’app aperta: i browser sospendono i timer in background e su iOS le notifiche richiedono la PWA installata. Non sostituiscono una sveglia di sistema.
- Le lavagne usano una tela logica 1600×1000 e strumenti base (penna/gomma); niente forme, testo o collaborazione in v1.
- Il Vault conserva i file in IndexedDB e li include nel backup ZIP; la dimensione totale dipende dallo spazio concesso dal browser.
- Le spese usano l'euro e non gestiscono ancora movimenti ricorrenti automatici.
- I collegamenti sono manuali (picker + backlink): niente parsing di `@mention` o vista grafo in v1.
- Il timer usa timestamp, quindi sopravvive ai reload; il completamento automatico e il suono possono essere ritardati se il browser sospende la scheda.
- Le ricorrenze si modificano sempre sull'intera serie; non esistono eccezioni per la singola occorrenza. Il 31 del mese e il 29 febbraio vengono saltati quando la data non esiste.
- La dettatura Web Speech dipende dal browser: Chrome/Edge la supportano, Firefox no; in Chrome può richiedere rete e l'audio può passare da servizi del provider. È attiva solo dopo consenso esplicito e si può revocare dalle Impostazioni. Nei vocali la trascrizione avviene durante la registrazione, non su audio già salvato.
- Le date degli input nativi seguono la lingua del browser.
- Il deploy su Neocities usa URL con hash per garantire i deep link senza rewrite lato server.
