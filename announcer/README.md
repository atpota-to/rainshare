# The announcer

@rainshare.dev's daily post about new asks and the direct messages people ask for, as a service
that stays up. It runs on the droplet beside Poe's services (atpota-to/atpota.to), in folders and a
unit of its own, and deploys itself when `main` changes: see [`../droplet/`](../droplet).

## What it does

It listens to [Jetstream](https://github.com/bluesky-social/jetstream) for Rainshare's own
records: asks, takes, turn-ins and people's settings (`dev.rainshare.seed`, `.take`,
`.delivery`, `.preferences`). Whenever one is written, a run follows within a minute or two
(`src/run.js`):

- **Posts** (`src/posts.js`): once a day, after 15:45 UTC, one post saying how many new asks
  are on the board, tagging up to three of the people who asked (the first that day), and asking
  readers to help, with a card for the board:

  > 5 new asks on the board, from @alice.example, @bob.example, @kai.example and 1 other.<br>
  > Have spare usage left on your AI coding plan before it resets? Help someone out by directing
  > your agent to one of them.

  With one ask, the last words are "to the task". It counts
  the asks asked since 15:45 the day before that nobody's on yet: not one someone has said
  they're on, has turned work in for, or that's done or closed, as the board's "Nobody on it
  yet" has it. No titles go out, so nobody reads the asks first. Hiding an ask, or its asker,
  takes down a post that tagged them, and the next run makes that day's again without them. A
  day with no new asks gets no post.
- **Messages** (`src/messages.js`): for each person who asked for them in their settings, their
  updates since their last message (someone's on their ask, work's been turned in, an ask they
  helped with was marked done or closed), and once a day, after 15:45 UTC, how many of the day's
  new asks nobody's on yet, with a link to the board written out ("There are 5 new asks on the
  board: rainshare.dev/board."). It's only a number: no titles, and nobody's name.

It also runs when someone writes to the account (it looks at its
conversations every minute, as Poe does, so a STOP is answered quickly), and every 15 minutes in
case Jetstream missed something.

It keeps nothing itself. Every run reads what it needs: the board from the index while the
index's heartbeat is fresh, and from every repo otherwise; whether the day's post is up from
the account's own posts (it takes a record key made from the day's 15:45 UTC); and what each
person has heard, and whether they've said STOP, from its conversations. So a restart, a move to
another machine or a missed event loses nothing: the next run picks up where things stand.

It keeps one Bluesky session for as long as it's up, and renews it rather than signing in again.
An account can sign in only 300 times a day, and past that nobody can sign in to it until the day
is out. A sign-in that fails (a wrong password, say) isn't tried again for half an hour.

Nothing @rainshare.dev has hidden on the moderation page is counted or anyone's news, and nor is
an ask Rainshare's checks find very likely a trick on helpers' agents, or an ask from anyone the
account blocks, or who blocks it.

Before 20 November 2026 the account posted each new ask on its own, naming who asked, once a
person had said yes to it by direct message. That review is gone with those posts. A post of
those about an ask that's hidden later is still taken down.

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

The Privacy Policy says we'll delete a post about someone's ask when they ask. Only the posts
from before 20 November 2026 named an ask: delete it in Bluesky, signed in as @rainshare.dev.
Nothing posts it again. A post about an ask that's hidden is taken down by the next run, as long
as it's among the account's last 300 posts.

## Tests

`npm test` here runs its tests (`../test/announce.test.mjs`, `messages.test.mjs`,
`announcer.test.mjs`). They need no network and no packages, only Node 22. The droplet runs them
on every deploy before switching.
