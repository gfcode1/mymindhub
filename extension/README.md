# BinHub Capture (estensione Chrome/Edge)

Estensione Manifest V3 per inviare contenuti a BinHub senza server.

## Build

```bash
pnpm install
pnpm build:extension
```

L'output è in `extension/dist`. Per il pacchetto:

```bash
pnpm release:extension
# crea extension/release/binhub-capture-<versione>.zip
```

## Installazione unpacked

1. Apri `chrome://extensions` (o `edge://extensions`).
2. Attiva **Modalità sviluppatore**.
3. **Carica estensione non pacchettizzata** → seleziona `extension/dist`.
4. Apri le opzioni dell'estensione.
5. Inserisci l'URL di BinHub (default: `https://gfcode1.github.io/mymindhub/`).
6. Salva e concedi il permesso host richiesto.
7. Apri BinHub almeno una volta e completa l'onboarding.

Dopo ogni modifica al codice: `pnpm build:extension` e ricarica l'estensione dalla pagina delle estensioni.

## Uso

Dalla popup:

- Salva bookmark della pagina corrente.
- Salva la selezione come nota o todo.
- Estrai la pagina nel Reader (Readability, senza CORS).
- Incolla dagli appunti e scegli nota/todo.
- Salva uno screenshot nel Vault.
- Apri BinHub, riprova la coda o apri le impostazioni.

I contenuti vengono messi in una coda locale e inviati alla tab BinHub in background tramite un relay iniettato. La coda resta se BinHub è chiuso o irraggiungibile.

## Sicurezza e privacy

- Nessun server, nessun dato nella URL.
- Nessuna password salvata: il password manager è fuori scope.
- Permessi: `activeTab`, `scripting`, `storage`, `unlimitedStorage`, `clipboardRead`, più il permesso host per l'URL BinHub configurato.
- Il bridge accetta solo messaggi con origine, sorgente e protocollo attesi.

## Limiti

- Chrome/Edge MV3; niente Firefox/Safari.
- Niente menu contestuale o scorciatoie in v1.
- L'URL BinHub deve essere raggiungibile e autorizzato.
- I capture vengono applicati solo quando BinHub ha completato l'onboarding.
- Coda massima 20 elementi; selezione 100 KB, Reader 300 KB, screenshot singolo.

## Test manuale

1. Configura URL e permesso.
2. Salva un bookmark, poi ripeti: non deve duplicarsi.
3. Salva una selezione come nota e come todo.
4. Estrai una pagina nel Reader e verifica che sia ricercabile in BinHub.
5. Incolla dagli appunti e salva.
6. Salva uno screenshot e controlla il Vault.
7. Chiudi BinHub e ripeti: deve aprirsi in background e salvare.
8. Metti BinHub offline/irraggiungibile: la coda deve restare con badge.
9. Verifica IT/EN dal browser.
