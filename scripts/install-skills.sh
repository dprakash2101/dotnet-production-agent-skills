#!/bin/sh
set -eu

usage() {
  cat <<'EOF'
Usage: scripts/install-skills.sh [--host shared|copilot] [--target PATH]
                                [--mode link|copy] [--force]

Installs every directory under skills/ into an agent discovery directory.
Defaults: --host shared --mode link

  shared   ~/.agents/skills (discovered by current Codex and GitHub Copilot)
  copilot  ~/.copilot/skills (Copilot-specific personal location)
  --target Explicit personal or repository skills directory, such as
           /work/api/.agents/skills

Link mode keeps installed skills synchronized with this checkout. Copy mode
creates independent snapshots. --force moves conflicts to timestamped backups.
EOF
}

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SOURCE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../skills" && pwd)
USER_HOME=${HOME:?HOME must identify the current user home directory}
HOST=shared
MODE=link
TARGET=
FORCE=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --host)
      [ "$#" -ge 2 ] || { usage >&2; exit 2; }
      HOST=$2
      shift 2
      ;;
    --target)
      [ "$#" -ge 2 ] || { usage >&2; exit 2; }
      TARGET=$2
      shift 2
      ;;
    --mode)
      [ "$#" -ge 2 ] || { usage >&2; exit 2; }
      MODE=$2
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$MODE" in link|copy) ;; *) echo "error: mode must be link or copy" >&2; exit 2 ;; esac

if [ -z "$TARGET" ]; then
  case "$HOST" in
    shared) TARGET=$USER_HOME/.agents/skills ;;
    copilot) TARGET=$USER_HOME/.copilot/skills ;;
    *) echo "error: host must be shared or copilot" >&2; exit 2 ;;
  esac
fi

mkdir -p -- "$TARGET"
BACKUP_SUFFIX=$(date +%Y%m%d%H%M%S)

for SOURCE_SKILL in "$SOURCE_DIR"/*; do
  [ -d "$SOURCE_SKILL" ] || continue
  SKILL_NAME=$(basename -- "$SOURCE_SKILL")
  DESTINATION=$TARGET/$SKILL_NAME

  if [ -L "$DESTINATION" ] && [ "$(readlink "$DESTINATION")" = "$SOURCE_SKILL" ]; then
    echo "unchanged  $SKILL_NAME"
    continue
  fi

  if [ -e "$DESTINATION" ] || [ -L "$DESTINATION" ]; then
    if [ "$FORCE" -ne 1 ]; then
      echo "error: $DESTINATION already exists (use --force to back it up)" >&2
      exit 1
    fi
    BACKUP=$DESTINATION.backup-$BACKUP_SUFFIX
    mv -- "$DESTINATION" "$BACKUP"
    echo "backup     $BACKUP"
  fi

  if [ "$MODE" = link ]; then
    ln -s -- "$SOURCE_SKILL" "$DESTINATION"
  else
    cp -R -- "$SOURCE_SKILL" "$DESTINATION"
  fi
  echo "installed  $SKILL_NAME"
done

echo "Installed skills into $TARGET using $MODE mode."
