#!/usr/bin/env bash
set -euo pipefail

PUSH=0
DRY_RUN=0
SKIP_CHECKS=0
INCLUDE_UNTRACKED=0
MESSAGE="deploy: publish to GitHub Pages"

usage() {
  cat <<'EOF'
Prepara il deploy su GitHub Pages con un commit locale.

Il push NON viene eseguito di default: lo script prepara il commit e stampa
il comando da lanciare. GitHub Actions compilerà e pubblicherà il sito.

Uso:
  pnpm deploy:github
  pnpm deploy:github:dry
  bash scripts/deploy-github.sh [opzioni]

Opzioni:
  -m, --message TESTO   Messaggio di commit personalizzato
  -n, --dry-run         Esegue i controlli e mostra le modifiche, senza commit
      --skip-checks     Salta typecheck, lint e test
      --include-untracked  Include anche i file non tracciati nel commit
      --push            Esegue anche git push origin main
  -h, --help            Mostra questo aiuto

Prerequisito una-tantum:
  GitHub -> Settings -> Pages -> Source: GitHub Actions
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m | --message)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "Errore: --message richiede un testo." >&2
        exit 1
      fi
      MESSAGE="$2"
      shift 2
      ;;
    -n | --dry-run)
      DRY_RUN=1
      shift
      ;;
    --skip-checks)
      SKIP_CHECKS=1
      shift
      ;;
    --push)
      PUSH=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Opzione sconosciuta: $1" >&2
      echo >&2
      usage >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Errore: questa directory non è un repository Git." >&2
  exit 1
fi

BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || true)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Errore: sei sul branch '${BRANCH:-detached}', ma il workflow parte da main." >&2
  echo "Passa su main con: git switch main" >&2
  exit 1
fi

REPO_SLUG="${GITHUB_REPOSITORY:-gfcode1/mymindhub}"
REMOTE_URL="https://github.com/$REPO_SLUG.git"
OWNER="${REPO_SLUG%%/*}"
REPO="${REPO_SLUG##*/}"

if [[ "$REPO" == "$OWNER.github.io" ]]; then
  PAGES_URL="https://$OWNER.github.io/"
else
  PAGES_URL="https://$OWNER.github.io/$REPO/"
fi
ACTIONS_URL="https://github.com/$REPO_SLUG/actions/workflows/deploy-pages.yml"

if git remote get-url origin >/dev/null 2>&1; then
  CURRENT_REMOTE="$(git remote get-url origin)"
  if [[ "$CURRENT_REMOTE" != "$REMOTE_URL" ]]; then
    echo "Aggiorno origin: $CURRENT_REMOTE -> $REMOTE_URL"
    git remote set-url origin "$REMOTE_URL"
  fi
else
  echo "Aggiungo remote origin: $REMOTE_URL"
  git remote add origin "$REMOTE_URL"
fi

if [[ -f .env.deploy ]] && ! git check-ignore -q .env.deploy; then
  echo "Errore: .env.deploy non è ignorato da Git. Aggiungilo a .gitignore prima di continuare." >&2
  exit 1
fi

if [[ "$SKIP_CHECKS" -eq 0 ]]; then
  echo "Typecheck..."
  pnpm typecheck
  echo "Lint..."
  pnpm lint
  echo "Test..."
  pnpm test
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo
  echo "Modifiche rilevate:"
  git status --short
  echo
  echo "Dry-run completato: nessun commit eseguito."
  echo "Pages: $PAGES_URL"
  exit 0
fi

UNTRACKED="$(git ls-files --others --exclude-standard)"
if [[ -n "$UNTRACKED" && "$INCLUDE_UNTRACKED" -eq 0 ]]; then
  echo "File non tracciati rilevati:"
  while IFS= read -r file; do
    echo "  $file"
  done <<<"$UNTRACKED"
  if [[ -t 0 ]]; then
    read -r -p "Includerli nel commit? [y/N] " reply
    case "$reply" in
      y | Y | yes | YES) ;;
      *)
        echo "Commit annullato. Aggiungi i file con git add oppure usa --include-untracked."
        exit 1
        ;;
    esac
  else
    echo "Commit annullato: usa --include-untracked per includere i file non tracciati." >&2
    exit 1
  fi
fi

git add -A

if git diff --cached --quiet; then
  echo "Nessuna modifica da committare."
else
  if git diff --cached --name-only | grep -qx '.env.deploy'; then
    echo "Errore: .env.deploy è finito nello staging. Commit annullato." >&2
    git reset >/dev/null
    exit 1
  fi
  git commit -m "$MESSAGE"
fi

if git rev-parse --verify --quiet refs/remotes/origin/main >/dev/null; then
  AHEAD="$(git rev-list --count origin/main..HEAD)"
else
  AHEAD=1
fi

echo
if [[ "$PUSH" -eq 1 ]]; then
  if [[ "$AHEAD" -gt 0 ]]; then
    echo "Push su origin/main..."
    git push origin main
  else
    echo "Nessun commit da pushare."
  fi
else
  if [[ "$AHEAD" -gt 0 ]]; then
    echo "Push da eseguire:"
    echo "  git push origin main"
  else
    echo "Nessun commit locale da pushare."
    echo "Se vuoi rieseguire il deploy, lancia il workflow dalla UI GitHub Actions."
  fi
fi

echo
echo "Pages:   $PAGES_URL"
echo "Actions: $ACTIONS_URL"
echo
echo "Ricorda: una volta sola, imposta Settings -> Pages -> Source: GitHub Actions."
