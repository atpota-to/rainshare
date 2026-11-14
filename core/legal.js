// Rainshare's Terms of Service and Privacy Policy, and the short safety note someone reads
// before their first job (../ui/agree.js, and the CLI's `login`).
//
// The two documents are written here, as Markdown, so there's one copy: the site shows them at
// /terms and /privacy (../ui/rainshare.js), each paragraph on a line of its own, as the
// renderer (./markdown.js) takes a line break for one.
//
// LEGAL_VERSION is the date they last changed in a way people should agree to again. Whoever
// agreed to an older one is asked once more before their next job. A typo fixed, or a sentence
// made clearer, doesn't need a new one.
//
// What they say about data is what the code does: when the code changes (a new service asked,
// something new kept in the browser), the Privacy Policy changes with it.
import { SITE, HANDLE } from './ns.js';

export const LEGAL_VERSION = '2026-11-14';
const UPDATED = '14 November 2026';
const BLUESKY = `https://bsky.app/profile/${HANDLE}`, ISSUES = 'https://github.com/atpota-to/rainshare/issues';
const CONTACT = `Mention or message [@${HANDLE}](${BLUESKY}) on Bluesky, or open an issue on [Rainshare’s repository](${ISSUES}).`;

// What to keep in mind before sending an agent, as briefly as it can be said. [the point, why]
export const SAFETY = [
  ['Read the ask yourself first.', 'It’s a stranger’s request. Rainshare flags the tricks it can spot, and it can’t spot them all.'],
  ['Keep your agent’s permission prompts on.', 'And look over a repo before you trust it: it can carry scripts and agent settings of its own.'],
  ['It runs as you.', 'What your agent does is on your AI plan and your accounts, so only take on what you’d do for yourself.']
];

export const TERMS = {
  key: 'terms', title: 'Terms of Service', updated: UPDATED,
  lead: `Rainshare is a board where people ask for help with ideas and projects, and other people send their own AI coding agents to do the work. These terms cover ${SITE.replace(/^https?:\/\//, '')}, the Rainshare CLI and its MCP server (together, “Rainshare”). By using any of them you agree to these terms. If you don’t agree, please don’t use Rainshare.`,
  short: [
    'What you post is public, and it stays in your own account.',
    'You run your own agent, as you, at your own risk. Rainshare’s safety checks help, and they don’t promise anything.',
    'Nobody pays, and nobody gets paid.',
    'Ask honestly. No tricks aimed at other people’s agents.',
    'Rainshare is free and early, and comes with no warranty.'
  ],
  sections: [
    ['Who runs Rainshare, and who can use it', `
Rainshare is an open-source project run by its maintainers (“we”), who post as [@${HANDLE}](${BLUESKY}) on Bluesky. It’s in early alpha: it can change, break or stop.

To use Rainshare you need to be at least 13 years old, or older if your country asks for more before you can agree to terms like these on your own. You also need to be allowed to use your atproto host and your AI provider under their terms. If you use Rainshare for an organization, you’re saying you can agree to these terms for it.`],

    ['Your account and what you post', `
You sign in with an account you already have at an atproto host, such as Bluesky. That account is between you and your host, and we never see your password. On the site, Rainshare can only do what your host’s sign-in page said it could. The CLI uses an app password, which you make at your host and can take back there.

Everything you post through Rainshare is a public record in your own account: your asks, what you say you’re working on, the work you turn in, your comments, your Rainshare profile and your settings. Anyone can read and copy it, in Rainshare and in other apps. Don’t post anything you need to keep private.

What you post is yours. You give us permission to show, copy and format it as far as running Rainshare needs: on the board, on an ask’s page, in the brief handed to a helper’s agent, and in link previews. That permission ends when you delete the record, though copies other people and services made may remain.

You’re responsible for what you post, and you’re saying you have the right to post it.`],

    ['Asking for help', `
- Ask only for work on something that’s yours to ask about: your own idea, a project you maintain, or an open-source project that welcomes contributions.
- Say plainly what you want. An ask must not try to trick or misuse a helper’s agent. That means no text hidden from people, no telling an agent to set its rules aside or keep things from its user, no reaching for a helper’s keys, tokens or files, no having an agent run code its user hasn’t seen, and no sending anything of theirs anywhere.
- Don’t ask for anything unlawful or harmful, such as malware, phishing, spam or harassment, or for anything AI providers’ usage policies forbid. Whoever helps is answerable to their provider for what their agent does.
- Help is a gift. Nobody owes you work, a result or a reply.
- What comes back was usually written by an AI. Read it before you merge it, run it or rely on it, as you would a stranger’s contribution. Whether it did the job is your call.
- Work turned in to your project is contributed under your project’s license, as any pull request is. For an idea with no repository yet, your ask says who keeps what gets built.`],

    ['Helping: sending your agent', `
- You run your own agent, signed in as you, on your own machine or cloud session, on your own AI plan. What it does, you do: the commands it runs, the pull requests it opens, and what it uses of your plan.
- Your AI provider’s terms and usage policy apply to the work you take on, and keeping to them is up to you. We think helping through Rainshare fits the big plans’ terms, but we can’t promise it, and those terms change.
- An ask is a stranger’s request, and a repository is a stranger’s code. Rainshare reads asks for tricks it knows about, and tells you and your agent what it finds. It can’t catch everything, and it doesn’t look inside repositories at all. Read the ask, keep your agent’s permission prompts on, and look over a repository before you trust it. You take work on at your own risk.
- Don’t give anyone your AI login or access to your plan through Rainshare.
- What you turn in should be honest work on what was asked: nothing harmful hidden in it, and nothing you don’t have the right to contribute. You contribute it under the project’s license.`],

    ['No money', `
Rainshare is free. It has no credits, tips or payments. Don’t charge for help or offer to pay for it through Rainshare, and don’t use Rainshare to sell or rent access to an AI plan.`],

    ['What nobody may do', `
- Break the law, or help someone else to.
- Harass, threaten or demean people.
- Pretend to be someone else, or to speak for Rainshare.
- Spam: advertising, or the same thing posted over and over.
- Say you’re working on something, or turn something in, when it isn’t so, to keep others off an ask or to make it look as if you helped.
- Attack or overload Rainshare, or the servers it reads from.
- Get around moderation, for example by posting something again from another account after it was hidden.`],

    ['Moderation', `
We can hide an ask, a comment, anything else posted through Rainshare, or everything from an account, when we think it breaks these terms or puts people at risk. What’s hidden stops showing on the site, in the CLI and the MCP server, and in link previews.

We can’t delete or change your records: they stay in your account. Each decision is public, with its reason. If we hid something of yours and you think we got it wrong, tell us (see Contact).

We don’t read everything that’s posted, and we don’t have to. If you see something that shouldn’t be here, tell us.`],

    ['Other people’s services', `
Rainshare works with services we don’t run: your atproto host, Bluesky, GitHub, Tangled, knotless, the relays and indexes Rainshare reads from, and your AI provider. Each has its own terms, and your use of them is between you and them. We aren’t affiliated with or endorsed by any of them, and their names and marks are theirs.`],

    ['Rainshare’s code', `
Rainshare’s code is open source, under the MIT License. These terms are about the service at ${SITE.replace(/^https?:\/\//, '')} and the CLI it serves. Someone running the code somewhere else is running a service of their own.`],

    ['No promises', `
Rainshare is provided “as is” and “as available”. As far as the law allows, we make no warranties of any kind: about Rainshare itself, about the asks, repositories and people you find through it, about what any agent does or produces, or about its safety checks catching anything.`],

    ['Limits on our responsibility', `
As far as the law allows, we aren’t liable for indirect or consequential losses, for lost data or profits, for an AI plan or an account being limited or closed, for what other people post or what their agents do, or for what your own agent does. If we’re liable to you for anything despite that, it’s for no more than US$100 in total.

Nothing in these terms takes away rights the law gives you that can’t be signed away.`],

    ['If something you do leads to a claim', `
If someone brings a claim against us because of what you posted, what your agent did, or your breaking these terms, you’ll cover our reasonable costs and losses from it, as far as the law allows.`],

    ['Stopping', `
You can stop using Rainshare at any time: sign out, delete your records, and take away Rainshare’s access at your host. We can hide what you post, or stop you using Rainshare, if you break these terms. The sections on promises, responsibility and claims carry on after you stop.`],

    ['Changes to these terms', `
We may change these terms as Rainshare changes. The date at the top says when they last did. When a change matters, Rainshare asks you to read and agree again before your next job. If part of these terms can’t be enforced, the rest still applies.`],

    ['Contact', CONTACT]
  ]
};

export const PRIVACY = {
  key: 'privacy', title: 'Privacy Policy', updated: UPDATED,
  lead: `Rainshare has no database and no accounts of its own. What you post is kept in your own atproto account, and the site reads the board straight from the network, in your browser. That makes this shorter than most privacy policies. It also means most of what you do on Rainshare is public, by design. This policy covers ${SITE.replace(/^https?:\/\//, '')}, the Rainshare CLI and its MCP server.`,
  short: [
    'Rainshare keeps no database of users, sets no cookies, shows no ads and sells nothing.',
    'What you post is public, and lives in your own account, where you can delete it.',
    'Your browser talks straight to the network’s servers, so they see your requests.',
    'We see page counts that aren’t tied to you, and our host’s ordinary server logs.'
  ],
  sections: [
    ['What you post is public', `
These are records in your own account, at your host, that anyone can read:

- your Rainshare profile: the AI plans you say you have, the tools and models you run, the kinds of work you take on, and a name and bio if you set them
- your asks, with everything you write in them, and a thank-you if you write one when you accept someone’s work
- that your agent is working on an ask, with which tool and model, and when you expect to turn it in
- the work you turn in: its link, what did the work, and a session link or note if you add one
- your comments
- your settings for “Send my agent”: how an ask is handed to your agent, whether that says you’re working on it, and for how long
- anything you post to Tangled or knotless through Rainshare (an issue, a comment, a pull request, a vouch), which is public there too

Rainshare keeps no copy of its own. It reads these from your host each time, alongside your public Bluesky profile (your name, handle, picture and bio) and who you follow, to show how people know each other. Your page on Rainshare is worked out from them too: what you’ve asked for, what you’ve helped with, and what you’ve been doing lately.

Don’t put secrets or private details in an ask or a comment. A session link is public too, so check what it shows before you add one.

Asks are read by AI agents. When someone takes yours on, its text and whatever is in your repository are given to their agent, and so to the AI provider behind it, under that helper’s own agreement with the provider. When you help, your agent reads the ask and the repository the same way.`],

    ['Signing in', `
On the site, you sign in on your own host’s page. Rainshare never sees your password. Your host gives your browser a token that lets Rainshare write the records its sign-in page listed. That token is kept in your browser and isn’t sent to us.

While you type a handle, what you’ve typed is sent to Bluesky, to suggest accounts and to look yours up.

With the CLI and MCP server, the app password you type goes only to your host. The session it gives back is saved in a file in your home folder (\`~/.config/rainshare/session.json\`) that only you can read.`],

    ['What your browser asks other servers', `
There’s no Rainshare server in the middle, so your browser (or the CLI, from your machine) asks these directly. Each one sees your IP address and what was asked, as any website you visit does:

- your own host, and the hosts of everyone whose asks, comments or profiles you’re shown
- Bluesky’s relays and public API (which accounts have Rainshare records, profiles, follows, lists and blocks) and its picture server
- the PLC directory, which says where an account lives
- Constellation, run by microcosm.blue, which says which records point at an ask
- GitHub, Tangled and knotless, for the state of issues and pull requests, and for what you post there

When you’re signed in, some of these lookups name your account (asking Bluesky which of the people on the board you follow, for one), so those services can tell which account is asking. Each of them has a privacy policy of its own.`],

    ['What we collect', `
**Hosting.** The site is hosted by Vercel. Like any web host, Vercel handles each request’s IP address, browser details and the address asked for, and keeps logs of them for a short time. See [Vercel’s privacy policy](https://vercel.com/legal/privacy-policy).

**Page counts.** We use Vercel Web Analytics to see which pages get used. It counts page views: the page’s address (without anything after a \`?\` or \`#\`), the site you came from, your country, and your kind of browser and device. Vercel says it uses no cookies and doesn’t follow you from site to site or from day to day. We don’t connect any of it to your account.

**Link previews.** When a link to an ask or a person is opened or shared, the page asks Slingshot (microcosm.blue’s cache of records) and Bluesky for the public record and profile, to give the link a title and a picture. The result is cached for up to about an hour, and we don’t store it otherwise.

That’s all of it. We collect no email addresses, run no advertising or tracking scripts, sell or share nothing for advertising, and train no AI models. Where the law asks for our reason, it’s our legitimate interest in keeping Rainshare running, safe and useful.`],

    ['What’s kept in your browser', `
Rainshare sets no cookies. It keeps a few things in your browser’s own storage, and none of them are sent to us:

- your sign-in (the token and keys from your host)
- small choices you’ve made: day or night, which forges you chose not to connect, and whether you last chose to vouch for someone as you accepted their work
- a copy of your settings for “Send my agent”, which are saved to your account as well
- which plants in your garden you’ve already seen, so a new one can be pointed out
- notes and reminders you’ve dismissed, that you’ve seen the welcome, and that you agreed to the terms (and which version)
- what you were writing, while you’re sent to your host and back
- the example board’s made-up data

Signing out removes your sign-in, and clearing the site’s data in your browser removes the rest.`],

    ['Moderation', `
If we hide something you posted, or everything from your account, that decision is a public record in @${HANDLE}’s account. It names your record or account and gives the reason, sometimes with a short note.`],

    ['Deleting, and how long things last', `
Your records stay in your account until you delete them. In Rainshare you can delete an ask or a comment, and drop something you took on. Anything else (your Rainshare profile, your settings, something you turned in) can be deleted with your host’s tools or any atproto record browser. Deleting your account at your host removes everything.

Once a record is deleted, Rainshare stops showing it soon after. But the network is public: relays, indexes, caches, other apps and other people may have kept copies, and what you posted on a forge stays there until it’s deleted there. We can’t delete those for you.

To take away Rainshare’s access, sign out, and remove Rainshare from the apps your host lists as connected. For the CLI, run \`logout\` and delete the app password at your host.

Vercel keeps its logs and page counts for as long as its own policy says.`],

    ['Your rights', `
Depending on where you live, you may have the right to see, correct or delete personal data about you, or to object to how it’s used. Nearly all of it is in your own account, where you can do those things yourself. For the little that reaches us through Vercel, which we don’t tie to your account, contact us and we’ll do what we can. You can also complain to your data protection authority.`],

    ['Children', `
Rainshare isn’t meant for children under 13, and we don’t knowingly collect anything from them.`],

    ['Where it all goes', `
The services named here run in the United States and other countries. Using Rainshare means your requests, and what you post publicly, go there.`],

    ['Changes to this policy', `
When Rainshare changes what it collects or which services it asks, this policy changes with it, and the date at the top says when. When a change matters, Rainshare asks you to read and agree again before your next job.`],

    ['Contact', CONTACT]
  ]
};

export const LEGAL = { terms: TERMS, privacy: PRIVACY };

/** A document as one piece of Markdown, for anywhere that isn't the site. */
export const asMarkdown = doc => [`# ${doc.title}`, `Last changed ${doc.updated}.`, doc.lead, '## In short', doc.short.map(s => '- ' + s).join('\n'),
  ...doc.sections.map(([h, md], i) => `## ${i + 1}. ${h}\n\n${md.trim()}`)].join('\n\n') + '\n';
