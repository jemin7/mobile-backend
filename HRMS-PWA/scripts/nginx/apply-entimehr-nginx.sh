#!/usr/bin/env bash
# Run as: sudo bash /var/www/openhrm/scripts/nginx/apply-entimehr-nginx.sh
# Switches nginx from app.openhrm.in (backend :8000) to app.entimehr.com (backend :8001).
# Needs a TLS cert for app.entimehr.com at:
#   /etc/ssl/cloudflare/app.entimehr.com.pem  and  /etc/ssl/cloudflare/app.entimehr.com.key
# (Cloudflare Origin Certificate), or edit the two ssl_certificate lines in the staged conf first.
set -euo pipefail
SRC=/var/www/openhrm/scripts/nginx/app.entimehr.com.conf
DST=/etc/nginx/sites-available/openhrm.conf
BAK=/etc/nginx/sites-available/openhrm.conf.bak.$(date +%Y%m%d%H%M%S)

for f in $(grep -E '^\s*ssl_certificate(_key)?\s' "$SRC" | awk '{print $2}' | tr -d ';'); do
  [ -f "$f" ] || { echo "Missing TLS file: $f"; exit 1; }
done

cp "$DST" "$BAK"
cp "$SRC" "$DST"
if nginx -t; then
  systemctl reload nginx
  echo "nginx reloaded. Backup of old config: $BAK"
else
  cp "$BAK" "$DST"
  echo "nginx -t failed; old config restored."
  exit 1
fi
