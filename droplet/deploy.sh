#!/usr/bin/env bash
# Deploy the announcer (announcer/) from atpota-to/rainshare to the droplet.
#
#   /root/rainshare-live/deploy.sh              # the tip of main
#   /root/rainshare-live/deploy.sh <commit>     # a specific commit: a rollback, or a branch to try
#   FORCE=1 /root/rainshare-live/deploy.sh      # restart onto it even if its code didn't change
#
# GitHub Actions runs this on every push to main that touches what the announcer runs
# (.github/workflows/deploy-droplet.yml, through ci-deploy.sh), so usually nobody needs to.
#
# It's atpota-to/atpota.to's droplet/deploy.sh, which deploys Poe's services on this droplet,
# cut down to one service and kept to folders and a unit of its own:
#   /root/rainshare-live/          code: repo.git (a bare clone), releases/<sha>/, current -> the
#                                  running release, deploy.sh and ci-deploy.sh -> the tip of main's,
#                                  logs/
#   /root/rainshare-announcer/     data: .env, KILL. Never in git.
#
# What it does:
#  1. Unpacks the commit once into releases/<sha>/: what the announcer runs and is tested with.
#  2. Does nothing more if the announcer isn't set up here yet (no .env in its data folder): it
#     says so and succeeds, so merging before the droplet is set up doesn't fail the run.
#  3. Does nothing more if what it runs hasn't changed since the release that's running.
#  4. Runs its tests there.
#  5. Installs the unit file if it changed (and enables it the first time), switches current,
#     and restarts.
#  6. Checks health. If it's unhealthy, it goes back to the previous release by itself.
#
# A running process keeps the release it started from (node resolves the link at start). One
# deploy runs at a time.
set -euo pipefail

LIVE=/root/rainshare-live
REPO=$LIVE/repo.git
DATA=/root/rainshare-announcer
UNIT=rainshare-announcer
NODE_BIN=/opt/node22/bin
KEEP=5
HEALTH_WAIT_S=60
# What the announcer runs and is tested with: everything announcer/src/ imports (core/,
# lexicons/compat.mjs, api/_og/describe.js, and ui/bits.js, so all of ui/, which is small, in
# case bits.js comes to import its neighbours), package.json (its "type": "module"), the tests,
# and these scripts.
PARTS=(announcer core lexicons api/_og ui test package.json droplet)
# A change to these restarts it. Docs don't.
CODE=(announcer core lexicons/compat.mjs api/_og/describe.js ui/bits.js ':!*.md')

mkdir -p "$LIVE/releases" "$LIVE/logs"
exec 9>"$LIVE/.deploy.lock"
if ! flock -w 1800 9; then
  echo "!! another deploy has held the lock for 30 minutes; giving up" >&2
  exit 75
fi

old_sha=''
git -C "$REPO" fetch --quiet origin '+refs/heads/*:refs/heads/*'
sha=$(git -C "$REPO" rev-parse --verify "${1:-main}^{commit}")
short=${sha:0:12}
release=$LIVE/releases/$short
record() { echo "$(date -u +%FT%TZ) announcer ${old_sha:0:12}->${short} $1" >>"$LIVE/logs/deploys.log"; }

# git archive fails on a path the commit doesn't have, so ask only for the ones it does.
parts=()
for p in "${PARTS[@]}"; do
  git -C "$REPO" cat-file -e "$sha:$p" 2>/dev/null && parts+=("$p")
done
if [[ ! -d $release ]]; then
  tmp=$(mktemp -d "$LIVE/releases/.tmp-XXXXXX")
  git -C "$REPO" archive "$sha" "${parts[@]}" | tar -x -C "$tmp"
  echo "$sha" >"$tmp/REVISION"
  chmod 755 "$tmp"
  mv -T "$tmp" "$release"
fi

# The deploy scripts themselves come from the tip of main, never from an older commit being
# rolled back to.
link() { ln -sfn "$1" "$LIVE/.$2.next" && mv -T "$LIVE/.$2.next" "$LIVE/$2"; }
if [[ $sha == "$(git -C "$REPO" rev-parse main)" && -f $release/droplet/ci-deploy.sh ]]; then
  link "releases/$short/droplet/deploy.sh" deploy.sh
  link "releases/$short/droplet/ci-deploy.sh" ci-deploy.sh
fi

previous=$(readlink "$LIVE/current" 2>/dev/null || true)
if [[ -n $previous && -f $LIVE/$previous/REVISION ]]; then old_sha=$(cat "$LIVE/$previous/REVISION"); fi
echo "== announcer: ${old_sha:0:12}${old_sha:+ -> }$short"

# The announcer is set up on this droplet by hand, once (droplet/README.md says how): until its
# data folder has a .env, there's nothing to deploy it into.
if [[ ! -f $DATA/.env ]]; then
  echo "== the announcer isn't set up on this droplet yet (no $DATA/.env); see droplet/README.md. Nothing deployed."
  record "not-set-up"
  exit 0
fi
if [[ ! -d $release/announcer ]]; then
  echo "!! $short has no announcer/ (it predates it); nothing deployed" >&2
  record "no-announcer"
  exit 1
fi
port=$(sed -n 's/^PORT=\([0-9]\{1,5\}\).*/\1/p' "$DATA/.env" | tail -n 1)
port=${port:-8792}
health() { curl -fs --max-time 5 "http://127.0.0.1:$port/health" 2>/dev/null | grep -q '"ok":true'; }

prune() {
  # Keep every release something points at, plus the newest $KEEP.
  declare -A keep=()
  for l in current deploy.sh ci-deploy.sh; do
    target=$(readlink "$LIVE/$l" 2>/dev/null || true)
    if [[ $target == releases/* ]]; then keep[$(cut -d/ -f2 <<<"$target")]=1; fi
  done
  n=0
  while IFS= read -r dir; do
    n=$((n + 1))
    if [[ $n -gt $KEEP && -z ${keep[$(basename "$dir")]:-} ]]; then rm -rf -- "$dir"; fi
  done < <(ls -1dt "$LIVE"/releases/*/)
  return 0
}

if [[ -n $old_sha && -z ${FORCE:-} ]] && git -C "$REPO" diff --quiet "$old_sha" "$sha" -- "${CODE[@]}"; then
  echo "== what the announcer runs is unchanged since ${old_sha:0:12}; nothing to deploy"
  prune
  exit 0
fi
if [[ -n $old_sha ]]; then
  git -C "$REPO" --no-pager diff --stat "$old_sha" "$sha" -- "${CODE[@]}" || true
fi

log=$LIVE/logs/test-$short.log
echo "== testing at $short"
if ! (cd "$release/announcer" && PATH=$NODE_BIN:$PATH npm test >"$log" 2>&1); then
  tail -n 40 "$log" >&2
  echo "!! tests failed; the announcer stays on ${old_sha:0:12} (full log: $log)" >&2
  record "tests-failed"
  exit 1
fi
grep -E '^(# |ℹ )(tests|pass|fail)' "$log" || true

unit_file=/etc/systemd/system/$UNIT.service
unit_backup=$(mktemp)
cp "$unit_file" "$unit_backup" 2>/dev/null || true
if ! cmp -s "$release/announcer/$UNIT.service" "$unit_file"; then
  first_install=$([[ -f $unit_file ]] && echo 0 || echo 1)
  echo "== installing changed $UNIT.service"
  cp "$release/announcer/$UNIT.service" "$unit_file"
  systemctl daemon-reload
  # It starts at boot like Poe's services. Only the first time: after that, whether it's
  # enabled is the operator's call.
  if [[ $first_install -eq 1 ]]; then systemctl enable --quiet "$UNIT"; fi
fi

link "releases/$short" current
echo "== restarting $UNIT"
systemctl restart "$UNIT"

healthy=0
for ((i = 0; i < HEALTH_WAIT_S; i += 3)); do
  sleep 3
  if systemctl is-active --quiet "$UNIT" && health; then
    healthy=1
    break
  fi
done

if [[ $healthy -eq 1 ]]; then
  echo "== $UNIT is healthy on $short"
  record "ok"
  rm -f "$unit_backup"
  prune
  exit 0
fi

echo "!! $UNIT is not healthy on $short after ${HEALTH_WAIT_S}s" >&2
journalctl -u "$UNIT" --no-pager -o cat -n 30 >&2 || true
if [[ -n $previous ]]; then
  echo "!! rolling back to ${old_sha:0:12}" >&2
  if [[ -s $unit_backup ]] && ! cmp -s "$unit_backup" "$unit_file"; then
    cp "$unit_backup" "$unit_file"
    systemctl daemon-reload
  fi
  link "$previous" current
  systemctl restart "$UNIT"
  record "unhealthy-rolled-back"
else
  record "unhealthy"
fi
rm -f "$unit_backup"
exit 1
