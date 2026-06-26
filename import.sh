#!/usr/bin/env bash
# Copies an existing database directory and assets directory into ./data/
# so Docker can pick them up on first run.
#
# Usage: ./import.sh <path-to-db-dir> <path-to-assets-dir>
# Example (Windows paths via WSL): ./import.sh "~/stickbot/db" "~/stickbot/assets"
set -euo pipefail

DB_SRC="${1:?Usage: ./import.sh <path-to-db-dir> <path-to-assets-dir>}"
ASSETS_SRC="${2:?Usage: ./import.sh <path-to-db-dir> <path-to-assets-dir>}"

mkdir -p data/db data/assets data/logs

echo "Importing database from $DB_SRC ..."
cp -r "$DB_SRC"/. data/db/

echo "Importing assets from $ASSETS_SRC ..."
cp -r "$ASSETS_SRC"/. data/assets/

echo "Done. Run 'docker compose up -d' to start."
