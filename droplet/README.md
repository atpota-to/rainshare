# The droplet

The announcer ([`announcer/`](../announcer): @rainshare.dev's posts and messages) runs on the
DigitalOcean droplet that runs Poe's services from
[atpota-to/atpota.to](https://github.com/atpota-to/atpota.to) (`hook.atpota.to`). It's deployed
the way they are, and kept apart from them: its own folders, unit, deploy key and lock. Nothing
here touches theirs.

| What | Where |
|---|---|
| Code, from git | `/root/rainshare-live/`: `repo.git` (a bare clone of atpota-to/rainshare), `releases/<sha>/`, `current` → the running release, `deploy.sh` and `ci-deploy.sh` → the tip of main's, `logs/deploys.log` |
| Data, never in git | `/root/rainshare-announcer/`: `.env`, `KILL` |
| The unit | `rainshare-announcer` (`/etc/systemd/system/rainshare-announcer.service`, from `announcer/`) |
| Health | `http://127.0.0.1:8792/health`, localhost only. Poe's services use 8787, 8790 and 8791. No nginx route. |

## Deploying

**Merge to `main`. That's it.** `.github/workflows/deploy-droplet.yml` runs on every push to
`main` that touches what the announcer runs, and asks the droplet to deploy that commit. The
droplet ([`deploy.sh`](deploy.sh)):

1. Fetches the commit from GitHub and unpacks what the announcer needs into `releases/<sha>/`.
2. Skips it if the announcer isn't set up yet (no `.env` in its data folder). The run stays
   green.
3. Skips it if what the announcer runs hasn't changed (docs don't count).
4. Runs its tests there. If they fail, nothing changes and the run goes red.
5. Installs the unit file if it changed, switches `current`, and restarts the unit.
6. Checks `/health` for up to 60 seconds. If it's unhealthy, it switches back to the previous
   release by itself, and the run goes red.

**Rolling back or redeploying:** Actions → Deploy droplet → Run workflow, with an older commit on
`main`. Or, on the droplet:

```bash
/root/rainshare-live/deploy.sh <sha>            # any commit or branch on GitHub
FORCE=1 /root/rainshare-live/deploy.sh          # restart even if nothing changed
cat /root/rainshare-live/logs/deploys.log       # every deploy, one line each
```

**The deploy ships code only.** A new setting has to be in `/root/rainshare-announcer/.env`
(and in `announcer/.env.example` here) before the change that needs it merges.

## Setting it up, once

On the droplet, as root. Node 22 is already at `/opt/node22` (Poe's services use it).

```bash
# 1. The code: a bare clone, and the deploy scripts from the tip of main.
mkdir -p /root/rainshare-live
git clone --bare https://github.com/atpota-to/rainshare.git /root/rainshare-live/repo.git
tmp=$(mktemp -d) && git -C /root/rainshare-live/repo.git archive main droplet | tar -x -C "$tmp"
"$tmp/droplet/deploy.sh"        # links deploy.sh and ci-deploy.sh, then says it isn't set up yet

# 2. The data folder and its settings. Fill in the app password (made with "Allow access to your
#    direct messages" ticked) and leave MODE=dry for now.
mkdir -p /root/rainshare-announcer && chmod 700 /root/rainshare-announcer
git -C /root/rainshare-live/repo.git show main:announcer/.env.example > /root/rainshare-announcer/.env
chmod 600 /root/rainshare-announcer/.env && $EDITOR /root/rainshare-announcer/.env

# 3. The first deploy: tests, the unit (enabled, so it starts at boot), and a health check.
/root/rainshare-live/deploy.sh
journalctl -u rainshare-announcer -f      # watch a few dry runs say what they'd post and send
```

When the dry runs look right, set `MODE=live` in the `.env` and
`systemctl restart rainshare-announcer`.

### The deploy key

GitHub Actions reaches the droplet with a key that can only run [`ci-deploy.sh`](ci-deploy.sh),
which only accepts `announcer [<full sha on main>]`. It's a key of its own, not Poe's.

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-deploy atpota-to/rainshare" -f rainshare-deploy
```

Add the public half to `/root/.ssh/authorized_keys` on the droplet, pinned to the script:

```
restrict,command="/root/rainshare-live/ci-deploy.sh" ssh-ed25519 AAAA… github-actions-deploy atpota-to/rainshare
```

and the private half (all of `rainshare-deploy`) to this repo as the Actions secret
`DROPLET_DEPLOY_KEY` (Settings → Secrets and variables → Actions). Until the secret is there,
the workflow says so and deploys nothing. The workflow pins the droplet's host key, the same one
atpota-to/atpota.to pins.

## Going quiet

```bash
touch /root/rainshare-announcer/KILL      # every run says what it would do, and does nothing; no restart
rm /root/rainshare-announcer/KILL         # carry on
systemctl stop rainshare-announcer        # stop it altogether (a deploy starts it again)
systemctl disable --now rainshare-announcer   # and keep it stopped
```

Revoking the app password on Bluesky stops it too, at once.

## What never goes in git

The `.env` (the app password) and `KILL`. They live in `/root/rainshare-announcer`, outside the
code, and the repo's `.gitignore` covers a stray `.env` too.
