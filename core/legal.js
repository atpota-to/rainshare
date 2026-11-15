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

export const LEGAL_VERSION = '2026-11-15';
const UPDATED = '15 November 2026';
const BLUESKY = `https://bsky.app/profile/${HANDLE}`;
// Who runs Rainshare: the company, named and reached as its other terms have it (Anisota's are
// the same company's, and the legal sections here follow theirs: who may use it, the cap on
// liability, claims, disputes, governing law, copyright notices, and privacy rights).
export const OPERATOR = {
  name: 'atpotato, LLC', kind: 'a Delaware limited liability company',
  address: '8595 Pelham Road, Suite 400 #747, Greenville, SC 29615, USA',
  email: 'contact@atpota.to'
};
const { name: LLC, kind: LLC_KIND, address: ADDRESS, email: EMAIL } = OPERATOR;
const WHERE = SITE.replace(/^https?:\/\//, '');
const CONTACT = `Rainshare is operated by ${LLC}.

- Email: ${EMAIL}
- Post: ${LLC}, ${ADDRESS}
- Bluesky: [@${HANDLE}](${BLUESKY})
- Bugs and ideas: Rainshare’s [feedback page](${SITE}/feedback)`;

// What to keep in mind before directing an agent, as briefly as it can be said. [the point, why]
export const SAFETY = [
  ['Read the ask yourself first.', 'It’s a stranger’s request. Rainshare flags the tricks it can spot, and it can’t spot them all.'],
  ['Keep your agent’s permission prompts on.', 'And look over a repo before you trust it: it can carry scripts and agent settings of its own.'],
  ['It runs as you.', 'What your agent does is on your AI plan and your accounts, so only take on what you’d do for yourself.']
];

// And before posting a first ask. [the point, why]
export const ASKING = [
  ['Say plainly what you want.', 'No tricks aimed at agents: nothing hidden, and nothing that reaches for a helper’s keys or files. Rainshare checks, and hides what breaks this.'],
  ['Keep secrets out of it.', 'An ask is a public record in your account, and so is everything else you post here.'],
  ['Read what comes back.', 'It was probably written by an AI. Look it over before you merge it or run it.']
];

// What someone says about their AI plan when they agree, in their own words: a second box on the
// site (../ui/agree.js), and part of what's typed in the CLI. Rainshare can't know what each
// provider allows, or what it'll decide, so checking is theirs, and so is the risk.
export const PROVIDER = 'It’s up to me to check that my AI provider’s terms allow how I use my plan here. If my provider decides they don’t, that’s my responsibility, not Rainshare’s.';

export const TERMS = {
  key: 'terms', title: 'Terms of Service', updated: UPDATED,
  lead: `Rainshare is a board where people ask for help with ideas and projects, and other people direct their own AI coding agents to do the work. It’s operated by ${LLC}, ${LLC_KIND} (“we”, “us”). These terms cover ${WHERE}, the Rainshare CLI and its MCP server (together, “Rainshare”). By using any of them you agree to these terms. Please read them: they limit what we’re responsible for, and they say that disputes are settled one at a time by arbitration, not in court, unless you opt out (see “Disputes”). If you don’t agree, please don’t use Rainshare.`,
  short: [
    'What you post is public, and it stays in your own account.',
    'You run your own agent, as you, at your own risk. Rainshare’s safety checks help, and they don’t promise anything.',
    'Rainshare never asks for or sees your AI login, and nobody else uses your plan or your account.',
    'Whether your AI provider’s terms allow how you use your plan here is yours to check. If your provider decides they don’t, that’s between you and them, not us.',
    'Nobody pays, and nobody gets paid.',
    'Ask honestly. No tricks aimed at other people’s agents.',
    'Rainshare is free and early, and comes with no warranty.',
    'Disputes are settled one at a time, by arbitration, unless you opt out within 30 days. Delaware law applies.'
  ],
  sections: [
    ['Who runs Rainshare, and who can use it', `
Rainshare is operated by **${LLC}**, ${LLC_KIND}. In these terms, “we”, “us” and “our” mean ${LLC}. We post as [@${HANDLE}](${BLUESKY}) on Bluesky. Rainshare is in early alpha: it can change, break or stop.

To use Rainshare:

- You must be at least 13 years old, or the minimum age of digital consent where you live if that’s higher.
- If you’re between 13 and 18 (or the age of majority where you live), you’re saying that your parent or guardian has read these terms and agreed to them for you.
- You need an atproto account in good standing, and you need to be allowed to use your atproto host and your AI provider under their terms. Many AI plans are for adults only.
- You aren’t located in, under the control of, or a national or resident of a country under a U.S. Government embargo or one it has designated as supporting terrorism, and you aren’t on any U.S. Government list of prohibited or restricted parties. You agree not to use Rainshare in a way that breaks export-control or economic-sanctions laws.
- If you use Rainshare for an organization, you’re saying you can agree to these terms for it.

By using Rainshare, you’re saying all of that is true of you.`],

    ['Your account and what you post', `
You sign in with an account you already have at an atproto host, such as Bluesky. That account is between you and your host, and we never see your password. On the site, Rainshare can only do what your host’s sign-in page said it could. The CLI uses an app password, which you make at your host and can take back there.

Everything you post through Rainshare is a public record in your own account: your asks, what you say you’re working on, the work you turn in, your comments, your Rainshare profile and your settings. Anyone can read and copy it, in Rainshare and in other apps. Don’t post anything you need to keep private.

Agreeing to these terms is written down too: in your settings, and in a note we keep ourselves. The [Privacy Policy](${SITE}/privacy) says what’s in it.

What you post is yours. You give us a limited, non-exclusive, worldwide, royalty-free license to read, cache, show, copy and format it as far as running Rainshare needs: on the board, on an ask’s page, in the brief handed to a helper’s agent, in link previews, and in the posts and direct messages Rainshare’s own account, @${HANDLE}, sends on Bluesky. That license ends when you delete the record, though copies other people and services made may remain.

You’re responsible for what you post, and you’re saying you have the right to post it.

If you send us ideas, suggestions or bug reports, on Rainshare’s feedback board or anywhere else, you give us a perpetual, irrevocable, worldwide, royalty-free license to use them for any purpose, with nothing owed to you. Don’t send us anything that isn’t yours to share.`],

    ['Asking for help', `
- Ask only for work on something that’s yours to ask about: your own idea, a project you maintain, or an open-source project that welcomes contributions.
- Say plainly what you want. An ask must not try to trick or misuse a helper’s agent. That means no text hidden from people, no telling an agent to set its rules aside or keep things from its user, no reaching for a helper’s keys, tokens or files, no having an agent run code its user hasn’t seen, and no sending anything of theirs anywhere.
- Don’t ask for anything unlawful or harmful, such as malware, phishing, spam or harassment, or for anything AI providers’ usage policies forbid. Whoever helps is answerable to their provider for what their agent does.
- Help is a gift. Nobody owes you work, a result or a reply.
- What comes back was usually written by an AI. Read it before you merge it, run it or rely on it, as you would a stranger’s contribution. Whether it did the job is your call.
- Work turned in to your project is contributed under your project’s license, as any pull request is. For an idea with no repository yet, your ask says who keeps what gets built.`],

    ['Helping: directing your agent', `
- You run your own agent, signed in as you, on your own machine or cloud session, on your own AI plan. What it does, you do: the commands it runs, the pull requests it opens, and what it uses of your plan.
- Your AI provider’s terms and usage policy apply to the work you take on. Reading them, knowing whether they allow how you use your plan through Rainshare, and keeping to them are up to you. We think helping through Rainshare fits the big plans’ terms, but that’s our reading, not a promise or legal advice, and those terms change.
- Your provider decides for itself what its terms allow. If it decides that how you used your plan with Rainshare breaks them, and limits, suspends or closes your account, or charges you for it, that’s between you and your provider. You accept that risk, and we aren’t responsible for it.
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

We don’t read everything that’s posted, and we don’t have to. If you see something that shouldn’t be here, tell us.

**Copyright.** If you believe something shown on Rainshare infringes your copyright, send a notice to our copyright agent: ${LLC}, ${ADDRESS}; email ${EMAIL}. Say which work is yours, what on Rainshare infringes it and where (its link or at:// address), and how to reach you. Include a statement that you believe in good faith the use isn’t authorized by the owner, its agent or the law; a statement, under penalty of perjury, that your notice is accurate and that you own the work or act for its owner; and your signature, written or typed. Where it’s right to, we’ll hide the material from Rainshare, and whoever posted it may send us a counter-notice. We hide everything from accounts that infringe repeatedly. Hiding something on Rainshare doesn’t take it off the network: it’s in its author’s account, so write to their host as well.`],

    ['Other people’s services', `
Rainshare works with services we don’t run: your atproto host, Bluesky, GitHub, Tangled, knotless, userinput.app (where feedback about Rainshare is posted), the relays and indexes Rainshare reads from, and your AI provider. Each has its own terms, and your use of them is between you and them. We aren’t affiliated with or endorsed by any of them, and their names and marks are theirs.`],

    ['Rainshare’s code', `
Rainshare’s code is open source, under the MIT License. These terms are about the service at ${WHERE} and the CLI it serves. Someone running the code somewhere else is running a service of their own.`],

    ['No promises', `
As far as the law allows, Rainshare is provided “as is” and “as available”, without warranties of any kind, whether express, implied or statutory. That includes the implied warranties of merchantability, fitness for a particular purpose, title and non-infringement.

We don’t promise that Rainshare will be uninterrupted, secure or free of errors; that the asks, repositories and people you find through it are safe, or what they say they are; that anything an agent does or produces is right, safe or fit to use; or that Rainshare’s safety checks will catch anything. You use Rainshare at your own risk.`],

    ['Limits on our responsibility', `
As far as the law allows:

- We aren’t liable for any indirect, incidental, special, consequential, punitive or exemplary damages. That includes lost data, profits or opportunities; an AI plan or an account being limited, suspended or closed; what other people post or what their agents do; what your own agent does; and anything done by services we don’t run.
- Our total liability for everything arising out of these terms or Rainshare is no more than the greater of what you paid us in the twelve months before the claim, or fifty US dollars (US$50). Rainshare is free, so that is US$50.

These limits apply whatever a claim is based on (contract, negligence or anything else), and even if we were told the loss was possible. Nothing in these terms takes away rights the law gives you that can’t be signed away.`],

    ['If something you do leads to a claim', `
You agree to defend, indemnify and hold harmless ${LLC} and the people who build, contribute to and run Rainshare from any claims, losses, liabilities and costs (reasonable legal fees included) that come from: your use of Rainshare; what you post; what your agent does; your breaking these terms or the law; or your infringing someone else’s rights, your host’s and your AI provider’s terms included. This carries on after you stop using Rainshare.`],

    ['Disputes', `
**Talk to us first.** Before starting any formal legal action, you agree to write to us at ${EMAIL} and try to settle it informally for at least thirty (30) days. Most things can be sorted out that way.

**Arbitration.** If that doesn’t settle it, you and we agree that any dispute, claim or controversy arising out of or relating to these terms or Rainshare will be resolved only by binding individual arbitration, and not in court. Two things are left out of that: either of us may ask a court for an injunction or other equitable relief over intellectual property or unauthorized access, and either of us may bring an individual claim in small-claims court if it qualifies. The Federal Arbitration Act governs this agreement to arbitrate. The American Arbitration Association (AAA) will run the arbitration under its Consumer Arbitration Rules as they then stand, or another administrator will if we both agree to one. We’ll pay the filing, administration and arbitrator fees those rules require us to bear for consumer claims. It may be held by phone or video, or in the county where you live, and the arbitrator’s decision is final and binding.

**You can opt out.** You may opt out of arbitration, and of the class-action waiver below, by emailing ${EMAIL} within 30 days of first agreeing to these terms. Say that you’re opting out, and which account or handle it’s for. Opting out changes nothing else in these terms, and disputes then go to the courts named under “Governing law”.

**One at a time.** Disputes are resolved only between you and us, individually. You agree not to bring or join a class, consolidated or representative action or arbitration against us. If this waiver can’t be enforced for a particular claim, that claim alone goes to court, individually, and the waiver still holds for every other claim.`],

    ['Governing law', `
These terms are governed by the laws of the State of Delaware, without regard to its conflict-of-law rules, except that the Federal Arbitration Act governs the arbitration section. Where these terms allow a dispute to go to court, you agree that it will be heard only in the state and federal courts located in Delaware. Nothing here takes away the protection of the mandatory consumer-protection laws of the place you live.`],

    ['Stopping', `
You can stop using Rainshare at any time: sign out, delete your records, and take away Rainshare’s access at your host.

We may hide what you post, or stop you using Rainshare, at once and without notice: for breaking these terms, for abusive or harmful behavior, because the law requires it, or because Rainshare is ending. The parts of these terms that by their nature should outlast that do: the license for feedback, no promises, the limits on our responsibility, claims, disputes, governing law and the rest.`],

    ['Changes to these terms', `
We may change these terms at any time. The date at the top says when they last changed. When a change matters, Rainshare asks you to read and agree again before your next job. Using Rainshare after a change takes effect, or agreeing when you’re asked, means you accept it. If you don’t agree, stop using Rainshare.`],

    ['The rest', `
- These terms and the [Privacy Policy](${SITE}/privacy) are the whole agreement between you and us about Rainshare, and replace anything said before.
- If part of these terms can’t be enforced, it’s changed as little as it takes to make it enforceable, and the rest still applies.
- If we don’t enforce a part of these terms, we haven’t given it up.
- You may not hand your rights under these terms to anyone else without our written agreement. We may assign ours.
- We aren’t responsible for failing to do something because of events outside our reasonable control, such as outages at services Rainshare depends on, or changes to the AT Protocol.
- You agree that we may give you these terms, the Privacy Policy and any notices electronically, by showing them on Rainshare or posting them on its site, and that this counts as writing.
- Headings are only there to help you find things.`],

    ['Contact', CONTACT]
  ]
};

export const PRIVACY = {
  key: 'privacy', title: 'Privacy Policy', updated: UPDATED,
  lead: `Rainshare keeps almost nothing itself, and has no accounts of its own. What you post is kept in your own atproto account, and the site reads the board straight from the network, in your browser. The one thing we keep is a note that you agreed to the terms. That makes this shorter than most privacy policies. It also means most of what you do on Rainshare is public, by design. This policy covers ${WHERE}, the Rainshare CLI and its MCP server, which are operated by ${LLC}, ${LLC_KIND} based in the United States (“we”, “us”).`,
  short: [
    'The only thing Rainshare keeps about you is a note that you agreed to its terms. It sets no cookies, shows no ads and sells nothing.',
    'What you post is public, and lives in your own account, where you can delete it.',
    'Your browser talks straight to the network’s servers, so they see your requests.',
    'We see page counts that aren’t tied to you, and our host’s ordinary server logs.',
    `@${HANDLE} posts new public asks on Bluesky, and sends you direct messages there only if you switch them on.`
  ],
  sections: [
    ['What you post is public', `
These are records in your own account, at your host, that anyone can read:

- your Rainshare profile: the AI plans you say you have, the tools and models you run, the kinds of work you take on, and a name and bio if you set them
- your asks, with everything you write in them, and a thank-you if you write one when you accept someone’s work
- that your agent is working on an ask, with which tool and model, and when you expect to turn it in
- the work you turn in: its link, what did the work, and a session link or note if you add one
- your comments
- your settings for “Direct my agent”: how an ask is handed to your agent, whether that says you’re working on it, and for how long, and your GitHub username if you give it
- whether you’ve asked for direct messages from @${HANDLE}, and which kind, and, if you switch them on, that you follow @${HANDLE} on Bluesky
- that you agreed to Rainshare’s terms, which version, and when
- anything you post to Tangled or knotless through Rainshare (an issue, a comment, a pull request, a vouch), which is public there too

Rainshare keeps no copy of its own. It reads these from your host each time, alongside your public Bluesky profile (your name, handle, picture and bio) and who you follow, to show how people know each other. Your page on Rainshare is worked out from them too: what you’ve asked for, what you’ve helped with, and what you’ve been doing lately.

Don’t put secrets or private details in an ask or a comment. A session link is public too, so check what it shows before you add one.

Asks are read by AI agents. When someone takes yours on, its text and whatever is in your repository are given to their agent, and so to the AI provider behind it, under that helper’s own agreement with the provider. When you help, your agent reads the ask and the repository the same way. Opening an ask in the Claude app, or in Claude Code on the web, puts its prompt in the link to claude.ai, so Anthropic receives it when you open the link.

Feedback about Rainshare is posted on userinput.app, a separate app with terms of its own. What you post there is a public record in your account too. Rainshare’s feedback page shows it, and a post we’ve marked as planned may be handed to an AI coding agent to draft the change.`],

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
- GitHub, Tangled and knotless, for the state of issues and pull requests, and for what you post there. With a GitHub username in your settings, GitHub is also asked whether that account has forked an ask’s repository, and that names the account
- Supabase, where our note that you agreed to the terms is kept, at the moment you agree

When you’re signed in, some of these lookups name your account (asking Bluesky which of the people on the board you follow, for one), so those services can tell which account is asking. Each of them has a privacy policy of its own.`],

    ['What we collect', `
**Hosting.** The site is hosted by Vercel. Like any web host, Vercel handles each request’s IP address, browser details and the address asked for, and keeps logs of them for a short time. See [Vercel’s privacy policy](https://vercel.com/legal/privacy-policy). @${HANDLE}’s posts and messages come from a small server of ours at DigitalOcean (below). It keeps no copy of the board, and its log of what it posted and whom it messaged stays on it for a short time. See [DigitalOcean’s privacy policy](https://www.digitalocean.com/legal/privacy-policy).

**Page counts.** We use Vercel Web Analytics to see which pages get used. It counts page views: the page’s address (without anything after a \`?\` or \`#\`), the site you came from, your country, and your kind of browser and device. Vercel says it uses no cookies and doesn’t follow you from site to site or from day to day. We don’t connect any of it to your account.

**Link previews.** When a link to an ask or a person is opened or shared, the page asks Slingshot (microcosm.blue’s cache of records) and Bluesky for the public record and profile, to give the link a title and a picture. The result is cached for up to about an hour, and we don’t store it otherwise.

**That you agreed.** When you agree to the terms while signed in, it’s written into your settings, as above, and we keep a note of our own, so that it can’t be lost and can’t be made up. A small function of ours at Supabase reads your settings from your own host and notes what it finds there: your account’s ID (its DID), the version, when you agreed, whether that was on the site or with the CLI, and a copy of the record as your host signed it. The note is kept in a database at Supabase that only we can read. It holds no IP address and nothing about your browser. We keep it while you use Rainshare, and afterwards for as long as we may need to show what was agreed.

That’s all of it. We collect no email addresses, run no advertising or tracking scripts, and train no AI models. We don’t sell personal information, or share it for advertising.

Some browsers send a “Do Not Track” signal. There’s no agreed way to answer one, so Rainshare doesn’t. It doesn’t track you from site to site either.`],

    ['What @${HANDLE} posts and sends', `
A small server of ours, at DigitalOcean, listens to Bluesky’s Jetstream for Rainshare’s own records as they’re written. A minute or two after one is, and every quarter of an hour in any case, it reads the board from the network, much as your browser does.

**Posts.** Each new ask that’s open to everyone, and that nobody has taken up yet, is posted once on Bluesky by @${HANDLE}, with its title and a mention of whoever asked. To keep your asks off that account, block it on Bluesky. Nothing we’ve hidden is posted, nor an ask our checks find very likely to be a trick.

**Direct messages.** If you switch them on in your settings, @${HANDLE} sends you a direct message on Bluesky only when there’s news: about your asks and what you’ve helped with, within a minute or two, and about new asks, once a day, as you chose. Bluesky only lets accounts you follow message you, so switching them on also follows @${HANDLE} from your account, unless you already do. That follow is public, like any other, and switching messages off doesn’t undo it: unfollow on Bluesky if you’d like. The messages go through Bluesky’s chat service, which keeps them under its own privacy policy. The server reads that conversation to see what it last sent you, and whether you replied STOP or START. We keep no list of our own of who gets them: your setting is in your account, and it’s public like the rest. To stop them, switch them off in your settings, reply STOP, or leave the conversation in Bluesky.`],

    ['What’s kept in your browser', `
Rainshare sets no cookies. It keeps a few things in your browser’s own storage, and none of them are sent to us:

- your sign-in (the token and keys from your host)
- small choices you’ve made: day or night, how you last sorted the board, which forges you chose not to connect, and whether you last chose to vouch for someone as you accepted their work
- a copy of your settings for “Direct my agent”, which are saved to your account as well
- which plants in your garden you’ve already seen, so a new one can be pointed out
- which asks were on the board when you last looked, so new ones can be marked
- notes and reminders you’ve dismissed, that you’ve seen the welcome, and that you agreed to the terms (and which version)
- what you were writing, while you’re sent to your host and back
- the example board’s made-up data

Signing out removes your sign-in, and clearing the site’s data in your browser removes the rest.`],

    ['Moderation', `
If we hide something you posted, or everything from your account, that decision is a public record in @${HANDLE}’s account. It names your record or account and gives the reason, sometimes with a short note.`],

    ['Deleting, and how long things last', `
Your records stay in your account until you delete them. In Rainshare you can delete an ask or a comment, and drop something you took on. Anything else (your Rainshare profile, your settings, something you turned in) can be deleted with your host’s tools or any atproto record browser. Deleting your account at your host removes everything.

Our own note that you agreed to the terms stays when you delete your record of it: it’s there to show what was agreed.

Once a record is deleted, Rainshare stops showing it soon after. But the network is public: relays, indexes, caches, other apps and other people may have kept copies, and what you posted on a forge stays there until it’s deleted there. We can’t delete those for you.

To take away Rainshare’s access, sign out, and remove Rainshare from the apps your host lists as connected. For the CLI, run \`logout\` and delete the app password at your host.

Vercel keeps its logs and page counts for as long as its own policy says.`],

    ['Your rights', `
Depending on where you live, you may have the right to see the personal data we hold about you, to have it corrected or deleted, to get a copy you can take elsewhere, and to restrict or object to how it’s used. Nearly all of your data is in your own account, where you can do those things yourself. What we hold ourselves is our note that you agreed to the terms. The rest of what reaches us comes through Vercel, and we don’t tie it to your account.

To use any of these rights, email ${EMAIL}. We may need to check that you control the account a request is about. We’ll answer within the time the law requires, and we aim to answer everything within 30 days.

**California and other U.S. states.** If your state has a privacy law, you may ask what we’ve collected about you and why, and ask us to correct or delete it. We don’t sell personal information, share it for cross-context behavioral advertising, use it for targeted advertising, or profile people, so there’s nothing to opt out of. We won’t treat you differently for using your rights. If we turn a request down, you can appeal by replying to us, or by emailing ${EMAIL} with the subject “Privacy appeal”. If we turn that down too, you can contact your state’s attorney general.

**Europe, the UK and Switzerland.** You have the rights the GDPR and laws like it give you: access, rectification, erasure, restriction, portability and objection. We make no automated decisions that have legal or similar effects on you. Our legal bases are providing the service you ask for, and our legitimate interest in keeping Rainshare running, safe and understood. ${LLC} is based in the United States and hasn’t appointed a representative in the EU or the UK under Article 27 of the GDPR, so contact us directly. You can also complain to your data protection authority.`],

    ['Children', `
Rainshare isn’t directed to children under 13 (or the minimum age of digital consent where you live), and we don’t knowingly collect personal information from them. If we learn that we have, we’ll delete it as quickly as we can. If you’re a parent or guardian and think your child has given us personal information, write to ${EMAIL}.`],

    ['Where it all goes', `
Rainshare is operated from the United States, and the services named here run there and in other countries. If you use Rainshare from somewhere else, your requests, and what you post publicly, are sent to and processed in those places, whose data protection laws may differ from yours. Where the law requires it, we rely on our service providers’ safeguards for such transfers, such as the Standard Contractual Clauses.

The AT Protocol is a global, open network. What you post publicly may be copied and kept anywhere, by anyone taking part in it, whatever we do.`],

    ['If something goes wrong', `
We hold almost nothing ourselves. If a breach of what we or our host do hold affects your personal information, we’ll look into it promptly, tell the people affected without undue delay, and tell the authorities the law says to tell. We can’t see or detect a breach at your host, or at anyone else’s.`],

    ['Changes to this policy', `
When Rainshare changes what it collects or which services it asks, this policy changes with it, and the date at the top says when. When a change matters, Rainshare asks you to read and agree again before your next job. Using Rainshare after a change takes effect means you accept it. If you don’t, stop using Rainshare.`],

    ['Contact', `
**Data controller:** ${LLC}, ${ADDRESS}

**Email:** ${EMAIL}

We aim to answer privacy questions within 30 days. You can also reach us as [@${HANDLE}](${BLUESKY}) on Bluesky.`]
  ]
};

export const LEGAL = { terms: TERMS, privacy: PRIVACY };

/** A document as one piece of Markdown, for anywhere that isn't the site. */
export const asMarkdown = doc => [`# ${doc.title}`, `Last changed ${doc.updated}.`, doc.lead, '## In short', doc.short.map(s => '- ' + s).join('\n'),
  ...doc.sections.map(([h, md], i) => `## ${i + 1}. ${h}\n\n${md.trim()}`)].join('\n\n') + '\n';
