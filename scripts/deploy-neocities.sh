#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
PRUNE=0
SKIP_BUILD=0
SUPPORTER=0
ASSUME_YES=0

usage() {
  cat <<'EOF'
Deploy di BinHub su Neocities.

Uso:
  pnpm deploy:neocities            build + deploy
  pnpm deploy:neocities:dry        build + anteprima, nessun upload
  pnpm deploy:neocities:prune      build + deploy + rimozione file orfani

Oppure:
  bash scripts/deploy-neocities.sh [opzioni]

Opzioni:
  -n, --dry-run      Mostra cosa verrebbe caricato, senza modificare il sito
  -p, --prune        Elimina i file remoti non presenti in dist/ (distruttivo)
      --skip-build   Usa il dist/ esistente senza ricostruire
  -S, --supporter    Abilita la modalità supporter di Neocities
  -y, --yes          Non chiedere conferma per --prune
  -h, --help         Mostra questo aiuto

Configurazione (env o .env.deploy):
  NEOCITIES_SITE       Nome del sito, es. miosito
  NEOCITIES_API_KEY    API key da https://neocities.org/settings

La chiave non viene mai stampata né salvata nel repository.
EOF
}

for arg in "$@"; do
  case "$arg" in
    -n | --dry-run) DRY_RUN=1 ;;
    -p | --prune) PRUNE=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    -S | --supporter) SUPPORTER=1 ;;
    -y | --yes) ASSUME_YES=1 ;;
    --) ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Opzione sconosciuta: $arg" >&2
      echo >&2
      usage >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env.deploy ]]; then
  echo "Carico configurazione da .env.deploy"
  set -a
  # shellcheck disable=SC1091
  . ./.env.deploy
  set +a
fi

SITE_INPUT="${NEOCITIES_SITE:-${ASYNC_NEOCITIES_SITE_NAME:-}}"
KEY_INPUT="${NEOCITIES_API_KEY:-${ASYNC_NEOCITIES_API_KEY:-${NEOCITIES_API_TOKEN:-}}}"

if [[ -z "$SITE_INPUT" ]]; then
  echo "Errore: NEOCITIES_SITE non impostato." >&2
  echo "Crea .env.deploy partendo da .env.deploy.example oppure esporta la variabile." >&2
  exit 1
fi

if [[ -z "$KEY_INPUT" ]]; then
  echo "Errore: NEOCITIES_API_KEY non impostata." >&2
  echo "La trovi in Neocities: Settings -> API key." >&2
  echo "Non inserirla mai nel repository: usa .env.deploy (già ignorato da Git)." >&2
  exit 1
fi

SITE="${SITE_INPUT#http://}"
SITE="${SITE#https://}"
SITE="${SITE%%/*}"
SITE="${SITE%.neocities.org}"

if [[ ! "$SITE" =~ ^[A-Za-z0-9-]+$ ]]; then
  echo "Errore: nome sito non valido: '$SITE_INPUT'." >&2
  echo "Usa solo lettere, numeri e trattini, senza https:// né .neocities.org." >&2
  exit 1
fi

if [[ "$PRUNE" -eq 1 ]]; then
  echo "ATTENZIONE: --prune elimina da Neocities tutti i file che non sono presenti in dist/."
  if [[ "$DRY_RUN" -eq 0 && "$ASSUME_YES" -eq 0 && -t 0 ]]; then
    read -r -p "Continuare con il cleanup? [y/N] " reply
    case "$reply" in
      y | Y | yes | YES) ;;
      *)
        echo "Operazione annullata."
        exit 1
        ;;
    esac
  fi
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "Build di produzione..."
  pnpm build
else
  echo "Uso il dist/ esistente (--skip-build)."
fi

if [[ ! -f dist/index.html ]]; then
  echo "Errore: dist/index.html non trovato. Esegui il build." >&2
  exit 1
fi

if [[ ! -f dist/manifest.json ]]; then
  echo "Errore: dist/manifest.json non trovato." >&2
  echo "Il manifest deve chiamarsi manifest.json per essere servito correttamente da Neocities." >&2
  exit 1
fi

if ! grep -q 'manifest.json' dist/index.html; then
  echo "Errore: dist/index.html non collega manifest.json." >&2
  exit 1
fi

if [[ ! -f dist/sw.js ]]; then
  echo "Errore: dist/sw.js non trovato: la PWA non funzionerebbe offline." >&2
  exit 1
fi

export ASYNC_NEOCITIES_SITE_NAME="$SITE"
export ASYNC_NEOCITIES_API_KEY="$KEY_INPUT"

CLI_ARGS=(--src dist)
[[ "$DRY_RUN" -eq 1 ]] && CLI_ARGS+=(--preview)
[[ "$SUPPORTER" -eq 1 ]] && CLI_ARGS+=(--supporter)
[[ "$PRUNE" -eq 1 ]] && CLI_ARGS+=(--cleanup)

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Anteprima del deploy per $SITE.neocities.org..."
else
  echo "Deploy su $SITE.neocities.org..."
fi

if ! pnpm exec async-neocities "${CLI_ARGS[@]}"; then
  echo
  echo "Deploy non riuscito. Controlla NEOCITIES_SITE, la API key e la connessione di rete." >&2
  exit 1
fi

echo
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Anteprima completata: nessun file è stato caricato."
else
  echo "Deploy completato: https://$SITE.neocities.org/"

  CSP_HEADER="$(curl -fsSI "https://$SITE.neocities.org/" 2>/dev/null | tr -d '\r' | grep -i '^content-security-policy:' || true)"
  if [[ -n "$CSP_HEADER" ]] && ! grep -qiE "worker-src[^;]*(\*|'self')" <<<"$CSP_HEADER"; then
    echo
    echo "Avviso: la Content-Security-Policy di Neocities (worker-src blob:) blocca il service worker."
    echo "         L'app funziona online e i dati restano locali, ma non può andare offline su questo host."
    echo "         Per l'offline completo serve un host con CSP permissiva (es. Netlify, Cloudflare Pages)."
  else
    echo "Riapri l'app per ricevere l'eventuale prompt di aggiornamento della PWA."
  fi
fi
