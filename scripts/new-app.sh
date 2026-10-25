#!/usr/bin/env bash
# Scaffold a new app and it is live immediately (no rebuild): [CAT=Play] scripts/new-app.sh <id> "<Title>" "<description>" [#color]
set -e
cd "$(dirname "$0")/.."
id=$1; title=$2; desc=$3; color=${4:-#6366f1}
[[ "$id" =~ ^[a-z0-9-]+$ ]] && [ ! -e apps/$id ] || { echo "usage: new-app.sh <new-id (a-z0-9-)> <title> <desc> [color]"; exit 1; }
mkdir apps/$id
printf '{ "title": "%s", "description": "%s", "color": "%s", "cat": "%s" }\n' "$title" "$desc" "$color" "${CAT:-Utilities}" > apps/$id/app.json
cat > apps/$id/index.html <<HTML
<!doctype html><meta charset="utf-8"><title>$title</title>
<link rel="stylesheet" href="/shared/util.css"><script src="/shared/lib.js"></script><script src="/shared/util.js"></script><style>:root{--a:$color}</style>
<div class="wrap"><h1>$title</h1><p class="sub">$desc</p><div class="card" id="list"></div></div>
<script>
// api.list/add/upd/del talk to this app's own MongoDB database; see shared/public/lib.js
api.list().then(d => \$('#list').textContent = d.length + ' items');
</script>
HTML
echo "created apps/$id -> http://localhost:4100/$id/"
