#!/bin/bash
set -euo pipefail
cd ./deploy/tools/sitemap-generator
# Prefer the binary shipped with the image's node_modules (no runtime yarn install).
if [ -x ./node_modules/.bin/next-sitemap ]; then
  ./node_modules/.bin/next-sitemap
elif command -v yarn >/dev/null 2>&1; then
  yarn next-sitemap
else
  echo "next-sitemap not found" >&2
  exit 1
fi
