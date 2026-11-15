#!/usr/bin/env bash
# Deploy Rainshare's services from atpota-to/rainshare to the droplet: the announcer (announcer/:
# @rainshare.dev's posts, messages and the approver's review) and the index (indexer/: every
# dev.rainshare.* record, from Jetstream to Supabase). One release serves both.
#
#   /root/rainshare-live/deploy.sh              # the tip of main
#   /root/rainshare-live/deploy.sh <commit>     # a specific commit: a rollback, or a branch to try
#   FORCE=1 /root/rainshare-live/deploy.sh      # restart onto it even if its code didn't change
#
# GitHub Actions runs this on every push to main that touches what they run
# (.github/workflows/deploy-droplet.yml, through ci-deploy.sh), so usually nobody needs to.
#
# It's atpota-to/atpota.to's droplet/deploy.sh, which deploys Poe's services on this droplet,
# cut down to one service and kept to folders and a unit of its own:
#   /root/rainshare-live/          code: repo.git (a bare clone), releases/<sha>/, current -> the
#                                  running release, deploy.sh and ci-deploy.sh -> the tip of main's,
#                                  logs/
#   /root/rainshare-announcer/     the announcer's data: .env, KILL. Never in git.
#   /root/rainshare-index/         the index's data: .env, state.json. Never in git.
#
# What it does:
#  1. Unpacks the commit once into releases/<sha>/: what they run and are tested with.
#  2. Deploys only the services set up here (a .env in the data folder). With none, it says so
#     and succeeds, so merging before the droplet is set up doesn't fail the run.
#  3. Does nothing more if what they run hasn't changed since the release that's running.
#  4. Runs their tests there.
#  5. Installs each unit file if it changed (and enables it the first time), switches current,
#     and restarts them.
#  6. Checks each one's health. If any is unhealthy, it goes back to the previous release by itself.
#
# A running process keeps the release it started from (node resolves the link at start). One
# deploy runs at a time.
set -euo pipefail

LIVE=/root/rainshare-live
REPO=$LIVE/repo.git
NODE_BIN=/opt/node22/bin
KEEP=5
HEALTH_WAIT_S=60
# The services: name, data folder, unit, default health port, health path, and their tests (from
# the repo root). A service is deployed only once its data folder has a .env.
SERVICES=(announcer index)
declare -A DATA=([announcer]=/root/rainshare-announcer [index]=/root/rainshare-index)
declare -A UNIT=([announcer]=rainshare-announcer [index]=rainshare-index)
declare -A SRC=([announcer]=announcer [index]=indexer)
declare -A PORT=([announcer]=8792 [index]=8793)
declare -A HEALTH=([announcer]=/health [index]=/healthz)
# What they run and are tested with: everything announcer/src/ and indexer/src/ import (core/,
# lexicons/compat.mjs, api/_og/describe.js, and ui/bits.js, so all of ui/, which is small, in
# case bits.js comes to import its neighbours), package.json (its "type": "module"), the tests,
# and these scripts.
PARTS=(announcer indexer core lexicons api/_og ui test package.json droplet)
# A change to these restarts them. Docs don't.
CODE=(announcer indexer core lexicons/compat.mjs api/_og/describe.js ui/bits.js ':!*.md')

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
record() { echo "$(date -u +%FT%TZ) ${enabled[*]:-none} ${old_sha:0:12}->${short} $1" >>"$LIVE/logs/deploys.log"; }
enabled=()

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
# Each service is set up on this droplet by hand, once (droplet/README.md says how): until its
# data folder has a .env, there's nothing to deploy it into.
for svc in "${SERVICES[@]}"; do
  if [[ -f ${DATA[$svc]}/.env ]]; then
    if [[ -d $release/${SRC[$svc]} ]]; then enabled+=("$svc"); else echo "!! $short has no ${SRC[$svc]}/ (it predates it); $svc stays as it is" >&2; fi
  else
    echo "== $svc isn't set up on this droplet (no ${DATA[$svc]}/.env); see droplet/README.md"
  fi
done
echo "== ${enabled[*]:-nothing}: ${old_sha:0:12}${old_sha:+ -> }$short"
if [[ ${#enabled[@]} -eq 0 ]]; then
  echo "== nothing is set up on this droplet yet. Nothing deployed."
  record "not-set-up"
  exit 0
fi
port_of() {
  local p
  p=$(sed -n 's/^PORT=\([0-9]\{1,5\}\).*/\1/p' "${DATA[$1]}/.env" | tail -n 1)
  echo "${p:-${PORT[$1]}}"
}
health() { curl -fs --max-time 5 "http://127.0.0.1:$(port_of "$1")${HEALTH[$1]}" 2>/dev/null | grep -q '"ok":true'; }

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

# A service set up since the running release was deployed starts on this one even if the code didn't change.
fresh=0
for svc in "${enabled[@]}"; do systemctl is-active --quiet "${UNIT[$svc]}" || fresh=1; done
if [[ -n $old_sha && -z ${FORCE:-} && $fresh -eq 0 ]] && git -C "$REPO" diff --quiet "$old_sha" "$sha" -- "${CODE[@]}"; then
  echo "== what they run is unchanged since ${old_sha:0:12}; nothing to deploy"
  prune
  exit 0
fi
if [[ -n $old_sha ]]; then
  git -C "$REPO" --no-pager diff --stat "$old_sha" "$sha" -- "${CODE[@]}" || true
fi

for svc in "${enabled[@]}"; do
  log=$LIVE/logs/test-$short-$svc.log
  echo "== testing $svc at $short"
  if ! (cd "$release/${SRC[$svc]}" && PATH=$NODE_BIN:$PATH npm test >"$log" 2>&1); then
    tail -n 40 "$log" >&2
    echo "!! $svc's tests failed; everything stays on ${old_sha:0:12} (full log: $log)" >&2
    record "tests-failed"
    exit 1
  fi
  grep -E '^(# |ℹ )(tests|pass|fail)' "$log" || true
done

backups=$(mktemp -d)
for svc in "${enabled[@]}"; do
  unit=${UNIT[$svc]} unit_file=/etc/systemd/system/${UNIT[$svc]}.service
  cp "$unit_file" "$backups/$unit.service" 2>/dev/null || true
  if ! cmp -s "$release/${SRC[$svc]}/$unit.service" "$unit_file"; then
    first_install=$([[ -f $unit_file ]] && echo 0 || echo 1)
    echo "== installing changed $unit.service"
    cp "$release/${SRC[$svc]}/$unit.service" "$unit_file"
    systemctl daemon-reload
    # It starts at boot like Poe's services. Only the first time: after that, whether it's
    # enabled is the operator's call.
    if [[ $first_install -eq 1 ]]; then systemctl enable --quiet "$unit"; fi
  fi
done

link "releases/$short" current
for svc in "${enabled[@]}"; do
  echo "== restarting ${UNIT[$svc]}"
  systemctl restart "${UNIT[$svc]}"
done

unhealthy=()
for svc in "${enabled[@]}"; do
  healthy=0
  for ((i = 0; i < HEALTH_WAIT_S; i += 3)); do
    sleep 3
    if systemctl is-active --quiet "${UNIT[$svc]}" && health "$svc"; then
      healthy=1
      break
    fi
  done
  if [[ $healthy -eq 1 ]]; then echo "== ${UNIT[$svc]} is healthy on $short"; else unhealthy+=("$svc"); fi
done

if [[ ${#unhealthy[@]} -eq 0 ]]; then
  record "ok"
  rm -rf "$backups"
  prune
  exit 0
fi

for svc in "${unhealthy[@]}"; do
  echo "!! ${UNIT[$svc]} is not healthy on $short after ${HEALTH_WAIT_S}s" >&2
  journalctl -u "${UNIT[$svc]}" --no-pager -o cat -n 30 >&2 || true
done
# The index alone unhealthy, with no release of it to go back to (its first deploy): rolling back
# would take the announcer back to code from before the review queue, which posts without anyone's
# yes. So the index is stopped instead, and the announcer stays where it is. (Without a fresh
# index, the announcer reads every repo, as it used to.)
if [[ ${unhealthy[*]} == index && -n $previous && ! -d $LIVE/$previous/${SRC[index]} ]]; then
  echo "!! stopping ${UNIT[index]}; the announcer stays on $short" >&2
  systemctl stop "${UNIT[index]}"
  record "index-unhealthy-stopped"
  rm -rf "$backups"
  exit 1
fi
if [[ -n $previous ]]; then
  echo "!! rolling back to ${old_sha:0:12}" >&2
  for svc in "${enabled[@]}"; do
    unit=${UNIT[$svc]} unit_file=/etc/systemd/system/${UNIT[$svc]}.service
    if [[ -s $backups/$unit.service ]] && ! cmp -s "$backups/$unit.service" "$unit_file"; then
      cp "$backups/$unit.service" "$unit_file"
      systemctl daemon-reload
    fi
  done
  link "$previous" current
  for svc in "${enabled[@]}"; do
    # A service that had no release before this one is stopped rather than pointed at code that predates it.
    if [[ -d $LIVE/$previous/${SRC[$svc]} ]]; then systemctl restart "${UNIT[$svc]}"; else systemctl stop "${UNIT[$svc]}"; fi
  done
  record "unhealthy-rolled-back"
else
  record "unhealthy"
fi
rm -rf "$backups"
exit 1
