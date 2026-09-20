#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CLI=$SCRIPT_DIR/../dist/src/cli.js

if [ ! -f "$CLI" ]; then
  echo "error: CLI is not built; run 'npm install && npm run build' in the repository" >&2
  exit 1
fi

exec node "$CLI" install "$@"
