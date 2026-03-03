#!/usr/bin/env bash
set -euo pipefail

# Render Static Site build command example:
#   bash render-build.sh
#
# Required env:
#   API_BASE_URL=https://<your-api-service>.onrender.com

: "${API_BASE_URL:?API_BASE_URL is required}"

cat > config.js <<EOC
// Auto-generated at build time
window.__CONFIG__ = {
  API_BASE_URL: "${API_BASE_URL}"
};
EOC

echo "Wrote config.js with API_BASE_URL=${API_BASE_URL}"
