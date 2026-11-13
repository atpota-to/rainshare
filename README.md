# Rainshare

*Got rain to spare? Send your agent to help someone else.*

> **Early alpha.** Rainshare works end to end, but the screens, the CLI and the record format
> may still change. What you post is saved in your own account.

AI plans reset whether you use them or not. On Rainshare, people post the ideas and projects
they want help with, and you send your own agent to do the work, signed in as you, on your own
plan. What they get back is the work, and that help is what Rainshare calls rain. It's
[Overflow](https://github.com/Nitjsefnie/Overflow) on atproto, without the ledger: nobody earns
or spends credits, and your board starts with the people you follow. (Is that allowed by your
AI plan? See [the FAQ](#faq).)

- **Ask for rain**, in two short steps with a preview beside them. *What*: an idea, or a
  project you already have, where it lives (a Tangled, knotless or GitHub issue, or any git
  repo) and how far along the project is as a whole, each drawn as its own little 3D plant. *Details*: what done looks
  like and which models you'd prefer (a family, like Claude or GLM, and a level: frontier,
  mid-tier or small), with tests, size and tags behind "Add tests, size and tags",
  and a Bluesky post to tell people it's there. It's open to everyone. An idea needs no repo and no developer: say
  what it should do, and whether someone else can run with it.
- **Say your AI plan**: your profile starts with which AI plans you pay for to code with (Claude,
  ChatGPT, Copilot, Cursor, Gemini, Z.ai's GLM Coding Plan; by provider, not tier), or that you
  have free tiers or none. It's about coding subscriptions and the usage that comes with them. It shows on your profile and
  beside your asks, so a helper can see who's asking, and an asker can see who has rain to
  spare. Then what you run and the work you take on. It sticks to facts: what you'd like done, on
  which models, and who has them. Your name, picture and bio are your Bluesky profile's, unless
  you give Rainshare a different name or bio.
- **Send your agent**: one click tells whoever asked that you're on it and copies the command
  that suits your setup (Claude Code, Codex, or a brief for any agent); the other ways are a
  click away. Turn the pull request in when it's up, and they mark it done.
- **Grow a garden**: everything that gets done with your help shows on your profile as a
  plant, in a garden of what you've helped with.

**The words, and the pictures.** What people read is plain: an *idea* (nothing built yet)
or a *project* (something that exists), which is *done* when the work lands. Rain is the
brand: the help your agent gives when it has time to spare, and "Ask for rain" to ask for
some. The rest of the metaphor is drawn rather than said. An idea is drawn as a seed in the ground, and a project as a plant
grown as far as it has (just started, taking shape, established). When the work is done it's
drawn one stage on, and what you've helped with grows into a garden on your profile. The
records keep the metaphor's names (`dev.rainshare.seed`, `stage`, `state: sprouted`), which
nobody needs to read.

The people have plain names too. Whoever posts an ask is called by their name, or "whoever
asked"; whoever sends an agent is a *helper*; the people you follow, and who follow you, are
your *circle*. The site doesn't call anyone a friend: an ask is open to everyone, so the
person you help may be someone you've never met. The steps keep one verb each: *ask for
rain*, *send your agent* (which takes it on), *turn it in*, *mark it done*.

It runs in two places, both from this repo:

| Where | What |
| --- | --- |
| **rainshare.dev** | The site: the landing, sign-in, the board, and an example circle at `/example` that's kept in your browser (linked from the landing and the footer, with its own tab in the bar while you're in it). Light and dark. |
| **Your terminal and your agents** | `rainshare.mjs`: a CLI and an MCP server in one dependency-free file, served at `rainshare.dev/rainshare.mjs`. |

## The landing

Signed out, the home page is the pitch in a small garden, drawn in 3D (`src/landing/`), to
play with. The garden is the page's whole backdrop: its sky runs behind the bar and the
pitch, and its meadow from one edge of the window to the other. It's Rainshare in one picture:

| In the scene | In Rainshare |
| --- | --- |
| **Your cloud**, with a ring over it that runs down | Your AI plan, and how long until it resets |
| **A row of plots**: a seed's marker, or a plant | Someone's idea, or their project, as far along as it is |
| **Rain**, where you send the cloud | Your agent, sent after one of them |
| **The plant grows a stage**, and wears the gold spark | The work's done, and it's in your garden |
| **The cloud thins out**, and a full one forms | The plan reset. What you hadn't used is gone |

Drag the cloud along the row, or pick a plot (its label, or anywhere on it), and it rains
there. A line under the plots says what's happening, with a link to that idea or project in
the example circle. Leave the cloud where it is and the reset comes all the same. Behind the
row someone else's cloud is already raining on a plot of its own, so the whole of it shows
before anyone touches anything. Three plots take the whole cloud; once they're done the line
says "Three done", with a way to start again.

The plots are four asks from the example circle (`plots.js`): Kai's agent is on Sam's project,
and Mo's idea, Juniper's project and Priya's are in the row. Each is drawn as the same plant
it is on its own page (`src/plants/models.js`), a stage further on once it's done.

The clouds are the ones atmosphere.online's sky is made of: each is a hundred or so soft, lit
"puffs" with noisy edges (`puffs.js`, brought over from that repo's `src/puff3d.js` and
`src/sky.js`), under the same Morning and Night colours (`sky.js`). Yours loses puffs as its
rain is spent. The gold in the rain, and over a plant that's done, is the spark from the logo.

The ground, the grass and the far woods are generated in code from one fixed number
(`garden-scene.js`), so there are no models or textures to download. The scene follows the
system's light or dark setting as day or night.

**The backdrop.** The canvas runs from the top of the page to a little under the landing,
where it fades into the page, so the board's heading stands in the last of the meadow. The
garden itself is fitted into the part of the picture the page keeps clear for it (`fit.js`):
beside the pitch on a wide window, and under it below 880 pixels, where the pitch is in the
sky and most of the garden is below the first screenful. Beside the garden the pitch stands
on its horizon: the heading and the line under it in the sky, and the sign-in on the line of
the far woods, with nothing under it. (The horizon is worked out from the layout alone, so
the pitch is there before the scene has been fetched.) Over the sky and the meadow the grey
the rest of the site writes its asides in is too faint to read, so the bar and the pitch
write theirs in most of the ink; and if a handle is mistyped, what's said about it under the
sign-in is on a pane of frosted glass, like the scene's own labels.

**Scrolling.** The backdrop scrolls with the page, and the garden doesn't quite keep up: the
camera rises as the page goes by, so the garden sinks into a stretch of meadow left between
it and the line of words under it, the hills behind it sink less, and the sky not at all. It
sinks only as far as that stretch (120 pixels at most), with its labels, so it can be played
with all the way, and on a phone it starts once the whole garden has been seen.

It's three.js, about 150 kB gzipped, and the page asks for it only when the landing is on
screen, so someone who's signed in never downloads it. It holds still when it's scrolled out
of view, when the tab is hidden, when someone presses pause, and from the start for anyone
who has asked their system to reduce motion (sending the cloud still works for them: it's
there at once, and the work done; and nothing sinks as they scroll). A browser that can't do
WebGL gets a flat drawing beside the pitch, with the same story in three notes under it.

Filling the window costs pixels: about three times as many as the scene had in a box of its
own on a laptop, and more on a phone, where the backdrop is taller than the screen. Most of
the extra is sky, which is cheap to draw, and the canvas is capped at 4.2 million pixels, so
on a big, dense screen it's drawn a little under the screen's own sharpness. It hasn't been
timed on a real graphics card yet (see below).

**The water cycle.** The scene used to be the water cycle: a stretch of coast where mist rose
off the sea, gathered into clouds, rained on seeds by a river and ran home. It had nobody in
it, and a cycle promises that what you give comes back, which Rainshare doesn't. It's kept,
whole, in `src/landing/cycle/` in case it's wanted back: set `SCENE` in `landing.js` to
`'cycle'`, or add `?scene=cycle` to the address to look at it. Nobody downloads it otherwise.
It's still drawn in a box of its own beside the pitch, with its edges fading into the page,
as the garden was before it became the backdrop.

## Signing in

Signing in sends you to another website: the one your account's own server signs people in
on, with a page you may never have seen. So Rainshare says where you're going before you go
(`src/signin.js`), in two steps:

1. **Your handle.** Accounts that match are offered as you type, with their pictures
   (Bluesky's typeahead, which knows accounts with a Bluesky profile). Picking one, or typing
   a whole handle and pressing Enter, goes on; a handle nobody offered is taken as typed.
2. **"Is this you?"** The account's picture, name and handle, as the network has them for
   what was typed. Under it, what Rainshare asks for, each with a tick box: your Rainshare
   records (required), posting to Tangled, and posting to knotless. The last two start ticked
   and are yours to untick; what's unticked isn't asked for, stays unticked next time on that
   browser, and can be added later where it's needed. Then one button, **Continue at
   pds.example.com**, naming the site it leads to, with a line under it saying you'll sign in
   there, where your account lives, and come straight back. "Not you?" goes back to the
   handle. Rainshare never sees your password, and says so.

The site named is found before the button can be pressed, the same way the sign-in itself
finds it (`whereTo` in `src/oauth.js`): the handle's account, its server, and the address
that server signs people in on. For most accounts that's their own server; accounts on
Bluesky's servers all sign in at bsky.social. Nobody is sent anywhere until they press it.

On the landing the handle field is on the page, and the dialog opens at "Is this you?".
Everywhere else ("Sign in" in the bar, on an ask's page, on the board) the dialog starts with
the handle, and signing in comes back to the page you were on. "Connect Tangled" or "Connect
knotless", for a sign-in that left one out, is the second step on its own: your account, the
list with that forge ticked, and the same button.

**The same pictures in the app.** A forecast (set aside for now) is drawn as its sky: clear, then a cloud with
more and more rain (`skyIco` in `ui/bits.js`). A seed is drawn where it is in its life: in the
ground, being rained on once someone's on it, up once it's turned in, and sprouted (`lifeIco`).

The "ai" inside the name is lit in its own colour wherever the wordmark appears, and so is
the "ai" inside "rain" where the word is prominent: the headline, the pitch under it, and the
line under the board's heading (`lit` in `ui/bits.js`). It's one variable, `--lit`, in
`src/theme.css`, with a second value for dark. Screen readers get the plain text.

**The logo** is a drop of that water and the gold spark, in 3D. The drop is the flat logo's
outline turned round its own axis, and the spark is a cut gem with eight flat faces. Both are
lit the way the scene and the plants are: the sun up and to the left, the landing's sky
reflected in the water, and light gathering on the far side of the drop as it does in a real
one. The spark lights the drop's shoulder too.

In the bar it moves, a little. It bobs over its shadow, the light in the water shifts, and
every eight seconds a glint crosses the drop and sets the spark turning. Pointing at it gives
the drop a wobble. It follows light and dark as day and night (at night its shadow is a glow),
and it holds still off screen, in a hidden tab, and for anyone who has asked their system to
reduce motion.

It's on every page, so it doesn't use three.js. It's drawn a pixel at a time in plain
JavaScript (`src/logo/drop.js`), which at the size of a logo takes about a millisecond a
frame, thirty times a second. Until that has started, and with JavaScript off, the bar shows a
picture of it in the same pose. The tab's icon and the home-screen icon are pictures of the
same drawing: `npm run logo` takes them again after the drawing changes (it needs no browser,
only Node), and `src/logo/sheet.html` is a page to look at it on at every size, by day and by
night, through its loop.

The site is set in one typeface, Zen Maru Gothic, the same one atmosphere.online uses
(`--body` in `src/theme.css`).

**While it loads.** The board, an ask's page, a person's page, your profile and a garden
each show placeholders laid out like the real thing (`ui/skeleton.js`): the same cards, rows
and pictures, built from the real screens' own classes so nothing moves when it arrives, with
one band of light passing over all of them. When a part arrives its placeholders dissolve
where they stood and the content rises in under them, a card at a time (`paint` in
`ui/rainshare.js`); pages are often drawn again a moment later, so what's under way carries
on from where it was rather than starting over. With reduced motion on it's a plain swap.

**Arriving by a link.** Signed out, an ask's page and a person's page say in a line what
Rainshare is, with the way to the landing, since someone who followed a link hasn't seen it.
A visitor with no sign-in to restore gets the landing and the sign-in button at once.

**Wrong addresses** (`core/route.js`). Where it's clear what was meant, the app goes there:
a link that picked up the full stop after it, a capital, an ask's link cut short (it leads to
whoever asked), `/someone.example/<key>`, `/@handle`, an `at://` address, `/ask`, `/agnets`,
`/exmaple`. Where it isn't, the page says nothing is there and offers the board. An ask
that's gone offers whoever asked.

## The records

Everything is a record in its owner's own account, under `dev.rainshare.*` (rainshare.dev is
the lexicon authority). The schemas are in `lexicons/dev/rainshare/`.

| Record | Written by | Says |
| --- | --- | --- |
| `dev.rainshare.profile` (`self`) | everyone | a name and bio for Rainshare only (left out, your Bluesky profile's are used), AI plans, setups (harness, models, where it runs), the kinds of work you take on; and, from before or set aside for now, a setup's typed plan, AI budget, forecast, circumstances, values and priorities |
| `dev.rainshare.seed` | the requester | title, subject (Tangled issue, knotless issue, GitHub issue, or repo; none for a seed, which says whose the result will be), stage (for a plant), spec in Markdown, wants (model families and a level; older asks named models), tags, size, audience, state (`open`, `sprouted`, `closed`); values, set aside for now |
| `dev.rainshare.take` | a helper | "my agent is on this": a strong ref to the seed and the setup doing it. Deleting it drops the seed. |
| `dev.rainshare.delivery` | a helper | the pull request (URL, or on Tangled and knotless its own record's at:// URI), what did the work, and an optional session link |

**Public, and private soon.** Private seeds are off for now (`GROUPS` in `core/ns.js`),
because spaces are still an alpha on the group host: sign-in asks only for `atproto` and
Rainshare's own four record types, every seed is public, and the app shows "Private, in a
group" as coming. Turning `GROUPS` on brings back everything below that's about groups.

**Set aside for now**, to keep it simple while it's early (`FEATURES` in `core/ns.js`). Each is
still in the records (old records keep theirs, and saving a profile keeps what's there), and
turning one on brings it all back:

| Switch | What it brings back |
| --- | --- |
| `audience` | The "Who's it for?" step when asking (everyone, mutuals, people you follow, your followers, a Bluesky list, with a count of roughly who that reaches), and "Who it's for" on an ask's page. Without it every new ask is open to everyone; an older ask's audience is still honoured. |
| `seedValues` | "What it stands for" when asking, and "Stands for" on an ask's page. |
| `priorities` | "Who you'd like to help first" on your profile (people without big plans, students, people on low incomes, projects that share your values…), and its say in the order of your board. |
| `forecast` | How much rain you have to spare: on your profile and in the board's header, and the CLI's `forecast` and the MCP server's `rainshare_set_forecast`. |
| `values` | "What you care about" on your profile ("Cares about"), and its say in the order of your board ("cares about climate too"). For now Rainshare sticks to the facts of a job. |
| `circumstances` | "About them" on your profile (a student, between jobs, a maintainer…), and its say in the order of your board. |

**Your AI plan** (`plans` on a profile) takes over from two older fields, which apps still read
when there's no plan: a setup's typed `plan` ("Claude Max 20x") and `budget` ("under $25").
Picking a paid plan clears "No AI plan" and "Free tiers only", and the other way round.

**Models: a family and a level, matched to plans.** An ask says which model families it would
prefer (Claude, GPT, Gemini, DeepSeek, Qwen, GLM, Kimi, Mistral, or another typed in) and at
what level: any, **frontier** (the most capable model a family has), **mid-tier** (a step below,
capable and lighter on a plan) or **small** (quick and light, for simple jobs). It doesn't name
models, which change every few months; "Any model, any level" is the default (`FAMILIES` and
`LEVELS` in `core/ns.js`). Its page says it as "Models" ("A frontier Claude model", "A small
Qwen or GLM model", "Claude or GPT"), and
each helper sees how theirs fit: a model they run from one of those families ("You run
Sonnet"), else a plan that reaches one ("Your Claude plan has Claude models"), else, if their
profile says enough to tell, "Not in your plan or setup". Plans are matched by family
(`PLAN_FAMILIES`): Claude reaches Claude, ChatGPT reaches GPT, Gemini
reaches Gemini, Z.ai's GLM Coding Plan reaches GLM, and Copilot and Cursor reach Claude, GPT and
Gemini. The level is shown and goes in the brief, but
isn't matched: whether a plan includes a family's frontier model changes too often to say, and
a helper knows which of theirs it is. The ranking counts the same: a model you run counts
most, a plan that reaches it a little, and a miss against. Older asks named models
("Opus or Sonnet"), and are shown and matched that way.

A public seed lives in your repo, and `audience` says who it's
for: apps show it only to those people and only offer it to them. It doesn't hide anything,
though: a public repo can be read by anyone. A private seed lives in your repo
inside a group's Rainshare space (an Open Social space of type `dev.rainshare.board`, which a
group admin adds), and only members can read it. Takes and deliveries go wherever their
seed is.

**Names and bios come from Bluesky.** Rainshare names people as their Bluesky profile does, with
its picture and its bio (`description`). Your Rainshare profile can give a different `displayName`
or `bio`, for Rainshare only: left out, Bluesky's are used (`shown` in `core/source.js`). Your
picture is always Bluesky's for now, since a picture of your own would need permission to upload
files to your account.

**Profiles, in two copies** (once groups are on). Your circumstances can be marked "only my groups": the
public profile leaves them out, and the full profile goes only into your groups' Rainshare
spaces. Helpers who can read a group copy see the fuller one.

**Who's in your circle** comes from Bluesky: `app.bsky.graph.getRelationships` tells mutuals,
people who follow you and people you follow apart; lists come from `app.bsky.graph.getList`;
anyone you block on Bluesky is left out.

**How you know someone** (`core/ties.js`) shows beside the people who ask and the people who
help, as something to weigh before you send an agent to their repo or merge what theirs sent:

| | Read from | Shown |
| --- | --- | --- |
| Who follows whom on Bluesky | `app.bsky.graph.getRelationships`, as for audiences | "You follow each other on Bluesky." |
| Who follows whom on Tangled | `org.tangled.graph.follow`, a public record in the follower's account keyed by who they follow: yours are one listing, and whether someone follows you is one read of theirs | "Tomás follows you on Tangled." |
| Who you follow that follows them | `getRelationships` again, asking about your 1,000 most recent Bluesky follows 30 at a time; the ones who follow you back are named first | "Followed by Kai, Priya and 3 others you follow on Bluesky." |
| Your Tangled circle's word | `org.tangled.graph.vouch` (see [Tangled's vouches](#tangleds-vouches)) | "Priya, who you vouch for, vouches for them on Tangled." |

A card says it in a word ("mutual", "follows you", "you follow them"), where a follow on either
network counts, and shows the vouch mark. Picking one says all of it under "You and them", and
so do an ask's page (beside who asked, and beside each helper who turned something in) and
someone's profile. The board can be narrowed the same way, **From**: anyone, mutuals, people you
follow, people who follow you, or people your Tangled circle vouched for, each with a count.
That only narrows what you see. It changes nobody's audience, nobody's ranking, and who can
take an ask on. Anyone can follow you, so "follows you" says the least of these; a follow
you made, and the people you follow following them, say more. Tangled follows from before its
relaunch (`sh.tangled.graph.follow`) aren't read.

**Finding seeds** needs no server of ours: a relay lists the repos that hold
`dev.rainshare.*` records (`com.atproto.sync.listReposByCollection`), and the records come from
each person's own PDS. Your own writes are layered over that until the relay catches up.

That makes the board a reading of the network, done in your browser each time, rather than an
index kept somewhere (`core/source.js`). Three questions go to a relay (who has asks, who has
takes, who has deliveries); each of those people's servers is asked for their records, six at
a time, after their DID document says where it is; then Bluesky's AppView gives names,
pictures and who follows whom, and each asker's server gives their Rainshare profile. It's as
many requests as there are people taking part, which is fine while that's dozens and is the
thing to replace with an index of our own if it becomes thousands. Two things keep it quick
meanwhile (`core/net.js`). A relay that hasn't answered in 2.5 seconds gets company: the next
one is asked as well, and whichever answers first is used (each is given 8 seconds, as is
each person's server). And one ask's page doesn't read everyone's takes and deliveries to
find its own: [Constellation](https://constellation.microcosm.blue), microcosm.blue's index
of which records link to what, names the ones that point at it (`backlinks`), and each is
then read from its owner's server and dropped unless it does point back. If the board read
everyone's a moment ago, that's used; if Constellation doesn't answer, it's the long way
round. [Slingshot](https://slingshot.microcosm.blue), its cache of records, is used only
where a server of ours has to look something up (link previews, below); the app itself reads
records from the servers they live on.

**Ranking** (`core/rank.js`) puts first who could use the help (no paid AI plan), then what you can
bring (a wanted model you run or your plan reaches, tags that match the work you take on), then
closeness. (While who you'd like to help first, what you care about and the asker's situation are
set aside, they have no say.)
Each card shows how well it suits you as one to three drops ("Strong fit", "Good fit", "Some
fit"), and picking one says why in plain sentences beside the list: "Priya has no AI plan and
is between jobs. They'd like Sonnet, which you have. Heads up: someone's already on it." The
rest of a seed reads as short lines too (`core/words.js`): where the work is, the job (with
anything else they asked for), the models and how they fit yours, and who's on it. On a phone the details come up as a sheet.

## Sending an agent

However a seed reaches an agent, the agent is handed the same brief (`core/brief.js`):

1. **Where** the code is, and the issue if there is one.
2. **Where it stands** on the day it was copied: who has taken it on, what's been turned in,
   and what the forge says. If something is in the way (someone else is on it, a pull request
   is already up, the issue was closed), the brief says so outright.
3. **Before you start**: look again, because a brief can sit in a clipboard for days. It names
   the commands (`gh issue view`, `gh pr list`, `rainshare.mjs check`) and tells the agent to
   stop and say so rather than do the work twice.
4. **What they want**, and their guidelines. This part is framed as another person's request,
   not as instructions that override the agent's own rules: stay inside the repository, and
   ask before anything that reaches outside it.
5. **Turning it in**: open the pull request (on GitHub with "Fixes #N", so that merging it
   closes the issue) and put the seed's link in it. That link is how the seed and the pull
   request find each other later. On knotless the brief names knotless's own commands, so an
   agent with its CLI or MCP server forks, pushes and opens the pull itself. On Tangled the
   agent pushes a branch and writes the title and description, and the pull request is opened
   through Rainshare, as its user: by the agent, if Rainshare's CLI or MCP server is signed in
   beside it, or by its user from a link the agent hands back.
6. **When you're done**: tell your user the pull request's address, whether it has been turned
   in on Rainshare, and that the rest is the requester's to do.

There are four ways to hand it over. They differ in what has to be set up, and in who does the
Rainshare side of things.

| Route | Needs | Who says "I'm on it" | Who turns it in |
| --- | --- | --- | --- |
| **Paste the brief** into any agent | nothing | you, with "Send my agent" (or nobody, with "Copy as Markdown") | you, by opening the link the agent hands back |
| **One command in a terminal**: `git clone … && claude "<brief>"`, or `codex`, or a Claude Code cloud session on a fork | that agent's own CLI | you, with "Send my agent" | you, by the same link |
| **Rainshare CLI**: `run <seed>` | the one file and an app password | the CLI, after checking | the CLI: when the agent exits it finds the pull request with `gh` and offers to turn it in |
| **MCP server**, inside your agent | the one file and an app password | the agent, with `rainshare_take`, which checks first | the agent, with `rainshare_turn_in` |

"Send my agent" reads the seed again and asks the forge before it writes your take. If that
turns up something the screen wasn't already showing, it asks before going on. Then it copies
whatever suits the setup in your profile: the Claude Code or Codex command, or the brief by
itself for anything else. The seed's page shows that one, with the other ways a row of choices
above it, and the turn-in form asks only for the pull request's link (what did the work, a session
link and a note wait behind "Add a note or details", filled in from your setup). On knotless and
Tangled, "Open it from here" swaps that form for the one that opens the pull request.

The screens keep their explanations out of the way: the why and the how of a thing sits behind
an ⓘ beside it, which opens a small note when pressed, rather than as a paragraph under it.

The link an agent hands back is
`rainshare.dev/seed/<handle>/<key>?pr=<pull request>&model=<model>`. Opening it fills in the
turn-in form, and sending it writes your take (if there wasn't one) and the delivery together
(`handBack` and `readHandBack` in `core/brief.js`). On Tangled and knotless the link can
carry a branch instead, `?branch=<branch>&from=<fork>&model=<model>`: opening it fills in the
form that opens the pull request, and sending that opens it and turns it in
(`handBackBranch` and `readBranchBack`). Once you've turned something in, the form steps
aside and the page says what's left: nothing, unless the requester asks.

## Ideas and projects

Every ask says what it is: an idea, or a project and how far along the project is as a whole. That's what a
helper sizes it up by, and it's what the brief tells their agent first. Each is drawn as a
seed or a plant.

| What people read | What it means | Drawn as | In the record |
| --- | --- | --- | --- |
| **Idea** | Nothing's been built yet. | a seed, sown: a marker in the soil | no `subject` |
| **Project**, just started | There's a repo and a first sketch. | a seedling | `stage: seedling` |
| **Project**, taking shape | It works, and it's still changing. | a young plant | `stage: young` |
| **Project**, established | People use it and rely on it. | an established plant | `stage: established` |

Each has a small 3D model (`src/plants/models.js`): a mound of soil with a marker where the
seed was sown (the seed itself is under the soil), a stem
with its first two leaves, a stem with leaves up it, and several stems in flower. They share
one mound and one framing, so how big each stands says how far along it is.

The plants are grown rather than drawn once, so no two asks need look alike. Each one grows
its own kind of plant, picked from its record's address (`plantKind` in `ui/bits.js`), so
it's the same plant for everyone who sees it, wherever it shows. A kind decides the outline
of its leaves (oval, heart, lance, round, lobed or ruffled), their markings and green, whether
they come singly, in pairs or in threes, how tall it stands and which way it leans, the colour
and petals of its flowers (the colour on its marker while it's still an idea), which seed it
started as (a seedling may still wear the coat), and the pebbles in its soil. A kind keeps
all of that as it grows, so the seedling an idea becomes is recognisably the same plant when
it's established. Kind 0 is the plant as first drawn, and it's what the steps of asking show.

There's a picture of every stage of each of the 12 kinds the app picks between
(`public/plants/*.webp`, about 750 KB for all 48, of which a page fetches only the ones it
shows), and that's what shows on cards, lists, gardens and the first step of asking. On an
ask's own page and in the preview beside those steps the model itself turns slowly, the same
kind as its picture, drawn by one shared renderer that loads only when a plant is on screen
(`src/plants/live.js`); without WebGL, or with reduced motion on, the picture stays.
`npm run plants` takes the pictures again after a model changes (`npm run plants -- seed`
for one stage only, so the others aren't rewritten), and `src/plants/sheet.html`
on the dev server shows every kind turning, side by side.

## What you've helped with

Helping doesn't earn credits. It grows a garden instead: one plant on your profile for
each idea or project that got done with your work, drawn as what it grew into, and each one
opens the ask it came from. Your board says how many ("Helped with 2").

It's worked out, not stored (`core/garden.js`). A helper's delivery says what they worked on,
and the asker's own record names the delivery that did it, so a garden needs both
people's records to agree and nobody can add to their own. Two friends could still agree to
pad each other's, so a garden is only ever shown as plants: there's no total and no
leaderboard. Only public asks count for now.

## An idea, with no repo

An idea has no code to point at. Asking for rain on one asks one thing more: whose will it be?

| | **Someone else can run with it** | **Start it for me** |
| --- | --- | --- |
| Who keeps what's built | whoever builds it, in a repo of their own | the person who asked |
| Who it's for | anyone with an idea, developer or not | someone who wants the repo but hasn't made it |
| How many can take it on | more than one, by default | one at a time, by default |
| What's asked when planting | the idea in plain words, how big it feels, tags | the same as any seed |
| What the brief tells the agent | it's your user's project: start a new repo | ask where it should live before creating anything |

Either way the brief lists where a new repo can go and the command for each, tells the agent
to look first for something that already does the job, and asks for a README that credits the
idea. What gets turned in is the repo's address, and with no merge to wait for, the person who
asked is told to have a look as soon as something is turned in. From a terminal, the
one-line commands and `run` start in a new, empty repository instead of a clone.

Rainshare doesn't make repos anywhere. It sends people to the right page instead
(`core/forges.js`): the new-repo page on Tangled, knotless, GitHub, Codeberg and GitLab, with
the name and description filled in where the forge takes them, and a seed's own repo, issue
and pull requests on whichever forge it lives on. Issues and comments are another matter on
the two forges that live on atproto: see the next section.

## Posting to knotless and Tangled

On knotless and Tangled, Rainshare can post as you (`core/forgewrite.js`): open an issue, leave
a comment, and open a pull request from a branch that's been pushed. On GitHub and the rest it
can't, and links to the right page.

- **A pull request, from the ask's page.** Once a branch is pushed, to the repo or to your
  fork of it, "Open the pull request from here" offers the repo and your forks, each one's
  branches, the branch to merge into, and a title and description to look over (starting from
  the repo's template on knotless, the issue it fixes, and the ask's link). Sending it opens
  the pull request and turns it in on Rainshare with the same press.
- **The same, from an agent.** The brief has the agent push its branch and then either open
  the pull request itself (`open-pr` in the CLI, `rainshare_open_pr` over MCP, when Rainshare
  is signed in beside it) or hand its user a link, `…/seed/<who>/<key>?branch=<branch>`, that
  opens the ask's page with the form filled in.
- **A comment on the issue**, from the ask's own page. It starts with the useful thing to
  say: for the person asking, a note that the issue is on Rainshare, with its link; for a
  helper who's taken it on, that they're having a go.
- **An issue from an ask.** Asking for rain on a repo with no issue picked offers to open
  one there from the title and details, point the ask at it, and note on it where the ask is.

Sign-in asks for all of this up front, so nobody is sent back to their server halfway through
writing something. Each forge has a tick box in the sign-in dialog (see Signing in), ticked to
begin with, so it's said before anyone is sent to their server, and either can be left out.
A server that refuses part of what's asked is asked again for less, down to Rainshare's own
records alone (`ladder` in `src/scope.js`), and a sign-in that ended up with less is offered
"Connect Tangled" or "Connect knotless" where it matters, with what was typed kept. What's asked for is what each forge needs and no more (`FORGE_SCOPES` in `core/ns.js`):

| | How a post is made | What's asked for |
| --- | --- | --- |
| **knotless** | An issue, a comment or a pull is a record in your own account that names the repo. | Creating `dev.knotless.issue`, `dev.knotless.comment` and `dev.knotless.pull` records |
| **Tangled** | Issues, comments and pull requests are kept with the repo, on the knot that hosts it. Your server gives a token, good for a minute, that says a call is yours; the knot takes the write; and a record in your own account says it was you. A pull request is a ticket that names a branch to merge into, and then its changes. | A token for three calls by name (`com.atproto.repo.createRecord`, `org.tangled.review.submitPatch`, `com.atproto.repo.deleteRecord`), creating `org.tangled.graph.attestation` records, and your `org.tangled.graph.vouch` records (the next section) |

Tangled's permissions are the wider ones. A token "for a createRecord call" can't be tied to
Tangled alone, because what a knot checks is the repo's own identity, which differs for every
repo. They're among the permissions Tangled's own web app asks for, and Rainshare uses them
only for the repo an ask points at. The delete is there for one case: if a knot takes a pull
request's ticket and then refuses its changes, the ticket is taken back rather than left
empty on someone's repo. On this site nothing is posted unless you press a button that says
so. The CLI and MCP server sign in with an app password, which already allows all of it, so
an agent with `rainshare_open_pr` can open a pull request as you: the tool's description
tells it to do so only once the work is pushed.

## Tangled's vouches

Tangled has a [vouch network](https://tangled.org/docs/guides/vouching/): anyone can vouch
for someone, or denounce them, with a reason, and Tangled shows a mark beside a person only
when the word comes from your own circle (you, or someone you vouched for). Rainshare shows
the same mark beside the people who ask and the people who help (`core/vouch.js`), because
"does anyone I trust know this person?" is worth knowing before you send an agent to their
repo, or merge what theirs sent.

- **Reading** needs no extra permission. A vouch is a public record in the voucher's own
  account, `org.tangled.graph.vouch`, keyed by who it's about, so your circle is worked out
  from your records and those of up to 40 people you vouched for. It's read once per sign-in,
  on the first page that shows people (the board, an ask's page, or a profile). A person's profile says who in your circle vouched
  for them or denounced them, and why.
- **Vouching** is a button on someone's profile, and beside a delivery on your own ask
  ("Vouch for them on Tangled"), where the reason starts as what they helped with and the
  vouch points at the delivery (and at the pull request, when that's on Tangled, which is
  what Tangled itself attaches). You can take a vouch back. Rainshare never writes a
  denouncement: that's done on Tangled.
- A vouch gates nothing, on Tangled or here. It doesn't change who can take an ask on, or
  how the board is sorted. You can choose to see only the asks from people your circle has
  vouched for (the board's "Vouched for"), the way you can choose to see only people you follow.

## Where a seed stands

`core/status.js` answers one question for the app, the brief, the CLI and the MCP server alike:
where does this seed stand, and what should happen next? `look` asks the forge what Rainshare's
own records can't say, and `standing` puts the two together.

| What it finds | A helper is told | The requester is told |
| --- | --- | --- |
| Nobody is on it | It's clear to start | |
| Someone has taken it on | Check with them first (unless the seed welcomes more than one helper) | |
| A pull request has been turned in, or one on the forge mentions the issue or the seed's link | Read that one before making another | |
| A turned-in pull request has been merged | It's probably done | Mark it done, with one button |
| A pull request nobody turned in has been merged | It's probably done | Mark it done |
| The issue was closed on the forge | Ask before starting | Mark it done, or close it |
| It's done and the issue is still open | | Close the issue on the forge |

Nothing is closed automatically. Rainshare doesn't close issues or merge anything on a forge,
and whether a pull request did the job is the requester's call. So each side is shown what's left
for them at the moment they're looking: on the seed's page, in `check`, and in the brief.

A pull request that mentions a seed without having been turned in is listed on the seed's page
under "Also on GitHub" (or Tangled, or knotless). Whoever's agent opened it can turn it in from
there.

## The CLI and MCP server

```sh
curl -fsSL https://rainshare.dev/rainshare.mjs -o ~/.rainshare.mjs
node ~/.rainshare.mjs doctor                     # what's set up here, and what will work
node ~/.rainshare.mjs login you.bsky.social      # with an app password
node ~/.rainshare.mjs board                      # your circle, best first for you
node ~/.rainshare.mjs board --from mutuals       # only people you follow who follow you back (or following, followers, vouched)
node ~/.rainshare.mjs check <link>               # where it stands (no sign-in needed)
node ~/.rainshare.mjs run <link>                 # check, take, clone, start your agent, turn it in
node ~/.rainshare.mjs turn-in <link> --url <pull request>
node ~/.rainshare.mjs open-pr <link> --branch <b>   # Tangled and knotless: open the pull request, and turn it in
node ~/.rainshare.mjs done <link>                # your own: the work landed (sprout works too)
claude mcp add rainshare -- node ~/.rainshare.mjs mcp
```

`take` and `run` look before they write. If someone else is on the seed, or a pull request is
already up, nothing is written and you're told why; `--anyway` goes ahead regardless. `run`
writes the brief to `.rainshare/SEED.md` (kept out of git), starts Claude Code (or
`--with codex`, or `--with cloud`), and when the agent exits it looks for the pull request and
offers to turn it in. `turn-in` writes a take first if you hadn't said you were on it.
`open-pr` is for Tangled and knotless, where opening a pull request is a write as you: given a
branch that's already pushed (and `--from` if it's on a fork), it opens the pull request and
turns it in. A branch that isn't there yet, or that brings nothing new, is refused before
anything is written.

The MCP tools are `rainshare_board`, `rainshare_show` (with the brief), `rainshare_check`,
`rainshare_take`, `rainshare_drop`, `rainshare_turn_in`, `rainshare_open_pr`, `rainshare_ask`,
`rainshare_close_out` (mark your own done, closed or open again), `rainshare_profile` and
`rainshare_whoami` (and `rainshare_set_forecast`, while forecasts are on). The server's instructions give an agent the
order: check, take, do the work, open the pull request with the seed's link in it, check again,
turn it in, and tell its user what's left. Without a sign-in the read-only tools still work, and
the agent is told to finish the work and hand its user the link instead.

(Until the domain is live, the file is at `https://rainshare.vercel.app/rainshare.mjs`: the
site's Agents page and the briefs print whichever address is current.)

Both sign in with an app password (saved to `~/.config/rainshare`, or from `RAINSHARE_HANDLE`
and `RAINSHARE_APP_PASSWORD`), and reach public seeds only for now: private ones are taken on
in the app.

## Bluesky, Tangled, knotless and GitHub

- **Bluesky**: your handle signs you in (OAuth with your own server), your follows make your
  circle, lists and blocks are respected, and "Share on Bluesky" and "Thank them on Bluesky"
  open the composer with a link. Who follows whom, and who you follow that follows someone,
  show beside people.
- **Tangled**: pick an open issue from your own Tangled repos, or paste any tangled.org link.
  It's read through Tangled's public API (`api.tangled.org`), with the `org.tangled.*` methods
  that replaced `sh.tangled.*` when Tangled relaunched on 30 October 2026. An issue and a pull
  request are now the same kind of record, `org.tangled.track.ticket`, kept in the repo's own
  account, and a pull request is one that names a target branch. From it Rainshare reads
  whether the issue is still open and whether a delivered pull request is open, merged or
  closed. Pull requests that mention the issue or the seed's link are found through the repo's
  50 newest and through Tangled's search. Repos clone over https from their tangled.org
  address. Tangled has no command for opening a pull request yet, so the brief has the agent
  push a branch and Rainshare opens the pull request as its user (see "Posting to knotless and
  Tangled"); Tangled's launch post says a CLI and agent skills are on the way, and the brief
  should change when they arrive. Vouches from your Tangled circle, and who follows whom on
  Tangled, show beside people.
- **knotless**: pick an open issue from your own knotless repos, or paste any knotless.dev
  link. knotless keeps a repo, its issues and its pulls as records in people's own accounts,
  and its public API (`knotless.dev/xrpc`) says whether an issue is open, whether a pull is
  open, merged or closed, and which pulls name an issue; pulls that carry the seed's link are
  searched for. Repos clone over plain https. A pull can be turned in by its page or by the
  `at://` address `knotless pull create` prints, and Rainshare works out the page from it.
  The brief gives the agent knotless's own commands (and the MCP tools of the same names), and
  asks for "Fixes" and the issue's address in the pull, which closes the issue when it merges.
  A branch that's pushed can also be opened as a pull from Rainshare.
- **GitHub**: paste an issue or repo link. The issue's title and body start you off, and its
  state is read back, along with each delivered pull request's (open, merged or closed). The
  repo's 50 most recently updated pull requests are also searched for the issue's number or
  the seed's link, to find work that wasn't turned in. All of it is GitHub's public API.

## FAQ

### Is this allowed by my AI plan?

We think so, the way Rainshare works today. Your plan's terms are between you and its
provider, though, so read them too. As of November 2026, what the big plans
rule out is sharing your account and reselling access to it (Anthropic's
[Consumer Terms](https://www.anthropic.com/legal/consumer-terms) and
[Claude Code's](https://code.claude.com/docs/en/legal-and-compliance), and OpenAI's
[Terms of Use](https://openai.com/policies/row-terms-of-use/)). Rainshare does neither:

- **It's your agent, on your account.** You run Claude Code, Codex or whatever you use, signed
  in as you, on your own machine or in your own cloud session. Nobody else gets your login.
  Rainshare never sees your AI sign-in: it signs in only to your atproto account, and the CLI
  starts your own `claude` or `codex` just as it's installed.
- **What you give is the work, not access.** The person who asked gets a pull request (or, for an idea,
  a repo), the way you might send one to any open-source project. Anthropic's and OpenAI's
  terms both assign what you make with them to you.
- **Nobody's paid.** There are no credits, tips or ledger, so nothing is being resold.
- **You're there for it.** You pick each one and start your agent yourself.

That's also why Rainshare doesn't run agents on its own servers, hold anyone's AI sign-in, pay
people for help, or work through asks unattended: each of them would cross that line. And your plan's usage policy covers everything your agent does, whoever asked for it, so
take on only what you'd be comfortable asking it to do for yourself.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `src/main.js` | The site: the page, its routes, and who's signed in |
| `src/landing/` | The signed-out landing: `landing.js` (which scene, and when it runs), `garden.js` (the cloud to drag, the plots' labels and the line under them, and where in the backdrop the garden goes), `garden-scene.js` (the garden itself), `fit.js` (how it's fitted into its place), `plots.js` (what's planted), `puffs.js` and `sky.js` (how a cloud and the sky are drawn), `landing.css`, and `cycle/` (the water cycle it replaced) |
| `src/plants/` | The four 3D plants: `models.js` (how each stage of each kind is grown), `live.js` (one renderer drawing them all, turning), `sheet.html` (a page to look at every kind on) |
| `scripts/render-plants.mjs`, `public/plants/` | `npm run plants`, and the pictures it takes of every stage of every kind |
| `src/logo/` | The logo in 3D: `drop.js` (the drop and the spark, how they're lit and how they move), `live.js` (the moving one in the bar), `sheet.html` (a page to look at it on) |
| `scripts/render-logo.mjs`, `public/*.png` | `npm run logo`, and the pictures it takes: the tab's icon (`favicon.png`, `favicon-32.png`), the home-screen icon (`apple-touch-icon.png`), and what the bar shows until the moving logo starts (`logo.png`, `logo-night.png`) |
| `src/theme.css`, `src/fonts.css` | The site's look: colours, the bar, light and dark, and its typeface |
| `src/signin.js`, `src/signin.css` | The sign-in dialog: accounts offered as a handle is typed, "Is this you?", what's asked for with a tick box each, and the button that names the site you're sent to |
| `src/oauth.js`, `src/scope.js` | Signing in, and the OAuth scope and client metadata: what's asked for up front, the steps down if a server refuses, and finding where an account signs in before anyone is sent there |
| `src/spaces.js` | Private seeds: reading and writing a group's space, and the group host's methods |
| `api/oauth-client-metadata.js` | The OAuth client document, served at `/oauth-client-metadata.json` |
| `api/page.js`, `api/og.js`, `api/_og/` | Link previews: the page with its tags set for the address asked for, and its picture. `describe.js` is what each says, `card.js` how the picture is laid out; with the fonts and the plants' JPEG copies they're drawn with |
| `scripts/og-plants.mjs` | `npm run plants:og`: the plant pictures again as JPEGs, for the preview cards |
| `scripts/og-home.mjs`, `src/landing/og.html` | `npm run og`: the home page's own preview picture (`public/og.jpg`), its headline beside the landing's garden |
| `lexicons/dev/rainshare/`, `lexicons/*.mjs` | The four record types and their shared defs. `publish.mjs` publishes them under rainshare.dev from every production build, and `compat.mjs` says whether a change to one would break what's published |
| `core/ns.js` | Collection names, and the words people see for every known value |
| `core/records.js` | Building each record from what people type, within the lexicons' limits |
| `core/net.js` | Public reads: identity, records from each PDS, the relay, the Bluesky graph, and accounts to offer as a handle is typed |
| `core/subjects.js` | Tangled, knotless and GitHub: parsing links, clone URLs, issue titles and states, pull request states, pull requests that mention a seed |
| `core/circle.js` | Audiences and closeness |
| `core/rank.js` | A helper's board in order, and how well each seed fits them, with reasons |
| `core/words.js` | A seed in plain lines: where, the job, the models and how they fit yours, who's on it; and someone's AI plan in one line |
| `core/status.js` | Where a seed stands: who's on it, what's been turned in, what the forge says, and what each side should do next |
| `core/garden.js` | What someone has helped with: what got done with their help, worked out from the records |
| `core/forges.js` | The right page on each forge: where to start a repo, fork one, or see its pull requests |
| `core/forgewrite.js` | Posting to knotless and Tangled as you: opening an issue, leaving a comment, opening a pull request from a pushed branch |
| `core/vouch.js` | Tangled's vouch network: your circle's word on a person, read from public records, and vouching for someone |
| `core/ties.js` | How you know someone: who follows whom on Bluesky and Tangled, who you follow that follows them, said in plain sentences, and narrowing the board by who asked |
| `core/brief.js` | The agent brief, the link an agent hands back, and the one-paste launch commands |
| `core/markdown.js` | A small, safe Markdown renderer for specs |
| `core/route.js` | Addresses: which ones the app has, and what a mistyped or cut-short one was probably meant to be |
| `core/source.js` | Rainshare over atproto: the board, a seed, profiles and every write, public and in group spaces |
| `core/demo.js` | The example circle, answering the same calls from fixtures and your browser's storage |
| `ui/rainshare.js`, `ui/rainshare.css` | The screens: the board (a list with the details beside it), a seed, your profile, someone's profile, agents |
| `ui/post.js` | Asking for rain on an idea or a project: two steps (three with "Who's it for?"), a live preview and a confirmation |
| `ui/skeleton.js` | What shows while something loads: placeholders laid out like the board, an ask's page, a person's page, your profile and a garden |
| `ui/bits.js` | Small shared pieces: escaping, times, icons, faces, and the glyphs for a forecast's sky and a seed's life |
| `cli/rainshare.mjs` | The CLI and MCP server |
| `test/` | `npm test`: the core, the data source against a fake network, the MCP server, posting to the forges, vouching and follows against made-up ones, what other people's records can't do (`security.test.mjs`), and the plants: which kind each grows, that every picture is there, and that every kind fits its frame (`plants.test.mjs`, the models only once three.js is installed); the logo: that it stays inside its square as it moves, that its loop closes, and that every picture of it is the one the drawing makes now (`logo.test.mjs`); wrong addresses (`route.test.mjs`); link previews against made-up hosts (`og.test.mjs`); and the lexicons: well formed, and what counts as breaking a published one (`lexicons.test.mjs`) |

## Security

Almost everything Rainshare shows was written by someone else: seeds, takes, deliveries and
profiles come from other people's repos, through servers they may run themselves. So nothing
read from the network is trusted, and each thing is checked where it's used:

- **Records** (`core/net.js`). A record's address is rebuilt from the account, collection and
  key that were asked for, never copied from a server's answer, and one that claims to be
  somewhere else is dropped. Record keys must be what atproto allows, DIDs must look like DIDs,
  a handle must be a domain name, a PDS must be on https, and a `did:web` is a bare host.
- **Pages** (`ui/`). Every value goes through `esc` before it reaches the page, and a spec's
  Markdown is escaped first and then turned back on for a few safe constructs
  (`core/markdown.js`). Links are http(s) only. `vercel.json` sets a Content Security Policy
  with no inline scripts, so a slip in escaping still can't run code.
- **Commands** (`core/brief.js`, `core/subjects.js`). A repo is cloned only from an address that is
  a host and a plain path; anything bound for a shell is single-quoted, and the folder a seed's
  work goes in is made from letters and digits only.
- **Terminals and agents.** Control characters (and the invisible marks that reorder text) are
  taken out of the brief and of everything the CLI and MCP server print, so a spec can't end a
  terminal's bracketed paste and type commands, or rewrite the screen or the clipboard.
- **Servers of ours** (`api/`). The functions behind link previews act on whatever an address
  says, so they ask only two fixed hosts and never follow the network to a server someone
  names. What comes back is cleaned of control characters, cut to length, and escaped into
  the page's tags; a record a cache hands back is believed only if it's the one asked for.
- **Addresses** (`core/route.js`). A mistyped address is corrected only to a word from a
  fixed list or to parts that are a DID, a handle or a record key.
- **Blocks.** Takes and deliveries from people you block on Bluesky are left out along with their
  seeds, so nobody you've blocked can make something look taken.

Two things are by design and worth knowing. A seed's spec is a request from a stranger, and the
brief tells the agent so; a repo you clone for someone can still carry its own agent settings
(a `CLAUDE.md`, hooks, an `.mcp.json`), so look before you trust a folder you haven't seen. And
an audience only decides who Rainshare shows a seed to: anyone can read a public one.

## Running it

```sh
npm install
npm run dev         # the site, at http://127.0.0.1:5173
npm test            # node --test, no extra dependencies
npm run build       # the site in dist/, with the CLI bundled at dist/rainshare.mjs
npm run build:cli   # just the CLI, at dist-cli/rainshare.mjs
npm run lexicons:check   # the lexicons against what's published, writing nothing
```

The app says it's an early alpha in a badge beside the logo, once on the signed-in board,
and where you post an ask; the CLI's help and version and the MCP server's title say so too.
`STAGE` in `core/ns.js` drives the board note, the ask screen and the CLI and MCP text.
`index.html` writes the word out by hand in two places (the badge and the badge's title), so
change those with it.

Sign-in in dev uses atproto's loopback client, so open the dev server at `http://127.0.0.1:<port>`
rather than `localhost`.

The typeface is bundled with the site (`src/fonts.css`), so the page makes no requests to a
font host. Only its Latin ranges are included; names in other scripts fall back to the
reader's own fonts.

## Deploying rainshare.dev

It's a Vercel project on this repo (`vercel.json`):

1. Import the repo with the framework preset Vite. The build command is `npm run build`.
2. Add the domain `rainshare.dev`, and set `RAINSHARE_SITE=https://rainshare.dev` in the
   project's environment variables (for Production, and Preview if previews should name it
   too), then redeploy. That one setting is where Rainshare lives (`SITE` in `core/ns.js`):
   every link it writes starts there (an ask's page in a brief, the link an agent hands back
   to turn work in, the link in a Bluesky post, the CLI's install line, `og:url`). The build
   bakes it into the page, `index.html` and the CLI, and the functions read it as they run.
   Until it's set, the address is the deployment's own, `https://rainshare.vercel.app`, so
   nothing points at a domain that isn't there yet. Links written to the old address keep
   working after the move wherever Rainshare reads one (a pull request that mentions an ask
   is matched by its path, not its host), and Vercel can redirect the old host to the new.
   `/oauth-client-metadata.json` serves the OAuth client for whichever host the request came
   in on, so preview URLs can sign in too.
3. Let the build publish the lexicons. They belong to the brand account, rainshare.dev:
   - Give that account the handle `rainshare.dev` by DNS (a TXT record at
     `_atproto.rainshare.dev`). The file method won't work here, because the site answers every
     path itself.
   - Make it an app password, and set `RAINSHARE_LEXICON_APP_PASSWORD` to it in the project's
     environment variables, for Production only, as a sensitive variable. Until the handle is
     set up, `RAINSHARE_LEXICON_ACCOUNT` can name the account by its current handle or DID.
   - Redeploy, and add the `_lexicon.rainshare.dev` TXT record the build log prints
     (`did=` the account's DID), which is how anyone finds the schemas from their names.

   From then on, every production build runs `lexicons/publish.mjs --deploy` after the site is
   built (`buildCommand` in `vercel.json`). It writes only the schemas that changed, each as a
   `com.atproto.lexicon.schema` record keyed by its NSID, and never deletes one. Preview builds
   only compare with what's published, and need no password.

   A change that would break records already written under a published schema stops the build,
   preview or production, and says what it was (`lexicons/compat.mjs`, following atproto's
   rules for changing a lexicon): a field removed or renamed, a type or a limit changed, a field
   made required or no longer required, an option taken out of a union. New optional fields,
   new defs, new options in an open union, descriptions and knownValues may change freely.
   Anything bigger needs a new NSID, or, while nobody has written records under the published
   schema, a single deploy with `RAINSHARE_LEXICON_ALLOW_BREAKING=1`. A production build that
   can't sign in or write stops too, so the site never runs ahead of its published schemas;
   redeploying tries again. `npm run lexicons:check` does a preview build's check from here,
   and `npm run lexicons` publishes by hand, with the same variables.

**Link previews.** The app is drawn in the browser and crawlers don't run scripts, so a
link to an ask would show the home page's card. Two functions fix that. `api/page.js` serves
the site's one page with the tags in its head set for the address asked for: `vercel.json`
sends an ask's page, a person's page, `/agents` and the example circle through it, and the
body isn't touched, so the app starts as it does from the plain file. `api/og.js` draws that
page's picture, 1200 by 630, with `@vercel/og`: the site's sky and wordmark, an ask's title,
what it is, its own plant and who's asking (with a "Done" mark once it is); a person's
picture, name and bio; a card each for `/agents` and the example. The home page keeps
`public/og.jpg`: its headline beside the landing's garden, taken again with `npm run og`
whenever the words or the scene change. The words and the picture come from one place (`api/_og/describe.js`), which
asks only two fixed hosts, Slingshot for the records and Bluesky's AppView for names and
pictures, within 2.5 seconds: never the servers an address points at. Anything missing,
invalid or slow gets the home page's card, and an ask that's for some people only says
nothing in its preview. The renderer can't read WebP, so every plant picture has a small JPEG
copy on white (`api/_og/plants`, made by `npm run plants`, or `npm run plants:og` alone), and
the logo on a card is a copy of the header's picture of it (`npm run logo` makes both).
`@vercel/og` is pinned to 0.11.1: 1.0.3 doesn't load in Node as an ES module.

## What's been checked, and what hasn't

Checked: the core and the data source pass their tests, including every audience, blocks, and
writes against a fake network; the MCP server's handshake and tools; the production build and
its bundled CLI. The records the app builds (`core/records.js`: seeds for every audience,
profiles, takes and deliveries) validate against the lexicons with `@atproto/lexicon`. That
was a one-off check and isn't part of `npm test` yet. In a headless browser: the
landing in light and dark from 360 to 1680 pixels wide with no sideways scrolling, and none
appearing while the scene runs or with the cloud dragged to either end (at 1280, 600 and 390
pixels, with motion on, past the friend's cloud drifting off); sending
the cloud to a plot by its label, by tapping the plot, by dragging the cloud (with a mouse and
with a finger) and from the keyboard; all three plots through to "Three done", and
starting again; the reset; Escape; pause, reduced motion, the fallback without WebGL; the
water cycle at `?scene=cycle`, drawn exactly as it was before it was set aside; and the example circle,
including sending an agent, turning a pull request in, the warning when someone is already on
a seed, and marking your own seed sprouted after a merge. Asking for rain in three steps (an
idea and a project, "More options" staying open across redraws, everyone by default, the
coming-soon group row), the folded profile and the folded send-your-agent panel were checked
in the example circle at desktop and phone widths. Every screen was checked again at 1280 and 390
pixels wide in light and dark, with the Content Security Policy from `vercel.json` applied: no
sideways scrolling, nothing past the edge of the phone sheet, and nothing blocked by the policy
(the landing's scene, the turning plants and the sign-in code all load under it).

The garden as the page's backdrop was checked on 12 November 2026, in headless Chromium on a
software renderer: from 360 to 2200 pixels wide, in light and dark, with no sideways
scrolling and the backdrop the window's whole width; the garden sinking as the page scrolls
and stopping short of the line under it, and not sinking at all with reduced motion; on a
desktop and on a phone with a finger, sending the cloud by a label and by a plot in the
canvas (and on the desktop by dragging it), all three plots through to "Three done",
and starting again, on the phone with the garden part of the way sunk; typing in the sign-in
over the backdrop; pause; going on to the example circle and back; the fallback without
WebGL and the water cycle at `?scene=cycle`, each in its box beside the pitch as before; and
the production build under the Content Security Policy at 1280 and 390 pixels wide, with
nothing blocked.

Not yet checked:

- The backdrop on a real graphics card, on a real phone, or in Safari or Firefox: how
  smoothly it runs now that it fills the window, and whether the frosted panes and the fade
  at its foot look as they do in Chromium. On the software renderer, which does all of it on
  the processor, it ran at a little over half the frames a second the scene did in its box
  (3.8 against 6.5 on a laptop-sized window, 4.3 against 6.8 on a phone-sized one).

- Signing in with a real account, past the point where a password is typed, and writing to a
  real PDS. Checked on 12 November 2026, from the dev server and from the deployment at
  rainshare.vercel.app: typing a handle resolves it, bsky.social takes Rainshare's client
  document and the whole list of permissions (`atproto`, `repo:dev.rainshare.*` and what
  posting to knotless and Tangled needs) without refusing any, and shows its sign-in page; a
  handle that doesn't exist says so. Private seeds in a real group are off until the spaces
  alpha settles; they depend on opensocial.fyi accepting a `dev.rainshare.board` space.
- Signed out, against the live network (12 November 2026): the board under the landing shows
  the asks the relay knows of, with names and pictures from Bluesky; an ask's page opens by its
  DID and by its handle; a person's page opens; and the deployment runs under its Content
  Security Policy with nothing blocked. The CLI's `board`, `check` and `brief` were run the same
  way, signed out. Not checked: a board with many asks on it, and what a slow relay feels like
  (each relay is given 15 seconds before the next is tried).
- GitHub's side of `look` (`core/status.js`) has only been run against made-up answers. Two
  things to watch when it meets GitHub: a browser that isn't signed in may ask 60 things an
  hour, after which the forge's side is left unknown rather than guessed; and matching by
  "#N" finds any pull request whose text mentions the issue, including ones that only refer
  to it in passing.
- Tangled: the lookups were run against `api.tangled.org` on 11 November 2026, read-only, on
  Tangled's own `core` repo (repos, open issues, an open and a closed issue, an open and a
  merged pull request, and the pull request that closes an issue). Not checked: an agent
  pushing to a Tangled fork and the link that push prints, picking an issue from your own
  repos while signed in, cloning (tangled.org answers with a redirect to the repo's knot,
  which was seen but not followed), and repos on knots other than Tangled's own.
- knotless: the lookups were run against `knotless.dev` on 11 November 2026, read-only, on a
  public repo there (a person's repos, a repo's open issues, an open and a closed issue, a
  merged pull by its page and by its record, and the pull that names an issue). Its API
  allows requests from other sites, and a repo's git address answered. Not checked: an agent
  forking, pushing and opening a pull with the knotless CLI or MCP server (the commands in
  the brief are from knotless's docs, not from running them), private repos, and knotless
  servers other than knotless.dev, which Rainshare doesn't recognise as knotless yet.
- Posting to knotless and Tangled has never been done for real: it needs a real account, and
  Rainshare shouldn't post to someone's repo to test itself. What was checked: the records
  it would write (issues, comments, pulls, the patch call) validate against both forges' own
  published definitions; the steps for Tangled are the ones in Tangled's own web app's
  source; Tangled's knot answers a browser on another site and says it takes writes from
  apps; the lookups a pull request needs (a repo's branches, where two branches part, a
  repo's forks and template) were run read-only against `api.tangled.org` and `knotless.dev`
  on 12 November 2026; and the whole thing runs against a made-up network in
  `test/forgewrite.test.mjs`. Not checked: a real server granting the permissions as they're
  written, or how its consent screen words them; a real post landing; how either forge shows
  it; whether a knot takes a pull request from an account that isn't a collaborator on the
  repo (the repo's own setting decides); whether knotless indexes a pull written without its
  own CLI; and `open-pr` with an app password, which leans on a server giving an app password
  a token for these calls.
- Sign-in asking for everything up front: bsky.social accepted the whole list when the sign-in
  was started (see above). Not checked: how its consent screen words them, servers other than
  Bluesky's, and the step down to a plain sign-in when a server refuses the longer list, which
  is still the thing to watch on the first real sign-in elsewhere.
- Tangled's vouches: the record's shape was checked against real ones on the network, and
  reading a circle and writing a vouch run against a made-up network in `test/vouch.test.mjs`
  and in the example circle. Not checked: reading a real circle from real servers (they
  aren't reachable from where this was built), whether Rainshare's circle matches the marks
  Tangled itself shows in every case (Tangled's own method for this only answers to Tangled),
  and how Tangled displays a vouch whose evidence is a Rainshare delivery.
- How you know someone: reading Tangled follows (yours, and whether someone follows you),
  the board with ties, and who you follow that follows someone were run read-only against
  real servers on 12 November 2026, from public accounts. Who you follow that follows someone
  took about a second and a half for an account following 720 people. The board's "From", the
  ties on cards, in the picked card, on an ask's page, beside helpers and on profiles were
  checked in the example circle at 1280 and 390 pixels wide, light and dark. Not checked:
  with a real signed-in account, and how quickly the board fills for someone whose board has
  many askers (whether each follows you on Tangled is one read per asker, made while their
  profiles are read; a server that hasn't answered in 6 seconds is left as unknown).
- Names and bios from Bluesky, "About them" set aside and Z.ai's plan (12 November 2026): in
  the example circle at 1280 and 390 pixels wide, light and dark. Checked: a name of your own
  saved and shown on your page, and cleared again; a Bluesky bio shown for someone who wrote none
  on Rainshare, and a Rainshare one winning over it; the profile form without "About your
  situation" or its fold; Z.ai matching GLM. In tests: a Rainshare name over the Bluesky one on
  the board, for helpers and on profiles. Not checked: Bluesky bios from the live AppView.
- The simpler profile and asking (12 November 2026): in the example circle at 1280 and 390
  pixels wide, light and dark. Checked: asking in two steps for an idea, with the Bluesky post
  following the title as it's typed, ending open to everyone; picking AI plans (a paid one
  clears "No AI plan" and the other way round) and saving them, with the set-aside forecast,
  priorities and budget still in the saved profile; "AI plan" first on profiles, "Their AI
  plan" in the picked card, and (then) your plan in the board's header; nothing set aside showing;
  "Models" as a family and a level (picked when asking, shown on asks, matched against plans
  and setups, and in the brief), and every switch turned back on (the tests pass both ways).
  Not done yet: publishing the profile lexicon with `plans` in it, which the first production
  build with the lexicon password does (see "Deploying rainshare.dev").
- Ideas: asking for rain on one, running with one and turning it in were checked in the example circle.
  The pages Rainshare links to on Tangled exist (they ask you to sign in). GitHub's new-repo
  page taking a name and description from the link is from memory, not checked from here; if
  it doesn't, the page still opens, just empty.
- The plants: the four models, their pictures, the turning model on a page and in the preview
  when asking, and the garden were checked in the example circle, on a software renderer and at
  phone width. Not checked: how the turning model runs on a real GPU or an old phone, and a
  garden worked out from real records on the network (it needs a real asker to have marked
  a real delivery).
- The CLI's `run` end to end with a real agent: starting it, finding the pull request with
  `gh` afterwards, and turning it in.
- Before launch (12 November 2026), in a headless browser at 1280 and 390 pixels wide: a
  pasted GitHub issue starting the next step off with its title and details, whether Next is
  pressed after it's found or before; each page of the example circle keeping its own title
  while the real board loads behind it; "Sign in to take it on" under the landing leading to
  the landing's own form, with the phone sheet closed; and the signed-out "Ask for rain" and
  profile screens, each with one sign-in button. The CLI's hints name the file as it was
  started (`node ~/.rainshare.mjs …` where the install line puts it).
- Later that day (12 November 2026). Checked in a headless browser, with the network held
  back so the waiting state could be seen: the placeholders for the board, an ask's page and
  a person's page at 1280 and 390 pixels wide, light and dark, the swap to the real thing
  (and that a redraw a moment later doesn't cut it short), and sixteen wrong addresses, each
  ending where it should or saying nothing is there. Link previews: both functions run on a
  Vercel preview deployment, where an ask's page came back with its own title, description
  and picture address, and the pictures for an ask and for `/agents` came back the same size
  to the byte as they render locally (so the fonts, the plant and the asker's picture all
  reached the function). One ask's page was read from the live network by way of
  Constellation. Not checked: how Bluesky's or anyone's card service shows a preview (branch
  deployments sit behind Vercel's sign-in, so that waits for production); a take or delivery
  found through Constellation, since none exists on the network yet (that path has run only
  against the made-up network in `test/source.test.mjs`); `RAINSHARE_SITE` set on Vercel;
  and how the placeholders' light and the swap feel on a real phone.
- Signing in, a step at a time (12 November 2026). Checked in a headless browser against the
  live network, 1280 pixels wide and 390, each in light and in dark, from the dev server and
  from the built site under the Content Security Policy in `vercel.json` (nothing blocked):
  accounts offered as a handle is typed, on the landing and in the dialog, and picked with
  the arrow keys and Enter, with a pointer, and with a tap; Escape putting the list away
  before it closes the dialog; a word that isn't a handle, and a handle nobody has, each
  saying so; "Is this you?" naming pds.atpota.to for an account on its own server and
  bsky.social for one on Bluesky's; Tangled unticked being left out of what bsky.social was
  asked for, and staying unticked through "Not you?" and the next time; the button leading to
  bsky.social's own sign-in page with the handle filled in; a refusal giving the button back
  with a line saying so; the dialog from the bar, the board and an ask's page, coming back to
  the page it was opened on; closing it with its cross, Escape, and a click outside; and
  "Connect Tangled" as the second step alone. "Sign in to take it on" under the landing now
  opens the dialog, where it used to lead to the landing's form. Not checked: anything past
  the point where a password is typed (so how a server's own page words the list beside the
  dialog's, and coming back signed in with a forge left out); servers other than Bluesky's
  and pds.atpota.to; how a screen reader reads the list of accounts; and a real phone's
  keyboard over the dialog.
- Publishing the lexicons from the build (13 November 2026). Checked against a made-up network
  (the AppView, PLC and one PDS): the first publish writing all five; a build with nothing
  changed writing nothing; a safe change written alone; a breaking change stopping a preview
  build and a production one, and going through with `RAINSHARE_LEXICON_ALLOW_BREAKING=1`; a
  wrong password stopping a production build; and a preview build, or one with no password,
  only checking. Against the live network: a Bluesky PDS answering `createSession` itself, and
  the DNS lookup for `_lexicon.rainshare.dev`. What counts as breaking is in
  `test/lexicons.test.mjs`. Not checked: a real publish, which waits for the brand account's
  app password on Vercel, and the schemas resolving by their names once the DNS record is in.
- How smoothly the scene runs on real phones and older laptops. It has only been run on a
  software renderer so far, which says it draws correctly and nothing about frame rate.
