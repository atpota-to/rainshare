# The announcer

@rainshare.dev's posts about new asks, and the direct messages people ask for, as a service that
stays up. It runs on the droplet beside Poe's services (atpota-to/atpota.to), in folders and a
unit of its own, and deploys itself when `main` changes: see [`../droplet/`](../droplet).

## What it does

It listens to [Jetstream](https://github.com/bluesky-social/jetstream) for Rainshare's own
records: asks, takes, turn-ins and people's settings (`dev.rainshare.seed`, `.take`,
`.delivery`, `.preferences`). Whenever one is written, a run follows within a minute or two
(`src/run.js`):

- **Posts** (`src/posts.js`): each new ask that nobody's on yet, once it has settled for 15
  minutes (in case its title is fixed straight after). Not one that someone has said they're on,
  has turned work in for, or that's done or closed, as the board's "Nobody on it yet" has it.
- **Messages** (`src/messages.js`): for each person who asked for them in their settings, their
  updates since their last message (someone's on their ask, work's been turned in, an ask they
  helped with was marked done or closed), and once a day, after 15:45 UTC, the day's new asks
  that nobody's on.

It also runs when an ask finishes settling, when someone writes to the account (it looks at its
conversations every minute, as Poe does, so a STOP is answered quickly), and every 15 minutes in
case Jetstream missed something.

There's no database. Every run reads what it needs from the network: the account's own posts say
what's been posted, and its conversations say what each person has heard and whether they've
said STOP. So a restart, a move to another machine or a missed event loses nothing: the next run
picks up where things stand.

It keeps one Bluesky session for as long as it's up, and renews it rather than signing in again.
An account can sign in only 300 times a day, and past that nobody can sign in to it until the day
is out. A sign-in that fails (a wrong password, say) isn't tried again for half an hour.

Nothing @rainshare.dev has hidden on the moderation page is posted or anyone's news, and nor is an
ask Rainshare's checks find very likely a trick on helpers' agents. Asks from anyone the account
blocks, or who blocks it, aren't posted.

## Running it

On the droplet it runs as the `rainshare-announcer` systemd unit, from
`/root/rainshare-live/current` (the code) in `/root/rainshare-announcer` (its `.env` and `KILL`).
[`.env.example`](.env.example) lists the settings.

```bash
journalctl -u rainshare-announcer -f                    # what it's doing
curl -s http://127.0.0.1:8792/health                    # how it's doing: Jetstream, the last run, what's due
```

It starts in **`MODE=dry`**: every run says in the journal what it would post and send, and
does neither. Read a few runs, then set `MODE=live` in the `.env` and
`systemctl restart rainshare-announcer`.

To go quiet at once, without a restart: `touch /root/rainshare-announcer/KILL`. Every run is
a dry one while it's there. `rm` it to carry on.

Anywhere else, to watch it work without posting anything:

```bash
npm run announcer                      # the service, in MODE=dry, from the repo root
npm run announce                       # one run, saying what it would do
npm run announce -- --post             # one run for real (needs RAINSHARE_BLUESKY_APP_PASSWORD)
```

Don't run it for real in two places at once: two runs can send someone the same message.

## Taking a post down

The Terms and the Privacy Policy both say we'll delete a post about someone's ask when they
ask. Block them from @rainshare.dev first, then delete the post in Bluesky, signed in as
@rainshare.dev. A run reads the account's blocks every time, so the ask isn't posted again.
Deleting the post alone doesn't last: nothing else remembers that an ask was posted, so the
next run posts it again, with a new mention, while the ask is under three days old, open and
nobody's on it. Once the ask is three days old, closed or taken, the block can come off. A
block is public, and while it's on their other asks aren't posted and they get no direct
messages.

Do the same when an ask is hidden or a copyright notice is acted on: the post doesn't go by
itself. Before `MODE=live`, a small "don't post" list in the announcer would make a deletion
last without the block.

## Tests

`npm test` here runs its tests (`../test/announce.test.mjs`, `messages.test.mjs`,
`announcer.test.mjs`). They need no network and no packages, only Node 22. The droplet runs them
on every deploy before switching.
