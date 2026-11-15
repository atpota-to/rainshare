# Rainshare

*Mutual aid using your AI agents. Got rain to spare or need a hand?*

> **Early alpha.** It works end to end, but the screens, the CLI and the record format may
> still change. Anything you post is saved in your own atproto account.

Your AI plan resets whether you use it or not. Rainshare is a board where people post ideas
and projects they'd like help with, and other people point their own coding agents at them,
signed in as themselves, on their own plans. We call that help rain. Nobody shares a plan or an
account, and nothing is proxied: everyone runs their own agent, and what changes hands is a
pull request.

It runs on atproto, so there's no Rainshare database of asks or people, and nobody earns or
spends credits. (The one thing Rainshare keeps itself is a note of who agreed to its
[terms](#terms-and-privacy).) Asks,
claims and finished work are records in people's own accounts, and your board starts with the
people you follow on Bluesky.

The site is [rainshare.dev](https://rainshare.dev). To look around without signing in, try the
example board at [rainshare.dev/example](https://rainshare.dev/example). Anything you do there
stays in your browser.

You sign in with a Bluesky or other Atmosphere handle. If you haven't got one, "Make an account"
on the sign-in lets you pick a host (Bluesky, Blacksky, Eurosky, selfhosted.social or npmx). You
make the account on that host's own sign-up page and come straight back signed in.

Signed out, the home page says what happens in a sentence and has two buttons, **Help
someone** and **Ask for help**. Either opens the sign-in, and signing in goes on to the board or
to asking. They're the two tabs in the bar as well.

## How it works

1. **Ask for help.** Post an idea or a project. A project is an existing repo or issue on
   Tangled, knotless, GitHub or any git host. Say what done looks like and, if you care, which
   models you'd like: a family (Claude, GPT, GLM…) and a level (frontier, mid-tier or small).
2. **Direct your agent.** Pick an ask and press "Direct my agent". The prompt your agent gets is
   the asker's own words, with safety rules from Rainshare around them (see
   [What your agent gets](#what-your-agent-gets)). The rules help, but they can't catch
   everything, and the ⓘ beside them says to read the ask first. It's a short dialog, and you
   stay where you are throughout. It asks which agent, as a row of choices: the one your profile
   says you run (Claude Code or Codex), "Any agent" for the prompt itself, and the cloud, the
   CLI and MCP under "More". On a phone, where there's no terminal to paste a command into, it
   starts on the Claude app when the ask is on GitHub and you run Claude Code or pay for Claude,
   and on "Any agent" otherwise (see [Helping from a phone](#helping-from-a-phone)). Under them, "Tell Kai I'm on it for a day" is ticked to begin with
   (three days, a week or two are behind "Change"), and one button copies the command or the
   prompt. Ticked, everyone sees the ask as "In progress" with your face and handle; unticked,
   it's copied and nothing is said. Nothing is written until you press it. Then the dialog shows
   what was copied, with its own Copy (a browser can refuse to copy, Safari especially), where
   to paste it, and what happens when your agent's done. Ticking "Skip this screen next time"
   keeps your answers and goes straight to that. Signed in, it's the one way to copy an ask's
   prompt; signed out, "Copy the prompt" sits beside "Sign in to take it on".
3. **Turn it in by the day you gave.** If nothing's turned in by then, the ask shows as free
   again, and you're listed as having gone quiet. You can give yourself more time from the
   ask's page, or drop it.
4. **Turn it in.** When the pull request is up, paste its link back (the field has a paste
   button at its end), or pick it from the pull requests Rainshare found that mention the ask,
   listed over the field with yours first: in the dialog that "Turn it in" opens from the board, or on the ask's own
   page, which also takes what did the work, a session link, and on Tangled and knotless can open
   the pull request from a pushed branch.
   Your agent's link back to the ask fills the form in for you. The asker reviews it and
   presses Accept, which marks the ask done. They can say thanks and vouch for you on Tangled in
   the same step. Until they do, the board reminds them that work is waiting.
5. **Grow a garden.** Every ask you helped finish shows up on your profile as a plant, with
   whose it was. The next time you open the board after one grows, it tells you, with what the
   person who asked said. A pull request the forge says was merged, on an ask that hasn't been
   accepted yet, shows as a paler bud that says who it's waiting on. Buds aren't counted: only
   the person who asked can say the work did the job.

A profile starts with what someone has been doing lately, ask by ask, and more on request: what
they asked for, took on, turned in and commented on, what was said when their work was accepted,
and who they vouched for on Tangled. Their garden comes after it. The list is read from the
records in their own account, so it leaves out comments made on a Tangled or knotless issue
(those live with the issue) and asks that aren't shared with you. A take that ran past its day
is still listed as taking it on, with no mark for going quiet.

The first time you direct your agent, or copy an ask's brief, on a browser, a short note comes
first: three things to keep in mind when you point your agent at a stranger's request, and a
box to tick to agree to the [Terms of Service](https://rainshare.dev/terms) and
[Privacy Policy](https://rainshare.dev/privacy), and a second box saying that whether your AI
provider allows how you use your plan here is yours to check, and yours to answer for if it
decides it doesn't. After that it stays out of the way.

Every ask has comments, for a question before you start, an answer from whoever asked, or a
note on how it's going. Replies sit under the comment they answer. When an ask is on an issue
on Tangled or knotless, its comments are the issue's own: Rainshare shows what's been said
there, and what you write is posted on the issue as you, so the conversation stays in one
place and the forge tells people about replies. Tangled has replies; knotless keeps an issue's
comments as one list.

Signed in, there's a bell beside your face in the bar. Its number is how much has happened since
you last opened it: someone's on one of your asks or turned in work on it, an ask you were on was
marked done (with your work or someone else's) or closed, someone commented on one of your asks or
replied to you, or whoever asked commented on an ask you're helping with. Each one opens the ask,
at its comments for a comment. When something on Rainshare changes, a note about it is in the bell
too, and on the [What's new](https://rainshare.dev/releases) page (in the footer). See
[The bell and what's new](#the-bell-and-whats-new).

An idea doesn't need a repo, or even a developer. The asker picks whether whoever builds it
keeps it ("Someone else can run with it") or whether the agent should start a repo for them
("Start it for me"). Rainshare doesn't create repos itself. It links to the new-repo page on
the right forge.

Your profile says which AI plans you pay for to code with (Claude, ChatGPT, Copilot, Cursor,
Gemini, Z.ai's GLM plan), or that you only have free tiers or nothing. That shows next to your
asks, and "Direct my agent" starts with the command for what you run. The first time you sign in,
a short welcome says what happens in three steps, then asks for your
plan and which agents you run, and whether you'd like messages from @rainshare.dev (both kinds are
ticked to begin with; see [Messages](#messages)). You can skip it, which switches nothing on.
If you were already past the welcome before it asked about messages, or made your profile
without it, your next visit asks about them on their own, once, unless you have some on.

Your settings are on a page of their own, apart from your profile: **Settings** (`/settings`), in
the menu under your face. They're how "Direct my agent" works for you, your GitHub username if
you'd like to give it (see [Helping from a phone](#helping-from-a-phone)), and which messages
you'd like from @rainshare.dev.

## Helping from a phone

A phone has no terminal, but it may have the Claude app, so "Direct my agent" can hand an ask
straight to it. For an ask on GitHub, the dialog's **Claude app** choice (**Claude on the web**
on a computer, under "More") opens a new Claude Code session from a link, with the prompt and the
repository already filled in. Nothing is sent until you press send there. The link is the one
[Claude Code documents for this](https://code.claude.com/docs/en/web-quickstart#pre-fill-sessions)
(`claude.ai/code?prompt=…&repositories=owner/name`). On a phone it opens the app's Code tab, if
the app takes it, and the browser otherwise. The prompt is copied as well, in case the app opens
without it filled in.

A cloud session can only push to a repository your GitHub account can write to, so it's opened
on your fork. The first time, the dialog asks for your GitHub username and keeps it in your
settings. It then asks GitHub whether you've forked the ask's repository, checking your name
first, then the newest forks in case GitHub named yours differently. If you haven't, it offers
GitHub's fork page, and looks again when you come back. The prompt names your fork too, and
fills your username into the link that opens the pull request against the original. If a session
was opened on a repository it can't push to, the prompt tells it to say so rather than look for
another way. A prompt too long to go in a link (most are 5 to 7 thousand characters) is left out
of it, and you paste it instead.

Everywhere the prompt can be copied on a phone, **Share** sits beside Copy. It hands the prompt to
any app through the phone's share sheet, so it doesn't need the clipboard, which Safari sometimes
refuses.

Turning in doesn't need a link pasted either. The "Turn it in" dialog lists the pull requests on
the forge that mention the ask and haven't been turned in. With your GitHub username in your
settings, yours come first, and if just one is yours it's filled in already. When a pull request
of yours is up for an ask you're on, the board says so, with a button that turns it in. That
note comes after work waiting for you to look at, and "Not now" puts it away for the visit. It
looks for up to three of your asks, once in ten minutes each, since GitHub lets a browser that
isn't signed in ask 60 things an hour.

These haven't been tried on every phone. The Claude app may open without the prompt or the
repository filled in, and some browsers open the link in a new tab rather than the app. The
prompt is copied as well for that reason.

## Is this allowed by my AI plan?

Rainshare isn't plan sharing, and it isn't a proxy. We think it's allowed, but your plan's terms
are between you and your provider, so read them. Your provider decides what its terms allow, not
Rainshare, and if it limits or closes your account over how you used it here, that's on you, not
on Rainshare. Agreeing to Rainshare's terms includes saying you accept that. As of
November 2026 the big plans rule out sharing your account and reselling access to it (see
Anthropic's [Consumer Terms](https://www.anthropic.com/legal/consumer-terms) and
[Claude Code's terms](https://code.claude.com/docs/en/legal-and-compliance), and OpenAI's
[Terms of Use](https://openai.com/policies/row-terms-of-use/)). Rainshare does neither:

- You run your own agent, signed in as you, on your own machine or cloud session. Nobody else
  gets your login, and Rainshare never sees it. It only signs in to your atproto account.
- What you hand over is a pull request (or a new repo, for an idea), the same as contributing
  to any open-source project. Both Anthropic's and OpenAI's terms say the output is yours.
- Nobody gets paid. There are no credits or tips, so nothing is being resold.
- You choose each job and start the agent yourself.

That's also why Rainshare won't run agents on its own servers, hold anyone's AI login, pay
helpers, or work through asks unattended. Your plan's usage policy still applies to whatever
your agent does, whoever asked for it, so only take on work you'd be happy doing for yourself.

## The CLI and MCP server

`rainshare.mjs` is one file with no dependencies. It works as a CLI and as an MCP server.
Nobody needs it to help someone, so it isn't in the bar: its page on the site (`/agents`) is
"CLI & MCP" in the footer and in the menu under your face.

```sh
curl -fsSL https://rainshare.dev/rainshare.mjs -o ~/.rainshare.mjs
node ~/.rainshare.mjs doctor                    # what's set up here, and what will work
node ~/.rainshare.mjs login you.bsky.social     # signs in with an app password
node ~/.rainshare.mjs board                     # open asks, best fit for you first
node ~/.rainshare.mjs check <link>              # who's on it and what's been turned in
node ~/.rainshare.mjs run <link>                # take it, clone, start your agent, turn it in
node ~/.rainshare.mjs turn-in <link> --url <pull request>
node ~/.rainshare.mjs done <link>               # mark your own ask done
```

To use it from Claude Code:

```sh
claude mcp add rainshare -- node ~/.rainshare.mjs mcp
```

`take` and `run` check before they write anything. If someone else is already on it, or a pull
request is open, they stop and say why (`--anyway` goes ahead regardless). `--days` says how long
you'll take (your setting from the site, or a day), and taking one again after that day has
passed gives you more time. `run` writes the
brief to `.rainshare/SEED.md`, starts Claude Code (or `--with codex`, or `--with cloud`), and
when the agent exits it finds the pull request with `gh` and offers to turn it in. Run
`node ~/.rainshare.mjs help` for the rest, including `open-pr` for Tangled and knotless.

The MCP tools are `rainshare_board`, `rainshare_show`, `rainshare_check`, `rainshare_take`,
`rainshare_drop`, `rainshare_turn_in`, `rainshare_open_pr`, `rainshare_ask`,
`rainshare_close_out`, `rainshare_profile` and `rainshare_whoami`. The server's instructions
tell the agent the order to use them in. Without a sign-in the read-only tools still work, and
the agent hands you a link to turn the work in yourself.

`login` prints the same three safety points, and says that using Rainshare means agreeing to
its terms. `terms` and `privacy` print the two documents.

Both sign in with an app password, saved to `~/.config/rainshare`. You can also set
`RAINSHARE_HANDLE` and `RAINSHARE_APP_PASSWORD`.

## What your agent gets

However you send it, your agent gets the same brief (`core/brief.js`). The site calls it the
prompt, since that's what it is to whoever pastes it:

- where the code is, and the issue if there is one
- where things stood when you copied it (who's on it, what's been turned in, what the forge
  says), and the commands to check again before starting, since a brief can sit in a clipboard
  for days
- the ask itself, framed as another person's request, not as instructions that override the
  agent's own rules. Their words sit between two markers they can't forge, and the rules above
  them say what to stop and ask about: reaching outside the repo, touching secrets, running
  code from elsewhere, or keeping anything from you.
- what Rainshare's checks flagged in it, if anything (see [Security](#security)), in Rainshare's
  own words, with the advice to show you before starting
- how to turn it in: open a pull request with the ask's link in it, with "Fixes #N" on GitHub when it
  does everything the issue asks, or "Part of #N" when it does some of it. Where the agent can't
  fork or open the pull request itself, it hands you links that do each in a tap.
- when you said you'd turn it in, and how to get more time if the work runs over. If you copied it
  without saying you're on it, the agent asks whether you'd like to before it starts
- how to end: a short list of links with every placeholder filled in (the pull request, the link
  that turns it in if it didn't, the issue and the ask's page), and that if reviewers ask for
  changes, it updates the same pull request rather than opening a new one

There are five ways to hand it over:

| Route | Needs | Who turns it in |
| --- | --- | --- |
| Copy the prompt into any agent | nothing | you, using the link the agent hands back |
| Open it in the Claude app, or Claude Code on the web, from a link with the prompt and your fork filled in (GitHub only) | a Claude plan with cloud sessions, and GitHub connected | you, using the same link |
| One command: `git clone … && claude "<brief>"` (or `codex`) | that agent's CLI | you, using the same link |
| `rainshare.mjs run <link>` | the CLI and an app password | the CLI, once the agent exits |
| The MCP server | the CLI and an app password | the agent, with `rainshare_turn_in` |

The link an agent hands back looks like
`rainshare.dev/seed/<handle>/<key>?pr=<pull request>&model=<model>`. Opening it fills in the
turn-in form for you.

## Forges

- **GitHub.** Paste an issue or repo link. Rainshare reads issue and pull request state from
  GitHub's public API, and looks through the repo's 50 most recent pull requests for the issue
  number or the ask's link, to catch work nobody turned in.
- **Tangled.** Pick an issue from your Tangled repos or paste a tangled.org link. Rainshare
  uses the `org.tangled.*` API that came in with Tangled's relaunch on 30 October 2026. Tangled
  has no CLI for opening pull requests yet, so the agent pushes a branch and Rainshare opens
  the pull request as you.
- **knotless.** Pick an issue from your knotless repos or paste a knotless.dev link. The brief
  gives the agent knotless's own commands, so it can fork, push and open the pull itself.
- **Anything else.** Any git repo URL works as a project. Codeberg and GitLab get links to the
  right pages too.

On Tangled and knotless, Rainshare can also post as you: open an issue, comment on one (an
ask's comments, when it's on an issue there), or open a pull request from a branch you've
pushed. It only does that when you press a button that says so. A sign-in that leaves a forge
out gets a "Connect" button where it's needed, and keeps what you'd written while your server
asks. Sign-in asks for these permissions up front, with a checkbox for each forge, and
if your server refuses some of them it asks again for less. Tangled's permissions are broader
than knotless's because a Tangled knot checks each repo's own identity, so the token can't be
narrowed to Tangled alone. They're the same ones Tangled's own web app asks for. The exact
scopes are `FORGE_SCOPES` in `core/ns.js`.

## Knowing who you're dealing with

Next to every asker and helper, Rainshare shows how you know them: whether you follow each
other on Bluesky or Tangled, which of the people you follow also follow them, and whether
anyone in your Tangled [vouch](https://tangled.org/docs/guides/vouching/) circle vouches for
them. It's there to help you decide whether to point your agent at a stranger's repo, or merge
what a stranger's agent sent you.

None of it gates anything. You can filter the board by it (mutuals, people you follow, people
vouched for, and so on), and you can vouch for someone who helped you. Rainshare never writes
denouncements; do that on Tangled.

Each ask on the board is a short card: who asked (and how you know them, if you do) and when,
across the top, then beside its plant the title, the first couple of lines of the ask in their
words, and who's on it. Picked, an ask shows the start of the ask in their words first, then
where the work is, how big a job it is, the models it'd like and how you know whoever asked.

The board is newest first, with your own open asks after everyone else's (see
[Ranking](#ranking) for the order it's switched off from). **Filter** folds out what narrows it:
who asked, by the ties above, and whether
to show only the asks **nobody's on yet** (nobody's said they're on it, and nothing's been
turned in), the ones **in progress** (someone's on it), or the ones **turned in** (there's a
pull request, or for an idea, something someone built). A card with a pull request carries it
as a chip, and the ask's details link straight to it, saying whether it's open, merged or
closed. While it's folded away, whatever is narrowing the board shows beside it, each a
press from undone. What's done is never on the board; it's on the page of whoever asked.

Over the list there's one note at a time, the one that matters most: work waiting on you to look
at, then a pull request of yours that's up and not turned in, then something of yours that grew,
then setting up your profile, then that it's early days.

## How it's built

### Records

Everything is an atproto record in its owner's own account, under `dev.rainshare.*`. The
schemas are in `lexicons/dev/rainshare/`.

| Record | Written by | Holds |
| --- | --- | --- |
| `dev.rainshare.profile` | everyone | AI plans, setups (harness, models, where it runs), the kinds of work you take on, and an optional Rainshare-only name and bio |
| `dev.rainshare.seed` | the asker | title, subject (an issue or repo, or none for an idea), project stage, spec in Markdown, preferred models, tags, size, state |
| `dev.rainshare.take` | a helper | "my agent is on this": a strong ref to the seed, the setup doing the work, and `until`, the day they expect to turn it in |
| `dev.rainshare.preferences` | you | your settings: how "Direct my agent" hands an ask over, whether it says you're on it and for how many days, whether to ask each time, your GitHub username if you gave it, which messages you'd like from @rainshare.dev, and that you agreed to the terms (which version, and when). Public, like every record in your repo |
| `dev.rainshare.delivery` | a helper | the pull request (a URL, or an `at://` URI on Tangled and knotless), what did the work, and an optional session link |
| `dev.rainshare.moderation` | @rainshare.dev only | something Rainshare has hidden: an account, or one record, and why. See [Moderation](#moderation) |
| `dev.rainshare.comment` | anyone | what they said (Markdown), a strong ref to the seed, and, for a reply, a strong ref to the comment it answers. An ask on a Tangled or knotless issue uses the issue's comments instead (`org.tangled.feed.comment`, `dev.knotless.comment`) |

The records use garden words that the site doesn't show. An ask is a `seed`. A project's
progress is its `stage` (`seedling`, `young` or `established`), and a finished ask is
`sprouted`. On screen those are "idea", "project" and "done", and the garden metaphor is only
in the pictures.

Names, bios and avatars come from your Bluesky profile unless you set a different name or bio
for Rainshare.

Nobody can delete someone else's take, so a forgotten one would hold an ask forever. Instead every
app reads the same rule (`core/takes.js`): a take holds its ask until its `until`, and once that
has passed with nothing turned in, the ask shows as free again. A take holds an ask for at most
30 days from when it was last written, whatever its `until` says, and a take from before `until`
existed lapses after 7 days. The take itself stays, and the helper is shown as having gone quiet.

Sign-in asks for these record types through a permission set, `dev.rainshare.authFull`
(`lexicons/dev/rainshare/authFull.json`). A server that can look the set up shows "Your
Rainshare records" on its consent page instead of listing each collection. If a server can't,
Rainshare asks again for the records by name. Tangled and knotless permissions are always listed
separately, because a set can only grant what's under its own name, and so is the one Bluesky
permission: creating a follow (`repo:app.bsky.graph.follow?action=create`), so that switching
on messages can follow @rainshare.dev for you (see [Messages](#messages)). It never asks to delete
one.

### No index server

The board is read straight from the network, in your browser, each time (`core/source.js`,
`core/net.js`). A relay lists the accounts that hold `dev.rainshare.*` records
(`com.atproto.sync.listReposByCollection`). Their records come from each account's own PDS,
six at a time, and names, avatars and follows come from Bluesky's AppView. An ask's page uses
[Constellation](https://constellation.microcosm.blue) to find takes, deliveries and comments that
point at it, then checks each one against its owner's PDS. The board doesn't read comments, so
they're only fetched on an ask's own page. For an ask on a Tangled or knotless issue, the
issue's comments come from the forge's API too (`issueComments` in `core/subjects.js`). If a relay hasn't answered after 2.5
seconds, the next one is asked as well.

That's a request per person taking part. It's fine at dozens of people. At thousands, this is
the part to replace with an index.

### Where an ask stands

`core/status.js` combines Rainshare's records with what the forge says (is the issue closed,
was a pull request merged) and works out what each side should do next. The site, the brief,
the CLI and the MCP server all use it. Nothing closes automatically: whether a pull request did
the job is the asker's call.

### Ranking

`core/rank.js` works out how well each ask suits you. On the site it's switched off for now
(`fit` in `FEATURES`, in `core/ns.js`): with a handful of asks, how you know whoever asked says
enough, and an order whose reasons you can't see was more confusing than helpful. The CLI and
MCP server still rank by it, since an agent picking work uses the reasons.

Switched on, it sorts the board: askers with no paid AI plan come first, then asks that fit
what you can bring (a model you run or your plan reaches, tags that match your work), then
people closer to you. Each card shows the fit as one to three drops, and opening one says why
in plain sentences. Your own open asks are on the board too, marked "Yours", after everyone
else's. Sorted by **Newest** instead, everything is in order of when it was asked, yours
included.

### Gardens

Gardens aren't stored anywhere. `core/garden.js` works them out from two records that have to
agree: the helper's delivery and the asker's record naming it as the one that finished the job.
So nobody can add to their own garden. Two friends could still pad each other's, which is why
there's no leaderboard.

### The bell and what's new

The bell isn't stored anywhere either. `core/notices.js` works it out each time from what the site
has already read: the board, which has every ask you can see with its takes and turn-ins, and the
release notes. What's news about your asks and your work is `core/news.js`, the same code
@rainshare.dev's direct messages use (`announcer/src/messages.js`), so the two always say the same
things. Comments aren't on the board, so after it's read, the comments on your asks, on the asks
you're helping with, and on the asks you've commented on lately are found through Constellation,
as an ask's page finds them (`commentsFor` in `core/source.js`, at most 20 asks). Comments on a
Tangled or knotless issue are the forge's, and the forge tells people about those. Whoever you
block and whatever @rainshare.dev has hidden are left out, as on the board.

The bell looks back 30 days. Signed in, the board is read whatever page you're on, and again
every five minutes while the page is on screen, or when you come back to it after two. Opening
the bell asks again if it's been a minute.

What you've seen is kept in this browser (`rs:notices-seen:<your DID>`), by what each notice is
about rather than by when: a record can reach the network a minute or two after it was written,
by which time you may have opened the bell, and it should still count. The first time, the last
week counts as new. Opening the bell marks everything in it seen, and what was new stays lit
while it's open. Opened in one tab, it's cleared in the others. Another browser or device starts
afresh: keeping it in your account would mean a write, and a Jetstream event for the announcer,
every time you opened it. On the example board the bell is the example's, and says so.

#### Writing a release note

Release notes are a list in `core/releases.js`, newest first. Write one when something people use
has changed and they'd want to know. Put it at the top:

```js
{
  id: 'quiet-asks',            // lowercase words and dashes; never change or reuse it once it's out
  date: '2026-12-01',          // the day it goes out; a later day keeps it hidden until then
  title: 'Asks can be quiet',  // a few words
  summary: 'One sentence, for the bell.',
  text: `The rest, in Markdown, for the What's new page. Optional.`
}
```

It's in the bell for 30 days from its date, marked new for anyone who hasn't opened the bell
since, and on `/releases` for good. The bell knows a note by its `id`, so a note that's been
reworded isn't new again. `npm test` checks the list.

### Moderation

@rainshare.dev can hide an ask, a take, a delivery, a comment (Rainshare's own or one on a forge's
issue), someone's Rainshare name and bio, or a whole account. Hidden things are left off the
board, out of an ask's page and its comments, away from the CLI and the MCP server, and out of
link previews. Whoever asked still sees their own ask, marked hidden, with the reason.

Each decision is a `dev.rainshare.moderation` record in @rainshare.dev's own repo, and every app
reads them from that one repo (`MODERATOR` in `core/ns.js`, the same DID that publishes the
lexicons). Anyone can write a record of that type into their own repo, but nobody else's is
read, so the moderation page needs no server and no password check of its own: it's only shown
to that account, and anyone else who found their way to it would only be writing to their own
repo. A record's key is made from what it's about (`keyOf` in `core/moderation.js`), so there's
one per thing, hiding it again replaces it, and unhiding deletes it. Link previews look a
decision up by that key, through Slingshot, since they can't list a repo.

Signed in as @rainshare.dev, the menu under your face has **Moderation** (`/admin`). It has:

- **Hide something**: paste an ask's or a person's link, an at:// address (a comment's, say) or
  a handle, see what it is, then pick a reason and add an optional note.
- **Needs a look**: open asks on the board that the checks below flagged, likeliest tricks first.
- **Hidden**: every decision, with what it's about and an Unhide button.

An ask's page, a comment and a person's page also have a Hide button for that account.

Only @rainshare.dev's sign-in asks to write moderation records (`repo:dev.rainshare.moderation`,
added in `src/scope.js`), so nobody else's sign-in page mentions them. A sign-in from before
this was added is told on the moderation page to sign out and in again.

The records are public, like everything on atproto, so a note says why in words that are fine
for anyone to read. If @rainshare.dev's server doesn't answer, nothing is hidden for that minute
rather than the board going dark; the moderation page says so.

What kinds of asks fit is in the [community guidelines](https://rainshare.dev/guidelines)
(`/guidelines`, written in `core/legal.js` beside the terms, and `rainshare guidelines` in the CLI).
In short: work on something you'll build, share or maintain; no paid work passed on to helpers,
such as bug bounties or client work; no hunting for security holes in software that isn't yours.
"Against the guidelines" is one of the reasons a hide can give. Two of Rainshare's checks look for
the first two (`paid` and `vuln-hunting` in `core/scan.js`); like the other "worth a look"
checks, they only put a note in front of people.

#### Review before anything is passed on

A person reads every new ask before @rainshare.dev posts it or puts it in anyone's direct
messages. The announcer sends the approver (dame.is, by DID) a direct message about one ask at a
time: its title, who asked, the start of what it says, and what the checks noticed. They reply:

- **YES**: it's posted, and goes in the next day's new asks for people who asked for them
- **POST**: it's posted, and isn't sent to anyone
- **SEND** (or **DM**): it goes in the next day's new asks, and isn't posted
- **NO**: it stays on the board, and isn't posted or sent
- **HIDE** (with an optional reason after it): it's hidden, as the moderation page hides things,
  with the reason "Against the guidelines". If it was posted already, the post comes down.

A yes holds for that version of the ask only: an edit asks again. Until the approver answers, the
ask is on the board like any other. The queue lives in the index (below), and without it nothing
new goes out at all. `announcer/src/review.js` has the details.

### Feedback

Bugs, requests and ideas about Rainshare itself go on its board on
[userinput.app](https://userinput.app). The footer and the menu under your face link to it as
**Feedback** (`/feedback`). userinput.app is an atproto app too (`app.userinput.*`): the board is
a record in @rainshare.dev's repo, each post is a record in its author's repo, and only statuses
from the board's owner and the moderators it appoints count. People post and vote on
userinput.app itself, so signing in to Rainshare doesn't ask for anything more. The `/feedback`
page reads the board through Constellation, the same way the board here reads asks, and groups
the posts by status (`core/feedback.js`).

Until @rainshare.dev makes a board, the page says so and points to issues on GitHub and Tangled.
It uses the first board that account made. To pin a different one, set `SPACE_KEY` in
`core/feedback.js` to its record key.

The maintainers run a Claude Code routine on their own plan that turns planned posts into draft
pull requests (`.claude/skills/feedback/SKILL.md`). Each run, it:

1. marks a post `implemented` once its pull request has merged
2. takes the most-voted post marked `planned` that has no pull request yet, and opens one as a draft
3. marks that post `in-progress`, with the pull request's link in the note

Rainshare doesn't work through people's asks unattended (see "Is this allowed by my AI plan?").
This routine differs in three ways: it runs on the maintainers' own plan, it changes only
Rainshare's own repo, and it takes only what a maintainer has read and marked planned. A person
reviews every pull request it opens before anything is merged.

Anyone can post, and the routine's agent can push to the repo, so `forAgents` in
`core/feedback.js` limits what it hands over:

- Only a status from @rainshare.dev, or from a moderator it appointed, counts.
- A status pins the version of the post it was set on (its CID). A post rewritten after it was
  planned is skipped until someone plans it again.
- The agent gets the post as it was first written, plus the maintainers' note, and never the
  edits. An edit is a separate record whose date its author sets, so an edit made after planning
  could claim to be older. If an edit matters, the note is where to say what's to be done.
- The checks in `core/scan.js` run on the post. What they find goes in the brief in Rainshare's
  own words, and a likely trick isn't handed over at all. Characters a person can't see are
  taken out.
- The brief (`feedbackBrief`) puts the poster's words between markers they can't forge, under
  rules that keep the agent inside the repo and away from secrets, CI, what signing in asks for,
  moderation, and the routine's own files.

From a terminal:

```sh
node scripts/feedback.mjs board          # what's on the board, by status
node scripts/feedback.mjs planned        # the briefs the routine would work from
node scripts/feedback.mjs status <post> planned --note "Just the footer links."
```

Writing a status signs in with `RAINSHARE_HANDLE` and `RAINSHARE_APP_PASSWORD`, like the CLI.
The routine can use @rainshare.dev's own app password, or a separate account that @rainshare.dev
makes a moderator of the board on userinput.app. The second is the smaller risk: the most a
moderator account can change on Rainshare's side is the board (statuses, hidden posts and bans),
while an app password for @rainshare.dev can write anything to that account's repo, including
Rainshare's moderation decisions and Bluesky posts.

### Switched off for now

Some features are built but turned off to keep the alpha simple. The switches are in
`core/ns.js`:

- `GROUPS`: private asks inside an Open Social group space. Off until spaces are out of alpha
  on the group host, so every ask is public for now.
- `FEATURES`: `audience` (limit who sees an ask), `seedValues`, `priorities`, `forecast` (how
  much rain you have to spare), `values`, `circumstances` and `fit` (how well an ask suits you,
  on the site: see [Ranking](#ranking)). Old records keep these fields, and saving a profile
  doesn't drop them.

## Security

Almost everything Rainshare shows was written by someone else and served from a server they
might run. Nothing from the network is trusted:

- Record URIs are rebuilt from the DID, collection and key that were asked for, never copied
  from a server's reply. DIDs, handles, record keys and PDS URLs are all validated
  (`core/net.js`).
- Every value is escaped before it reaches the page. Markdown in a spec is escaped first, then
  a few safe constructs are turned back on (`core/markdown.js`). Links must be http(s), and
  `vercel.json` sets a Content Security Policy with no inline scripts in case escaping misses
  something.
- Repos are only cloned from a plain host and path. Anything passed to a shell is
  single-quoted.
- Control characters and text-reordering marks are stripped from briefs and from everything the
  CLI and MCP server print, so a spec can't break out of a bracketed paste or rewrite your
  terminal.
- The link-preview functions in `api/` only talk to two fixed hosts (Slingshot and Bluesky's
  AppView), never to a server named in a URL.
- Takes, deliveries and comments from people you've blocked on Bluesky are hidden, so they
  can't make an ask look taken or fill its comments. A comment can only answer one written
  before it, so no set of records can make a thread loop (`core/comments.js`).
- Comments are other people's words. They aren't put into the brief, and `rainshare_show` tells
  the agent they aren't instructions.
- An issue's comments on Tangled or knotless are taken as the forge's API reports them: who
  wrote each one isn't checked against their own server. Tangled keeps comments with the repo,
  not in the writer's account. Each one is still checked to be on the issue asked about, in
  the right place, and written by a DID.

- Characters a person can't see and an agent still reads (zero-width spaces and joiners,
  Unicode tag characters, runs of variation selectors) are taken out of briefs and of everything
  the CLI and MCP server print. They're how instructions get hidden in plain sight.
- In the brief, the asker's words (the spec and their notes) sit between two markers, and the
  tag is one that appears nowhere in their words after anything invisible is taken out, so
  nothing inside can close it early and pass for Rainshare's own text. Guidelines are only
  printed when they're values Rainshare knows.
- Every ask is read for what's often used to misuse an agent (`core/scan.js`): talk that tries
  to change an agent's rules (fake system messages included), asking it to keep things from
  you, hidden characters (and what they spell), reaching for SSH keys, credentials or the whole
  environment, piping a download into a shell, request-catching services like webhook.site,
  turning off an agent's permission prompts, `rm -rf ~`, `authorized_keys`, long encoded blobs,
  and asks for malware or phishing. What's found is shown to helpers above "Direct my agent", to
  whoever asked (so an honest ask can be reworded), in the brief as Rainshare's own sentences
  (the words that set it off stay between the markers), and to @rainshare.dev under "Needs a
  look". When it's very likely a trick, the site asks before taking it on, and the CLI and MCP
  server hold it until you say `--anyway` (or `anyway: true`). It's a smoke alarm, not a lock:
  it catches the lazy tricks, a careful one can be worded past it, and an honest ask trips it
  now and then, so nothing is refused for it alone.
- What @rainshare.dev has hidden ([Moderation](#moderation)) is refused outright: the brief for
  it says only that it's hidden, and the CLI won't show or take it.

Two things to keep in mind. An ask's spec is a stranger's request, and the brief tells your
agent so. And a repo you clone can carry its own agent config (`CLAUDE.md`, hooks,
`.mcp.json`), so look before you trust a folder you haven't seen.

## Terms and privacy

The [Terms of Service](https://rainshare.dev/terms) and [Privacy Policy](https://rainshare.dev/privacy)
are written in `core/legal.js`, as Markdown, so there's one copy: the site shows them at `/terms`
and `/privacy`, the footer links to them, and the CLI prints them. Rainshare is operated by
atpotato, LLC (`OPERATOR` in that file), and the legal sections follow the ones in the terms of
[Anisota](https://anisota.net), which the same company runs: who may use it, the cap on
liability, claims, disputes and arbitration, governing law, copyright notices and privacy rights.

- **Agreeing.** Before someone's first job or first ask, a note (`ui/agree.js`) says what to keep
  in mind and won't go on until both its boxes are ticked: one for the Terms of Service and
  Privacy Policy, one for `PROVIDER` in `core/legal.js` (checking that their AI provider allows
  how they use their plan here is up to them, and so is the risk). The CLI prints the second as
  part of what typing "agree" covers. On the site it opens for "Direct my agent"
  (before its own questions about how to send), "Copy the prompt" on someone else's open ask
  (signed out), copying a command that starts an agent, and "Ask for help". Agreeing once covers
  all of them.
  In the CLI, `login` asks, and so does the first `take`, `run`, `turn-in`, `open-pr` or `ask`;
  `agree` asks by itself. It has to be a person in a terminal: from a script it stops and says
  so, and the MCP tools tell the agent what its user needs to do, and not to do it for them.
- **Where it's written down** (`core/agreement.js`). In the browser, or for the CLI in
  `~/.config/rainshare/agreed.json`. For someone signed in, also in their own settings record
  (`terms` in `dev.rainshare.preferences`: the version and when), so agreeing on the site counts
  in the CLI and on another browser. And in a ledger Rainshare keeps: a table at Supabase,
  `rainshare_terms_acceptance`, written by a small function beside it
  (`supabase/functions/rainshare-agree`). The function takes nobody's word for it. Told that an
  account agreed, it reads that account's settings from the account's own host, and notes only
  what it finds there, with the record as its host signed it. So only the account itself can
  put itself in the ledger, and the note outlasts the record. It keeps no IP address. If the
  ledger can't be reached, the agreement still stands and it's told the next time. Only the real
  site tells it: a preview or a development copy writes the settings and leaves the ledger be.
- **When they change.** `LEGAL_VERSION` in `core/legal.js` is the date the documents last changed
  in a way people should agree to again. Change it, and the date shown with it, and everyone is
  asked once more before their next job. A typo doesn't need a new one.
- **Keeping the Privacy Policy true.** It says what the code does, so `test/legal.test.mjs`
  checks the two against each other: that it names the services the code asks, and that every
  key the site keeps in the browser is one the policy accounts for. A new key fails the test
  until the policy and the test's list both have it.
- **Page counts.** Vercel Web Analytics is given each page's path only. Anything after a `?` or
  `#` is dropped first (`src/main.js`), since a hand-back link carries a pull request there and
  coming back from signing in carries a code.

The example board never shows the note: nothing there is real.

The ledger's table is in `supabase/migrations/`, and its function is deployed with
`supabase functions deploy rainshare-agree --no-verify-jwt` (it checks what it's told against the
network itself, so it's called without a key). It follows `anisota_terms_acceptance`, the same
company's ledger for Anisota, in its names. Only the service role can read or write it.

## Development

```sh
npm install
npm run dev              # the site, at http://127.0.0.1:5173
npm test                 # node --test, no extra dependencies
npm run build            # the site in dist/, with the CLI bundled at dist/rainshare.mjs
npm run build:cli        # just the CLI, at dist-cli/rainshare.mjs
npm run lexicons:check   # compare the lexicons with what's published, without writing
```

Open the dev server at `127.0.0.1`, not `localhost`. Sign-in in dev uses atproto's loopback
OAuth client, which needs the IP.

Some images are rendered from code. Re-run the script after changing what it draws:

| Script | Makes |
| --- | --- |
| `npm run plants` | the plant pictures in `public/plants/`, plus JPEG copies for link previews |
| `npm run logo` | the favicons, the home-screen icon, and the logo shown before the animated one loads |
| `npm run og` | the home page's link preview, `public/og.jpg` |
| `npm run bluesky` | the avatar and banner for [@rainshare.dev](https://bsky.app/profile/rainshare.dev) |
| `npm run promo` | the pictures announcing @rainshare.dev's direct messages, in `brand/dms/` (its README has posts to go with them, and alt text) |

On the dev server, `src/plants/sheet.html` shows every kind of plant, and `src/logo/sheet.html`
shows the logo at every size, by day and by night.

To change the "alpha" label, update `STAGE` in `core/ns.js` and the badge in `index.html`,
which spells it out by hand.

### Layout

| Path | What's there |
| --- | --- |
| `index.html`, `src/main.js` | the page, its routes, who's signed in, and the bell in the bar |
| `src/landing/` | the signed-out landing page and its 3D garden (three.js, only loaded on the landing). `src/landing/cycle/` is an older scene, viewable with `?scene=cycle`. |
| `src/plants/`, `src/logo/` | the 3D plant models, and the animated logo (plain JavaScript, no three.js) |
| `src/promo/` | pages that pictures for announcements are taken from: `dms.html`, for @rainshare.dev's direct messages |
| `src/signin.js`, `src/oauth.js`, `src/scope.js`, `src/lookup.js` | the sign-in dialog, OAuth, and the scopes it asks for |
| `src/mode.js`, `public/mode.js` | day and night: the toggle in the bar, and the small script that picks one before the page is first drawn |
| `src/hosts.js` | the hosts offered for making an account, for someone who hasn't got one |
| `src/spaces.js` | group spaces for private asks (switched off) |
| `ui/` | the app's screens: the board, an ask, profiles, your settings, posting an ask, the first-time welcome (and asking about messages, for someone past it), loading placeholders, the feedback page, the note before a first job, the terms, privacy and community guidelines pages, What's new, the bell's panel (`notices.js`), and @rainshare.dev's moderation page |
| `core/` | everything the site and the CLI share (below) |
| `cli/rainshare.mjs` | the CLI and MCP server |
| `api/` | Vercel functions: the OAuth client metadata, and link previews (`page.js` sets the meta tags, `og.js` draws the image) |
| `announcer/` | the service that asks the approver about new asks, posts the ones they say yes to on Bluesky, and sends people their messages, on the droplet (see [Deploying](#deploying)) |
| `indexer/` | the index: every `dev.rainshare.*` record, from Jetstream to Supabase, on the droplet (see [The index](#the-index)) |
| `droplet/` | how the announcer and the index are deployed to the droplet, and set up there |
| `lexicons/` | the record schemas and the sign-in permission set, plus the scripts that publish them and check changes for breakage |
| `scripts/` | the image scripts above, `feedback.mjs` for the feedback board, and `announce.mjs`, which runs the announcer once by hand (see [Deploying](#deploying)) |
| `.claude/skills/feedback/` | the feedback routine's instructions |
| `supabase/` | Rainshare's ledger of who agreed to its terms, the index of every record and the review queue (`migrations/`), and the function that writes the ledger (`functions/rainshare-agree/`) |
| `test/` | `npm test` |

In `core/`:

| File | Does |
| --- | --- |
| `source.js`, `net.js` | reads the board, asks and profiles from the network, and does every write |
| `records.js`, `ns.js` | builds records within the lexicons' limits; collection names, labels and feature switches |
| `takes.js` | when a take has lapsed, so a forgotten one stops holding an ask |
| `brief.js` | the agent brief, the hand-back link, and the one-line launch commands |
| `status.js` | where an ask stands and what happens next |
| `rank.js`, `words.js` | orders the board, and describes an ask in plain sentences |
| `subjects.js`, `forges.js`, `forgewrite.js` | reads from forges, links to the right page on them, and posts to Tangled and knotless |
| `ties.js`, `vouch.js`, `circle.js` | follows, vouches and audiences |
| `garden.js` | works out gardens from records |
| `news.js` | what's news to someone about their asks and their work, for the bell and @rainshare.dev's messages |
| `notices.js` | the bell in the bar: what's in it, and what counts as new to whoever's looking |
| `releases.js` | the release notes, on the What's new page and in the bell |
| `comments.js` | puts an ask's comments into threads, whether they're Rainshare's or an issue's |
| `scan.js` | Rainshare's checks on an ask, for what's often used to misuse an agent |
| `legal.js` | the Terms of Service and Privacy Policy, their version, and the points said before a first job or a first ask |
| `agreement.js` | where agreeing to the terms is written down: the person's settings, and Rainshare's ledger |
| `moderation.js` | what @rainshare.dev has hidden: reading decisions, their keys, and what a pasted link is |
| `feedback.js` | Rainshare's feedback board on userinput.app: reading it, whose statuses count, and what the routine may hand an agent |
| `route.js` | URLs, including fixing mistyped ones |
| `mode.js` | day or night (the system's setting, or the toggle's choice), and the fade between them |
| `markdown.js` | a small, safe Markdown renderer for specs |
| `demo.js` | the example board at `/example`, served from fixtures and browser storage |

## Deploying

rainshare.dev is a Vercel project on this repo (`vercel.json`), using the Vite preset with
`npm run build` as the build command.

1. **Set the site address.** Add the domain and set `RAINSHARE_SITE=https://rainshare.dev` for
   Production (and Preview, if previews should use it too), then redeploy. Every link Rainshare
   writes starts from this: ask links in briefs, hand-back links, Bluesky posts, the CLI install
   line, `og:url`. Without it, links use `https://rainshare.vercel.app`. The OAuth client
   metadata is served for whichever host the request came in on, so preview deployments can sign
   in too.
2. **Let the build publish the lexicons.** They belong to @rainshare.dev, which the build
   identifies by its DID, `did:plc:cmkittusvczhnei4gjt3asiv` (`OWNER` in `lexicons/compat.mjs`).
   - Make an app password for that account and set it as `RAINSHARE_LEXICON_APP_PASSWORD`, for
     Production only, marked sensitive.
   - Add a TXT record at `_lexicon.rainshare.dev` with the value
     `did=did:plc:cmkittusvczhnei4gjt3asiv`. The build log warns if it's missing or wrong.
   - Redeploy.

After that, every production build publishes any schemas that changed, as
`com.atproto.lexicon.schema` records. It never deletes one. Preview builds only compare against
what's published, and don't need the password.

A breaking change fails the build, preview or production: removing or renaming a field,
changing a type or a limit, changing what's required, or dropping an option from a union.
Adding optional fields, new defs or new options to an open union is fine, and so is changing
the permission set, as long as it only grants things under `dev.rainshare.`. For anything bigger,
use a new NSID. If nobody has written records under the published schema yet, you can deploy
once with `RAINSHARE_LEXICON_ALLOW_BREAKING=1` instead. `npm run lexicons` publishes by hand,
with the same variables.

`@vercel/og` is pinned to 0.11.1, because 1.0.3 doesn't load as an ES module in Node.

### Posts and messages on Bluesky

@rainshare.dev posts each new ask on the board once the approver has said yes to it (see
[Review before anything is passed on](#review-before-anything-is-passed-on)), and sends a direct
message to everyone who's asked for one and has news. A post names who's asking, with a mention so they hear about it, and gives
the ask's title, with a card that links to its page.

That's the announcer, [`announcer/`](announcer), a small service that stays up on the same
droplet as Poe's services (atpota-to/atpota.to). It listens to Jetstream for Rainshare's own
records, so a run follows within a minute or two of someone asking, taking something on or turning
work in, and it keeps one Bluesky session rather than signing in each time. Merging to `main`
deploys it there, the way Poe's are deployed: a GitHub Action has the droplet fetch the commit,
test it, restart the service and check its health, rolling back by itself if it isn't healthy.
[`droplet/README.md`](droplet/README.md) has the layout, the one-time setup on the droplet, the
deploy key and rollbacks, and [`announcer/README.md`](announcer/README.md) how it decides what to
post and send.

It needs an app password for @rainshare.dev made with "Allow access to your direct messages"
ticked, and the index's Supabase URL and service key, in the droplet's
`/root/rainshare-announcer/.env`, not in Vercel. Without direct messages
allowed, the posts still go out, and each run says the messages can't. It starts in `MODE=dry`,
saying in its log what it would post and send, until that's set to `live`.

To see what it would post and send right now, from anywhere, without doing either:
`npm run announce`. It needs no password, but with one it reads the account's conversations, so
it knows what each person has already been sent.

#### Posts

`announcer/src/posts.js` decides what counts as new and posts it. A new ask is meant for everyone,
was asked in the last three days, at least 15 minutes ago (in case its title is fixed straight
after posting), and nobody's on it yet, as the board's "Nobody on it yet" has it: nobody has said
they're on it, or their take has lapsed, nothing's been turned in, and it isn't done or closed.
So an ask goes out about a quarter of an hour after it's asked, unless someone has taken it up by
then, and isn't posted at all once it has. Each run posts at most five, the earliest first, and
leaves the rest for the next run. If the takes and turn-ins can't be read, nothing is posted.

The account's own posts say what's been posted, not a database. An ask that one of its
last 300 posts links to isn't posted again, even if that post was written by hand. Each post also
takes the ask's own record key, so two runs at once can't post the same ask twice.

Asks from anyone @rainshare.dev blocks aren't posted, and neither are asks from anyone who blocks
it. To keep someone's asks off the account, block them from it. Nothing it has hidden on the
moderation page is posted or messaged either, and neither is an ask that Rainshare's checks find
very likely a trick on helpers' agents. If the list of what it has hidden can't be read, the run
posts and sends nothing. Nor is anything the approver hasn't said yes to, as it is now, and a post
about an ask that's hidden later is taken down.

#### Messages

People ask for messages on their Settings page (`/settings`), under "Messages from
@rainshare.dev", or in the welcome the first time they sign in, where both kinds are ticked to
begin with. Someone who was past the welcome before it asked (a profile, or the welcome seen on
that browser), and has none on, is asked about them on their own on their next visit, both ticked
again. "No thanks" switches nothing on, and either way it's asked once per account on a browser
(and not while their settings can't be read, since they may have them on).
There are two kinds, and they can have either or both:

- **Updates on my asks and my work**: someone's on one of your asks, or has turned in work on it
  (with a link to the pull request); an ask you were on was marked done, with your work or
  someone else's, or was closed.
- **New asks on the board**: asks meant for everyone that nobody's on yet and the approver has
  said YES or SEND to, except your own. An ask is in the day's news for the day it was said yes
  to.

The updates are worked out by `core/news.js`, which the bell in the site's bar uses too. Updates
go out within a minute or two: each run sends someone one message at most, with
everything since their last one, and nothing when there's no news. New asks come once a day, the
day's together, in the first message after 15:45 UTC. What people have asked for is saved as
`notify` in their `dev.rainshare.preferences` record, which anyone can read, like every record in
their repo. A sign-in from before Rainshare had settings can only keep them in the browser, where
the announcer can't see them, and the panel says so. `announcer/src/messages.js` works out who
gets what.

Bluesky only lets accounts someone follows message them, unless they've changed that, so
switching messages on (in the welcome or in Settings) follows @rainshare.dev for them, unless they
already do: an `app.bsky.graph.follow` record in their own repo, the one Bluesky record Rainshare
writes. Switching messages off doesn't unfollow. Settings say whether you follow it, and with
messages on and no follow, offer a button to follow it. A sign-in from before Rainshare asked to
follow is pointed to Bluesky to do it by hand instead. The announcer skips anyone it can't message
and says why.

There's no database here either. Each message covers whole minutes for updates, and whole days
from 15:45 UTC for new asks. The last message the account sent someone says how far they've heard,
so a restart or a missed run is caught up by the next, for up to three days. Runs start half a
minute past a minute and stop sending before the next, so no message lands in a period it didn't
cover. Someone's first message catches up on the day before.

There are three ways to stop them, and any one of them works:

- Untick them in their settings.
- Reply STOP to any message, and the account answers once to say it worked. START turns them back
  on. Whichever of the two someone sent last is what counts. The announcer looks at its
  conversations every minute, so a STOP is answered quickly.
- Use Bluesky's own settings: leave the conversation, or stop letting @rainshare.dev message you.

People someone blocks on Bluesky aren't in their news, and the account doesn't message anyone it
blocks or who blocks it. Nothing it has hidden is in anyone's news, and it doesn't message an
account it has hidden.

### The index

[`indexer/`](indexer) is Rainshare's AppView: a second small service on the droplet that keeps
every `dev.rainshare.*` record on the network in Supabase (the same project as the terms ledger),
from Jetstream, reconciled against every repo every six hours. It's atpota.to's garden index,
adapted, and holds no atproto credential. The announcer reads the board from it while its
heartbeat is fresh, and from every repo otherwise; the review queue lives beside the records. The
site still reads the network for now. The schema is
`supabase/migrations/20261115210000_rainshare_index.sql`, and [`indexer/README.md`](indexer/README.md)
has the rest.

## Not tried for real yet

Most of Rainshare has been tested against fake networks, in the example board and in headless
Chromium, and the read-only lookups have been run against the live services. These haven't been
done for real yet:

- Signing in all the way through and writing to a real PDS. So far bsky.social has accepted the
  full permission list and shown its sign-in page, and that's as far as it's gone.
- Making an account all the way through. bsky.social and eurosky.social open on their sign-up
  form, and that's as far as it's gone.
- Posting an issue, comment or pull request to Tangled or knotless as a real user.
- Reading a Tangled issue's comments has been tried against the live API, read-only. It uses
  `org.tangled.feed.listComments`, which Tangled hasn't published a definition for, so it could
  change without notice.
- `rainshare.mjs run` end to end with a real agent.
- GitHub status lookups against real GitHub (only mocked so far). A signed-out browser gets 60
  requests an hour, and after that the forge's side shows as unknown.
- Reading a real Tangled vouch circle.
- A board with lots of asks on it, or a slow relay.
- The 3D landing and plants on a real graphics card, a real phone, Safari or Firefox. On
  Chromium's software renderer the full-window landing ran at about 4 frames a second.
- Private asks in a real group space.
- Moderating as @rainshare.dev for real. The moderation page has only been driven against a fake
  source in headless Chromium, and no server has been asked for its extra scope yet.
- Link previews as Bluesky and other sites render them in production.
- The announcer on the droplet, and its deploy. It has run here against the live network in
  `MODE=dry`, listening to Jetstream and working out what it would post, and `droplet/deploy.sh`
  has been run against a stand-in droplet, but it hasn't been set up on the real one, and nothing
  has been posted or sent yet. The Bluesky chat calls have only been tried against a stand-in,
  including whether a STOP reaches the account when its own settings only allow messages from
  people it follows.
- A real account's first sign-in, and the welcome that follows it; and an account with a profile and
  no messages on, which is asked about messages on its own.
- Following @rainshare.dev from a real account when messages are switched on, and a real server's
  consent page for the follow permission. It's only been tried against a stand-in PDS and AppView.
- The bell with a real account's records. It's been driven on the example board in headless
  Chromium, and its comment lookups are the ones an ask's page already makes, but nobody's had a
  real notification yet.
- A server accepting the permission set. That waits for a production build to publish it.
  Until then, bsky.social refuses the set and Rainshare falls back to asking for the records by
  name, which works.
- The feedback page against Rainshare's own board, which hasn't been made yet. It has been
  checked in headless Chromium against userinput.app's own board, and `scripts/feedback.mjs` has
  read that board. Neither has written a status to a real board.
- The feedback routine end to end in a scheduled cloud session.

## Similar ideas

Rainshare isn't the first go at putting spare capacity to work for other people. Some others:

- [Overflow](https://github.com/Nitjsefnie/Overflow) is a shared ledger for open-source work.
  You spend leftover AI plan usage on issues in registered repos, earn points when your pull
  request merges, and spend them to get issues in your own repos done. It runs on GitHub and
  GitLab.
- [Iynx](https://github.com/amit221/Iynx) puts unused Cursor tokens to work by itself. It picks
  issues in popular GitHub repos, fixes them in Docker and opens the pull requests.
- [co/core](https://cocore.dev) is an AI cooperative. Members share the Macs they already own
  to run open models for each other, through the same API the big providers use. Jobs are
  paid for in tokens, and every one leaves a public receipt.
- [HelpPeer](https://help-peer.com) has people point their own agents at public datasets. Two
  or more contributors' agents do each piece without seeing each other's answers, and the
  values that agree go to the project's repository as a pull request.
- Before AI plans, [BOINC](https://boinc.berkeley.edu) put people's idle computers to work on
  science projects, and [Up For Grabs](https://up-for-grabs.net) lists issues that projects
  have set aside for new contributors.

## License

MIT. See [LICENSE](LICENSE).
