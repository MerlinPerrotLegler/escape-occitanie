#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

resolve_php() {
  if command -v php >/dev/null 2>&1; then
    command -v php
    return
  fi
  local mamp
  # Newest MAMP 8.x first (php8.4.1 > php8.3.14 > …)
  mamp="$(ls -1d /Applications/MAMP/bin/php/php8.*/bin/php 2>/dev/null | sort | tail -n 1 || true)"
  if [[ -n "${mamp}" && -x "${mamp}" ]]; then
    echo "${mamp}"
    return
  fi
  echo "php introuvable. Installe PHP ou MAMP, ou ajoute php au PATH." >&2
  exit 1
}

php_bin="$(resolve_php)"

if lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "API déjà sur http://127.0.0.1:8080 — réutilisation."
  while true; do sleep 3600; done
fi

exec "${php_bin}" -S 127.0.0.1:8080 -t "${root}/public"
