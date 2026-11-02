#!/usr/bin/env bash
# One-time: ask Duffel to tell Lyrtrip about airline schedule changes, then save the
# webhook secret to .env.local. Run `bash infra/deploy-site.sh` afterwards to put it live.
#
#   bash infra/register-duffel-webhook.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
set -a; . ./.env.local; set +a
grep -q '^DUFFEL_WEBHOOK_SECRET=' .env.local && { echo "DUFFEL_WEBHOOK_SECRET is already in .env.local" >&2; exit 1; }

curl -s -X POST https://api.duffel.com/air/webhooks \
  -H "Authorization: Bearer $DUFFEL_API_KEY" -H "Duffel-Version: v2" -H "Content-Type: application/json" \
  -d '{"data":{"url":"https://73j9469lxd.execute-api.us-east-1.amazonaws.com/api/flight/webhook","events":["order.airline_initiated_change_detected","order.updated"]}}' |
  node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const r = JSON.parse(s);
      if (r.errors) { console.error(r.errors); process.exit(1); }
      // Duffel shows the secret only once
      require("fs").appendFileSync(".env.local", `# Duffel webhook ${r.data.id} (airline schedule changes)\nDUFFEL_WEBHOOK_SECRET=${r.data.secret}\n`);
      console.log("Registered", r.data.id, r.data.live_mode ? "(live)" : "(test)", "- now run: bash infra/deploy-site.sh");
    });'
