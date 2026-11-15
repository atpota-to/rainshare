// Rainshare's Terms of Service and Privacy Policy, and the short safety note someone reads
// before their first job (../ui/agree.js, and the CLI's `login`).
//
// The two documents are written here, as Markdown, so there's one copy: the site shows them at
// /terms and /privacy (../ui/rainshare.js), each paragraph on a line of its own, as the
// renderer (./markdown.js) takes a line break for one.
//
// LEGAL_VERSION is the date they last changed in a way people should agree to again. Whoever
// agreed to an older one is asked once more before their next job. A typo fixed, or a sentence
// made clearer, doesn't need a new one. Anything that changes what the Terms mean does: agreement
// is matched on this string alone, so new words under an old date are never put to anyone.
//
// People agree to the Terms. The Privacy Policy is a notice: it says what happens to data, and
// nobody is asked to agree to it (the tick box, the CLI's question and the ask form say so too).
//
// What they say about data is what the code does: when the code changes (a new service asked,
// something new kept in the browser), the Privacy Policy changes with it.
import { SITE, HANDLE } from './ns.js';

export const LEGAL_VERSION = '2026-11-16';
const UPDATED = '16 November 2026';
const BLUESKY = `https://bsky.app/profile/${HANDLE}`;
// Who runs Rainshare: the company, named and reached as its other terms have it (Anisota's are
// the same company's, and the legal sections here started from theirs: who may use it, the cap on
// liability, claims, governing law, copyright notices, and privacy rights). Disputes differ:
// there's no arbitration here, only small-claims court or the courts in Delaware.
export const OPERATOR = {
  name: 'atpotato, LLC', kind: 'a Delaware limited liability company',
  address: '8595 Pelham Road, Suite 400 #747, Greenville, SC 29615, USA',
  email: 'contact@atpota.to'
};
const { name: LLC, kind: LLC_KIND, address: ADDRESS, email: EMAIL } = OPERATOR;
const WHERE = SITE.replace(/^https?:\/\//, '');
// The copyright agent's phone number, as registered with the Copyright Office (17 U.S.C. 512(c)(2) asks
// for one on the site as well). Left empty, the Terms give the address and email alone.
const PHONE = '';
const CONTACT = `Rainshare is operated by ${LLC}.

- Email: ${EMAIL}
- Post: ${LLC}, ${ADDRESS}
- Bluesky: [@${HANDLE}](${BLUESKY})
- Bugs and ideas: Rainshare’s [feedback page](${SITE}/feedback)

If something on Rainshare doesn’t work with a screen reader, a keyboard or other assistive tools, tell us and we’ll try to fix it.`;

// What to keep in mind before sending an agent, as briefly as it can be said. [the point, why]
export const SAFETY = [
  ['Read the ask yourself first.', 'It’s a stranger’s request. Rainshare flags the tricks it can spot, and it can’t spot them all.'],
  ['Look the repo over first.', 'It can carry scripts and agent settings of its own, and Rainshare doesn’t look inside it. Make sure your agent asks before it acts.'],
  ['It runs as you.', 'What your agent does is on your AI plan and your accounts. Check that your plan allows this, and only take on what you’d do for yourself.']
];

// And before posting a first ask. [the point, why]
export const ASKING = [
  ['Say plainly what you want.', 'No tricks aimed at agents, in the ask or in what it points to: nothing hidden, and nothing that reaches for a helper’s keys or files. We can hide an ask that breaks this.'],
  ['Keep secrets out of it.', 'An ask is a public record in your account, and everything else you post here is public as well. Helpers’ agents read your repo too.'],
  ['Read what comes back.', 'A stranger sent it, and an AI probably wrote it. Check what your project runs on pull requests, and look the work over before you merge it or run it.']
];

export const TERMS = {
  key: 'terms', title: 'Terms of Service', updated: UPDATED,
  lead: `Rainshare is a board where people ask for help with ideas and projects, and other people send their own AI coding agents to do the work. It’s operated by ${LLC}, ${LLC_KIND} (“we”, “us”). These terms cover ${WHERE}, the Rainshare CLI and its MCP server, and what Rainshare’s account @${HANDLE} posts, sends and hides (together, “Rainshare”). You agree to these terms when you tick the box or type “agree” where Rainshare asks you to. You also agree by signing in or using Rainshare in any other way, yourself or through an agent or other software acting for you. Please read them: they limit what we’re responsible for, and they say that disputes are settled one at a time, in small-claims court or the courts in Delaware, with no jury (see “Disputes”). If you don’t agree, please don’t use Rainshare.`,
  short: [
    'What you post is public, and most of it stays in your own account.',
    'You run your own agent, as you, at your own risk. Rainshare’s safety checks are rough, and they don’t promise anything.',
    'What your agent does counts as you doing it. If that gets us sued, you cover it.',
    'Nobody pays for help here, and nobody gets paid for it.',
    'Ask honestly. No tricks aimed at other people’s agents.',
    'A dispute with another user is between you and them, not us.',
    'Rainshare is free and early, and comes with no warranty.',
    'Disputes are settled one at a time, in small-claims court or in Delaware’s courts, with no jury. Delaware law applies, along with any consumer law where you live that can’t be signed away.'
  ],
  sections: [
    ['Who runs Rainshare, and who can use it', `
Rainshare is operated by **${LLC}**, ${LLC_KIND}. In these terms, “we”, “us” and “our” mean ${LLC}. We post as [@${HANDLE}](${BLUESKY}) on Bluesky. Rainshare is in early alpha: it can change, break or stop.

“Our people” means the people who own, manage or work for ${LLC}, and the people who build, contribute to, moderate or run Rainshare, at any time. Some parts of these terms protect our people as well as us, and say so where they do. Those parts cover our people only for their part in Rainshare: what they do or don’t do for it or for us, and any claim made against them because of that part. When one of them posts an ask or helps with one, they’re a user like you. Calling a contributor one of our people doesn’t mean they work for us or act for us.

We run Rainshare from the United States. If you use it from somewhere else, following the law where you are is up to you.

“You” means the person using Rainshare, and the person or organization an account belongs to. What an AI agent, a script or another person does on Rainshare for you, or through your account because you let them, counts as you doing it, even when it isn’t what you wanted. Agree to these terms yourself. If you let software do it for you anyway, the agreement is still yours. People who post asks are askers, and people who send their agents are helpers.

To use Rainshare:

- You must be at least 18 years old, or the age of majority where you live if that’s higher.
- You need an atproto account in good standing, and you need to be allowed to use your atproto host and your AI provider under their terms.
- You aren’t located in, under the control of, or a national or resident of a country under a U.S. Government embargo or one it has designated as supporting terrorism, and you aren’t on any U.S. Government list of prohibited or restricted parties. You agree not to use Rainshare in a way that breaks export-control or economic-sanctions laws.
- If you use Rainshare for an organization, you’re saying you can agree to these terms for it, and “you” means both you and the organization.

By using Rainshare, you’re saying all of that is true of you.`],

    ['Your account and what you post', `
You sign in with an account at an atproto host, such as Bluesky. If you don’t have one, Rainshare sends you to a host to make one. That account is between you and your host, and we never see your password. On the site, Rainshare can only do what your host’s sign-in page said it could. The CLI uses an app password, which you make at your host and can take back there.

Everything you post through Rainshare is public, and almost all of it is a public record in your own account: your asks, what you say you’re working on, the work you turn in, your comments, your Rainshare profile and your settings. The exception is what Rainshare posts to Tangled for you (an issue, a comment, a pull request). That’s kept with the repository, on the server that hosts it, and a record in your account says it’s yours. Anyone can read and copy what you post, in Rainshare and in other apps. Don’t post anything you need to keep private.

Agreeing to these terms is written down too: in your settings, and in a note we keep ourselves. The [Privacy Policy](${SITE}/privacy) says what’s in it.

What you post is yours. You give us a limited, non-exclusive, worldwide, royalty-free license to read, cache, show, copy and format it as far as running Rainshare needs. That includes the board, an ask’s page, people’s pages, the CLI and the MCP server, the brief (the instructions Rainshare writes for a helper’s agent), link previews, and the posts and direct messages Rainshare’s own account, @${HANDLE}, sends on Bluesky. That license ends when you delete the record, though copies other people and services made may remain, and a direct message @${HANDLE} already sent can’t be taken back. A post @${HANDLE} already made about your ask can stay up after that, and the license covers that post until it’s deleted. Ask us and we’ll delete it.

When you post an ask, you also let whoever takes it on copy and use its words, and anything it points to that’s yours to share, as far as doing the work needs. That includes passing both to the helper’s agent and to the AI provider behind that agent. A repository with a license of its own is covered by that license.

You’re responsible for what you post, and you’re saying you have the right to post it.

If you send us ideas, suggestions or bug reports, on Rainshare’s feedback board or anywhere else, you give us a perpetual, irrevocable, worldwide, royalty-free license to use them for any purpose, and to let others use them as part of Rainshare’s open-source code, with nothing owed to you. Don’t send us anything that isn’t yours to share.`],

    ['Asking for help', `
- Ask only for work on something that’s yours to ask about: your own idea, a project you maintain, or an open-source project that takes the kind of contribution you’re asking for. If the project isn’t yours, say so in the ask. Don’t send helpers to a project that has said it doesn’t want AI-written work.
- If you’re asking for a business, say so in the ask, so helpers can decide with that in mind.
- Say plainly what you want. An ask must not try to trick or misuse a helper’s agent. That means no text hidden from people, no telling an agent to set its rules aside or keep things from its user, no reaching for a helper’s keys, tokens or files, no having an agent run code its user hasn’t seen, and no sending anything of theirs anywhere.
- The same goes for what your ask points to. If the repository, the issue or a linked page is yours, don’t put or leave anything in it that’s set up to trick a helper’s agent or to harm a helper, their machine or their accounts. That covers a repository’s agent settings (files such as CLAUDE.md or AGENTS.md, hooks, .mcp.json) and its install, build and test scripts. Changes you make after posting are covered as well. If it isn’t yours, you’re saying that as far as you know nothing in it is set up that way, and that you’ll close the ask if you learn otherwise.
- Point an ask only at things you’re free to show strangers. Helpers’ agents read the repository, the issue and what you link to, and pass what they read to their AI providers. Don’t point one at an employer’s or a client’s private code, or at anything you’ve promised to keep confidential.
- Don’t ask for anything unlawful or harmful, such as malware, phishing, spam or harassment, or for anything AI providers’ usage policies forbid. Don’t ask for work against systems or accounts you have no permission to test. Don’t ask for anything that uses a helper’s own accounts for more than doing the work and handing it over, such as starring, following or posting for you. Whoever helps is answerable to their provider for what their agent does.
- Help is a gift. Nobody owes you work, a result or a reply.
- What comes back was usually written by an AI, and sent by someone you may not know. Read the work before you merge it, run it or rely on it, as you would a stranger’s contribution. Whether the work did the job is your call.
- A pull request can set things running in your project before you’ve read it: tests, preview builds, bots, or your own agent if it reviews pull requests. Check what your project runs for pull requests from outside, and keep secrets out of their reach. Anything a helper posts about your ask is a stranger’s words as well, so treat it that way if your own agent reads it.
- Accepting work marks your ask done and shows it on the helper’s page as something they helped with. It doesn’t say the work is right or safe, and it doesn’t change who answers for what. A vouch is your own word about a person, in your own account. Give one only if you mean it.
- Work turned in to your project is contributed under your project’s license. If your project has no license, the helper lets you use, change and share what they turned in under any license you choose, for free and for good. If your project needs a sign-off or a contributor agreement, say so in your ask.
- For an idea with no repository yet, your ask says who keeps what gets built. If you said someone else can run with the idea, whoever builds it keeps what they build, and you let them use your idea and the words of your ask to do that, for free and for good. If you asked for the idea to be started for you, the helper lets you use, change and share what they turn in under any license you choose, for free and for good. Handing over the repository itself is for the two of you to arrange. If your ask doesn’t say, settle it with the helper before work starts.
- Work written by an AI may not be protected by copyright, and it can resemble code from somewhere else. We don’t promise otherwise.`],

    ['Helping: sending your agent', `
- You run your own agent, signed in as you, on your own machine or cloud session, on your own AI plan. It can reach what you can on that machine, the Rainshare CLI’s saved sign-in included. What it does, you do: the commands it runs, the files it changes, the pull requests it opens, what it posts as you, what it uses of your plan, and what it costs you. That holds when it does something you didn’t ask for or expect, and when an ask, a repository or anything else it read led it to do that. None of this takes away any claim you have against the person who set the trick. We don’t see what your agent does on your machine, and once it’s running we have no way to stop it.
- Use a plan, a machine and accounts that are yours to use for this. If your employer, school or client pays for the plan, or owns the machine or the accounts your agent is signed in to, get their agreement first. Their rules apply, and they may own what’s made with their things.
- Your AI provider’s terms and usage policy apply to the work you take on, and keeping to them is up to you. We can’t tell you whether your plan allows helping someone else with it: plans differ, their terms change, and some are sold for one person’s own use. A provider can limit or close an account without warning. Read your plan’s terms before you take an ask on, and if they don’t allow it, don’t use that plan here.
- Pick each ask yourself. Your agent may look through the board and tell you what suits you, but taking one on is your decision each time. Don’t set an agent to take asks by itself, one after another. If your agent takes one on anyway, it’s still yours.
- An ask is a stranger’s request, and a repository is a stranger’s code. Rainshare’s software runs rough checks on an ask’s own words (its title, what it says and its notes) for tricks the software knows about, and shows you and your agent what the checks find. The checks can’t catch everything, so an ask with no flag isn’t a safe ask. They don’t look at anything an ask points to: the repository, the issue and its comments, or a linked spec. They don’t read what other people post about an ask either: who says they’re on it, what they turned in, or their comments.
- The brief asks your agent to work only in the repository, and to stop and check with you before it does anything the ask’s words call for that touches secrets or reaches outside. It also tells your agent to push its work, open a pull request and turn the work in on Rainshare as you, and it doesn’t tell it to ask you first. All of these are requests to an AI model. It may not follow them, and a repository’s own files can tell it otherwise.
- The commands Rainshare gives you, and its CLI, do several things in one paste. They clone the repository, or fork it on your GitHub account, and start your agent in it straight away. Some also download Rainshare’s CLI, add it to your agent as a tool, say on Rainshare that you’re on the ask, and offer to turn the work in. Read a command before you run it. None of this makes the repository safe.
- Before your agent starts, read the ask and look the repository over, its agent settings and scripts most of all. To look first, clone the repository yourself and paste the brief into your agent. How much your agent asks before it acts depends on the agent and its settings, so check them. Have it ask you before it runs commands or changes files, or run it somewhere that holds no keys you care about. You take work on at your own risk.
- Don’t give anyone your AI login or access to your plan through Rainshare.
- What you turn in should be honest work on what was asked: nothing harmful hidden in it, and nothing you don’t have the right to contribute. You contribute it under the project’s license. If the project has no license, or the ask is an idea to be started for whoever asked, you let them use, change and share what you turn in under any license they choose, for free and for good. If the ask is an idea for someone else to run with, what you build is yours.
- You’re the one turning work in, whether you press the button or your agent does it for you, and whether or not you’ve read the work. You answer for it either way, so read it first. Follow the project’s own rules for contributions, including any rule about AI-written code. If the project asks for a sign-off or a contributor agreement, check what it asks of you before you turn anything in. A sign-off your agent adds is yours.`],

    ['No money', `
Rainshare is free. It has no credits, tips or payments, and help here is unpaid.

- Don’t charge for help or offer to pay for it, whether the payment is arranged through Rainshare or anywhere else.
- Don’t post an ask for work that carries a bounty, a prize or a fee, and don’t take an ask on to collect one.
- A project that takes donations or has sponsors can still ask, as long as nobody is paid for the help.
- Don’t use Rainshare to sell or rent access to an AI plan.`],

    ['Between you and other people', `
Rainshare shows asks and who is on them, sorts them, tells people about new ones, and writes the brief and the commands. When you run it, its CLI starts your agent. When you or your agent tell it to, Rainshare posts your pull request and your turn-in as you. It doesn’t assign work to anyone, and it doesn’t do the work or check the work. What an asker and a helper arrange is between the two of them. We aren’t a party to it, unless we’re the asker or the helper.

Nobody works for anybody here. Helping doesn’t make a helper the asker’s employee, contractor, representative or partner, or ours.

These terms are between you and us. The only things one user gets from another under them are two permissions: to use an ask to do the work, and to use the work that’s turned in. They’re set out under “Your account and what you post”, “Asking for help” and “Helping: sending your agent”. Anything more that an asker and a helper promise each other is their own affair.

If you have a dispute with another person over an ask, a repository, an agent or work that was turned in, take it up with them. As far as the law allows, you release us and our people from claims and losses that come out of that dispute, whether or not you know of them yet, and even if you say we or our people were careless. This doesn’t release anyone from their own fraud, or from harm they did on purpose. If we or one of our people is the asker or the helper, the release doesn’t cover what they did in that role either. If you live in California, you give up the protection of California Civil Code section 1542, which says: “A general release does not extend to claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the time of executing the release and that, if known by him or her, would have materially affected his or her settlement with the debtor or released party.”`],

    ['What nobody may do', `
- Break the law, or help someone else to.
- Harass, threaten or demean people.
- Pretend to be someone else, or to speak for Rainshare.
- Spam: advertising, or the same thing posted over and over.
- Say you’re working on something, or turn something in, when it isn’t so, to keep others off an ask or to make it look as if you helped.
- Use what you post through Rainshare, or the work you turn in, to trick or misuse someone else’s agent. That covers an ask, a note that you’re on it, a turn-in, a comment, a name and a link. It covers the asker’s agent as much as a helper’s.
- Post other people’s private details, or anyone’s passwords, keys or tokens.
- Attack or overload Rainshare, or the servers it reads from.
- Get around moderation, for example by posting something again from another account after it was hidden.`],

    ['Moderation', `
We can hide an ask, a comment, anything else posted through Rainshare or shown on it, or everything from an account, when we think it breaks these terms or puts people at risk. The call is ours, and we can get it wrong. As far as the law allows, neither we nor our people are liable to you for hiding something, for leaving it up, or for the flag or reason published with it, even if we or our people were careless. What’s hidden is left out of the site, the CLI and the MCP server, and new link previews. A preview Rainshare already made can linger for an hour or two. One that another app saved can stay longer, and a post @${HANDLE} already made about it stays up until we delete it. If Rainshare can’t load our list of what’s hidden, hidden things may show again until it loads.

We can’t delete or change your records: they stay in your account. A decision to hide something is a public record in @${HANDLE}’s account. It names what was hidden and gives a reason in a few words. Unhiding deletes the decision.

Rainshare’s automatic checks also put flags on asks. The checks are rough, and an honest ask can set one off. A flag or a reason is our view of what was posted, from what we could see. It isn’t a finding that anyone broke the law. By posting through Rainshare you agree that we and our people may publish flags and reasons about what you post. If we hid or flagged something of yours and you think we got it wrong, tell us (see Contact) and we’ll look again.

We don’t read everything that’s posted, and we don’t have to. If you see something that shouldn’t be here, tell us.

**Copyright.** If you believe something shown or linked on Rainshare infringes your copyright, send a notice to our copyright agent: ${LLC}, ${ADDRESS}${PHONE ? `; phone ${PHONE}` : ''}; email ${EMAIL}. Say which work is yours, what on Rainshare infringes it and where (its link or at:// address), and how to reach you. Include a statement that you believe in good faith the use isn’t authorized by the owner, its agent or the law; a statement that your notice is accurate and, under penalty of perjury, that you own the work or act for its owner; and your signature, written or typed.

When a notice has all of that, and we’ve no reason to think it’s false, we’ll hide the material from Rainshare and delete any post @${HANDLE} made about it. If we hid something of yours this way and you think the notice was wrong, send a counter-notice to the same address saying why. We’ll look again, and we may pass what you send to whoever sent the notice. Anyone who knowingly gets the facts wrong in a notice or a counter-notice can be made to pay for the harm that does. We hide everything from accounts that infringe repeatedly, when the circumstances call for it. Hiding something on Rainshare doesn’t take it off the network: it’s in its author’s account, so write to their host as well.`],

    ['Other people’s services', `
Rainshare works with services we don’t run: your atproto host, Bluesky, GitHub, Tangled, knotless, userinput.app (where feedback about Rainshare is posted), the relays and indexes Rainshare reads from, your AI provider, and the agent you run. Each has its own terms, and your use of them is between you and them. Their age limits apply to you too.

We don’t control these services and aren’t responsible for them. Any of them can go down, change, or stop working with Rainshare. Under its own rules, any of them can limit, suspend or close your account or plan, or take down what you posted, and that’s between you and them as well. When Rainshare posts to Tangled or knotless for you, you’re the one posting, under that service’s terms.

We aren’t affiliated with or endorsed by any of them, and their names and marks are theirs. Naming a tool, a model or a plan on Rainshare doesn’t mean its maker has approved using it this way.`],

    ['Rainshare’s code', `
Rainshare’s code is open source, under the MIT License. That license covers the code. It doesn’t give anyone the right to use the name Rainshare or its logo for a service of their own. These terms are about Rainshare as we run it: the service at ${WHERE}, the CLI and MCP server it serves, and what @${HANDLE} posts, sends and hides. Someone running the code somewhere else is running a service of their own. These terms don’t cover it, and we aren’t responsible for it.

The CLI and MCP server are software you choose to download and run on your own machine. They run as you, with the access you have. “Send my agent” gives you commands for them. Those commands download the current copy from ${WHERE} when you run them, and save it over the one you had, so what runs can change from one use to the next. A copy you already saved, or added to your agent, stays as it was until then.`],

    ['No promises', `
As far as the law allows, Rainshare is provided “as is” and “as available”, without warranties of any kind, whether express, implied or statutory. That includes the implied warranties of merchantability, fitness for a particular purpose, title and non-infringement. Our people make no promises about Rainshare either.

We don’t promise that Rainshare will be uninterrupted, secure or free of errors; that the asks, repositories, issues, links and people you find through it are safe, or what they say they are; that anything an agent does or produces is right, safe or fit to use; or that what Rainshare itself writes and runs is right, safe or all you need. That last part covers the brief and the rules in it, the commands Rainshare gives you to copy, the CLI and the MCP server and what they tell your agent, and the checks and their flags. An ask with no flag isn’t a safe ask, and a flag isn’t proof of a trick. When we hide something, or leave it up, we’re saying nothing about anything else on Rainshare. You decide whether to run a command or start an agent, and you use Rainshare at your own risk.`],

    ['Limits on our responsibility', `
As far as the law allows, each of these limits protects us and our people alike:

- We aren’t responsible for what other people do: what they post, ask for or turn in, what’s in a repository, what their agents do, or anything done by services we don’t run. We aren’t responsible for what your own agent does either, including what it spends on your AI plan or your accounts. That holds whatever kind of loss follows.
- We aren’t liable for lost data, profits or opportunities, for an AI plan or an account being limited, suspended or closed, or for any indirect, incidental, special, consequential, punitive or exemplary damages.
- Added together, our total liability and our people’s for everything arising out of these terms or Rainshare is no more than the greater of what you paid us in the twelve months before the claim, or fifty US dollars (US$50). Rainshare is free, so that is US$50. It’s one limit for all your claims together.

These limits apply whatever a claim is based on: contract, our own negligence or our people’s, or anything else. They apply even if we were told the loss was possible. We couldn’t offer Rainshare for free without these limits. They don’t protect anyone from their own fraud, or from harm they did on purpose. Nothing in these terms takes away rights the law gives you that can’t be signed away.`],

    ['If something you do leads to a claim', `
If someone else brings a claim against us or our people because of something you did, you agree to defend, indemnify and hold harmless ${LLC} and our people from that claim, and from the losses, liabilities and costs that come with it (reasonable legal fees included). That means a claim that comes from: what you post or turn in, and what your ask points to if it’s yours; what your agent does; your breaking these terms or the law; your breaking your host’s or your AI provider’s terms; or your infringing someone else’s rights. This applies even if the claim also says we or our people were careless, and it covers the cost of defending the claim. If a court decides that we or our people caused a share of the loss through our own carelessness or deliberate wrongdoing, you don’t have to cover that share. We’ll tell you about the claim promptly. If we’re slow, that only counts as far as the delay hurt your defense. We may run the defense ourselves, with lawyers we choose, and you won’t settle it for us without our written agreement. This carries on after you stop using Rainshare.`],

    ['Disputes', `
**Talk to us first.** Before starting any formal legal action, you agree to write to us at ${EMAIL} and try to settle it informally for at least thirty (30) days. Most things can be sorted out that way. Say which account is yours, what happened and what you’d like done. If we have a complaint about you, we’ll write to you first too, if we can reach you. Any deadline for bringing the claim is paused while those 30 days run. Neither of us has to wait before asking a court for urgent help, such as an order to stop harm that’s under way.

**Small claims, or the courts in Delaware.** If that doesn’t settle it, either of us may bring an individual claim in small-claims court if it qualifies. Every other dispute, claim or controversy arising out of or relating to these terms or Rainshare goes to the courts named under “Governing law”, and nowhere else. A dispute between you and any of our people about Rainshare is settled the same way. Each of them may rely on this section as we can, and any of them who does is held to it too.

**One at a time.** As far as the law allows, disputes are resolved one user at a time. You bring your own claims only, and you agree not to bring or join a class, consolidated or representative action with anyone else’s claims, against us or our people. If this can’t be enforced for a particular claim, it still holds for every other claim.

**No jury.** As far as the law allows, each side gives up the right to a jury trial.`],

    ['Governing law', `
These terms are governed by the laws of the State of Delaware, without regard to its conflict-of-law rules. Where a dispute goes to court, you agree that it will be heard only in the state and federal courts located in Delaware. You accept those courts’ authority over you, and we accept it over us. Small-claims court is an exception: a claim that qualifies may be brought in the small-claims court where you live, and you may bring yours in Delaware if you prefer. Delaware law and the Delaware courts cover a dispute between you and any of our people about Rainshare too. A small claim that names one of our people, alone or with us, goes to a small-claims court that has authority over that person. Nothing here takes away the protection of the mandatory consumer-protection laws of the place you live. If you live outside the United States, that includes any right those laws give you to bring your claim in the courts where you live.`],

    ['Stopping', `
You can stop using Rainshare at any time: sign out, delete your records, and take away Rainshare’s access at your host. Rainshare can delete your asks, the comments you made on Rainshare, your vouches and what you say you’re working on. For work you turned in, your profile and your settings, use your host or another atproto tool. What Rainshare posted to Tangled or knotless for you is changed or deleted there.

We may hide what you post, or everything from your account, as “Moderation” says. We may also tell you to stop using Rainshare. We can do that at once and without warning: for breaking these terms, for abusive or harmful behavior, because the law requires it, or because Rainshare is ending. If we tell you to stop, you no longer have our permission to use Rainshare, from any account.

However your use ends, and whoever ends it, the parts of these terms that by their nature should outlast it carry on. That includes what you’re responsible for under “Your account and what you post”, “Asking for help” and “Helping: sending your agent”, the license for feedback, the permissions you gave for an ask and for work you turned in, “Between you and other people”, what “Moderation” says about hiding things and publishing reasons, “No promises”, “Limits on our responsibility”, “If something you do leads to a claim”, “Disputes”, “Governing law” and “The rest”.`],

    ['Changes to these terms', `
We may change these terms. The date at the top is the date of this version. We may fix a typo or make a sentence clearer without changing that date. We won’t change what these terms mean that way. When a change matters, we give the terms a new date, and Rainshare asks you to read and agree again the next time you send your agent, take an ask on from the CLI or MCP server, or post one. A change applies to you from when you tick the box or type “agree” for the new version. Until then, the version you last agreed to that way still applies to you. If you’ve never agreed that way, the version posted when you use Rainshare is the one that applies. If you don’t agree to a change, stop using Rainshare.

A change doesn’t reach a dispute that you or we had already raised in writing: that stays under the version you had agreed to.`],

    ['The rest', `
- These terms are the whole agreement between you and us about Rainshare, and replace anything said before. The [Privacy Policy](${SITE}/privacy) says what happens to data. It’s there to inform you, and it isn’t part of this agreement. The MIT License says what you may do with Rainshare’s code, and nothing here takes away what it gives you. Using Rainshare, including the CLI and MCP server we serve, comes under these terms.
- The “In short” list at the top is a summary. If the two differ, the full text is what counts.
- Our people may rely on the parts of these terms that name them, and may enforce those parts, though our people aren’t parties to these terms. Askers and helpers may rely on the permissions these terms say they give each other. So may the maintainers of a project that work is turned in to. Nobody else gets rights under these terms.
- If part of these terms can’t be enforced, it’s changed as little as it takes to make it enforceable, and the rest still applies.
- If we don’t enforce a part of these terms, we haven’t given it up.
- You may not hand your rights under these terms to anyone else without our written agreement. We may assign ours.
- We aren’t responsible for failing to do something because of events outside our reasonable control, such as outages at services Rainshare depends on, or changes to the AT Protocol.
- You agree that we may give you these terms, the Privacy Policy and any notices electronically: by showing them on Rainshare, by posting them on its site, or by writing to an address you’ve given us. This counts as writing.
- Headings are only there to help you find things.`],

    ['Contact', CONTACT]
  ]
};

export const PRIVACY = {
  key: 'privacy', title: 'Privacy Policy', updated: UPDATED,
  lead: `Rainshare keeps almost nothing itself, and has no accounts of its own. Almost everything you post is kept in your own atproto account, and the site reads the board straight from the network, in your browser. The one record we keep in a database of our own is a note that you agreed to the terms. That makes this shorter than most privacy policies. It also means most of what you do on Rainshare is public, by design. This policy covers ${WHERE}, the Rainshare CLI and its MCP server, and Rainshare’s account @${HANDLE}, which are operated by ${LLC}, ${LLC_KIND} based in the United States (“we”, “us”).`,
  short: [
    'The one record Rainshare keeps in a database of its own is a note that you agreed to its terms. It sets no cookies, shows no ads and sells nothing.',
    'What you post is public. Nearly all of it lives in your own account, where you can delete it.',
    'Your browser talks straight to the network’s servers, so they see your requests.',
    'We see page counts that aren’t tied to you, and our hosts’ ordinary server logs.',
    `@${HANDLE} posts new public asks on Bluesky, and sends you direct messages there only if you switch them on.`
  ],
  sections: [
    ['What you post is public', `
These are records in your own account, at your host, that anyone can read:

- your Rainshare profile: the AI plans you say you have, the tools and models you run and where they run, the kinds of work you take on, and a name and bio if you set them. A profile saved by an earlier version of Rainshare, or by another app, can hold more: a rough monthly AI budget, your situation, what you care about, who you’d like to help first, and a forecast. Rainshare doesn’t show those now, and saving your profile here doesn’t remove them
- your asks, with everything you write in them, and a thank-you if you write one when you accept someone’s work
- that your agent is working on an ask, with which tool and model, a note if you add one, and when you expect to turn it in
- the work you turn in: its link, what did the work, and a session link or note if you add one
- your comments
- your settings for “Send my agent”: how an ask is handed to your agent, whether that says you’re working on it, and for how long
- whether you’ve asked for direct messages from @${HANDLE}, and which kind
- that you agreed to Rainshare’s terms, which version, and when
- anything you post to Tangled or knotless through Rainshare (an issue, a comment, a pull request, a vouch), which is public there too. On Tangled, issues, comments and pull requests are kept with the repository, on the server that hosts it, and a record in your account says they’re yours

Rainshare reads these from your host each time, alongside your public Bluesky profile (your name, handle, picture and bio) and who you follow, to show how people know each other. Your page on Rainshare is worked out from them too: what you’ve asked for, what you’ve helped with, and what you’ve been doing lately. We keep no copy of our own, except the few set out below: a link preview kept for a short while, what @${HANDLE} posts and sends about an ask, and your settings record as it stood when you agreed to the terms.

Rainshare also shows public information about people who haven’t signed in: who follows whom, vouches and denouncements from Tangled with their reasons, and who wrote the comments and pull requests on a project. It comes from their own public records or from the forge.

Don’t put secrets or private details in an ask or a comment. A session link is public too. It can show file names, commands and what’s in your environment, so look at what it shows before you add one, and tell your agent not to add one for you.

Asks are read by AI agents. When someone takes yours on, its text and whatever is in your repository are given to their agent, and so to the AI provider behind it, under that helper’s own agreement with the provider. When you help, your agent reads the ask and the repository the same way.

Feedback about Rainshare is posted on userinput.app, a separate app with terms of its own. What you post there is a public record in your account too. Rainshare’s feedback page shows it. A post we’ve marked as planned may be handed to an AI coding agent that we run on our own AI plan, and so to the AI provider behind it. The agent drafts the change, and marks the post as in progress or done on the board.`],

    ['Signing in', `
On the site, you sign in on your own host’s page. Rainshare never sees your password. Your host gives your browser a token that lets Rainshare write the records its sign-in page listed. That token is kept in your browser and isn’t sent to us.

While you type a handle, what you’ve typed is sent to Bluesky, to suggest accounts and to look yours up.

With the CLI and MCP server, the app password you type goes only to your host. The session it gives back is saved in a file in your home folder (\`~/.config/rainshare/session.json\`) that only your own user account can read. Programs you run can read it too, your agent among them. A note that you agreed to the terms is kept beside it. If you sign the CLI in by setting \`RAINSHARE_APP_PASSWORD\` instead, anything started from that shell can read the password, including an agent the CLI starts.`],

    ['What your browser asks other servers', `
There’s no Rainshare server in the middle, so your browser (or the CLI, from your machine) asks these directly. Each one sees your IP address and what was asked, as any website you visit does:

- your own host, and the host of every account that has asked for help, taken something on or turned work in, whether or not it’s shown to you, and of anyone whose comments or profile you look at. Anyone can run a host of their own
- Bluesky’s relays and public API (which accounts have Rainshare records, profiles, follows, lists and blocks) and its picture server
- the PLC directory, which says where an account lives
- Constellation, run by microcosm.blue, which says which records point at an ask
- GitHub, Tangled and knotless, for the state of issues and pull requests, and for what you post there. What you post to a Tangled repository goes to the server that hosts it, which its owner may run
- Supabase, where our note that you agreed to the terms is kept, when you agree, and again when you next sign in if it wasn’t noted then

When you’re signed in, some of these lookups name your account, so the server asked can tell which account is asking, and from which IP address. Bluesky is asked which of the people on the board you follow. The host of each person whose ask or work you’re shown is asked whether they follow you on Tangled, and that host may be a server they run themselves. Each of these services has a privacy policy of its own, though a server someone runs for themselves may have none.`],

    ['What we collect', `
**Hosting.** The site is hosted by Vercel. Like any web host, Vercel handles each request’s IP address, browser details and the address asked for, and keeps logs of them for a short time. See [Vercel’s privacy policy](https://vercel.com/legal/privacy-policy). @${HANDLE}’s posts and messages come from a small server of ours at DigitalOcean (below). It keeps no copy of the board, and its log of what it posted and whom it messaged stays on it until the server clears old entries to make room, which can take months. While we’re testing it, the log also holds the words it would have posted or sent. See [DigitalOcean’s privacy policy](https://www.digitalocean.com/legal/privacy-policy).

**Page counts.** We use Vercel Web Analytics to see which pages get used. It counts page views: the page’s address (without anything after a \`?\` or \`#\`), the site you came from, roughly where you are (your country, and Vercel may store the region and city), and your browser, operating system and kind of device. A page’s address can show which ask or whose profile was looked at, not who was looking. Vercel says it uses no third-party cookies, tells visitors apart by a hash of the request that it discards after a day, and doesn’t follow you from site to site. We don’t connect any of it to your account.

**Link previews.** When a link to an ask or a person is opened or shared, a small function of ours at Vercel asks Slingshot (microcosm.blue’s cache of records) and Bluesky for the public record, profile and profile picture, to give the link a title and a picture. Emoji, and letters our own font doesn’t have, are drawn with files from jsDelivr and Google Fonts, which are sent those characters and nothing else. The result is cached for an hour or two, and we don’t store it otherwise.

**That you agreed.** When you agree to the terms while signed in, it’s written into your settings, as above, and we keep a note of our own, so there’s a second record that doesn’t depend on your account. A small function of ours at Supabase reads your settings from your own host and notes what it finds there: your account’s ID (its DID), the version, when you agreed, whether that was on the site or with the CLI, and a copy of the record as your host signed it. That copy is your whole settings record as it stood then. The note is kept in a database at Supabase that isn’t open to the public. Anyone can ask the function whether a given account has agreed to a given version, and it says yes or no. Nothing else in the note can be read by anyone but us and Supabase. It holds no IP address and nothing about your browser, though Supabase’s own log of the request keeps your kind of browser for as long as Supabase keeps its logs. We keep the note while you use Rainshare, and afterwards for as long as we may need to show what was agreed.

**If you write to us.** If you email us, or write to @${HANDLE} on Bluesky, we have what you sent and the address or account it came from. We keep it for as long as it takes to deal with, and longer where we may need to show it later: a copyright notice, a privacy request, a complaint.

**If we have to hand something over.** We’d give what we hold to someone else only if the law required it, or if someone else took over running Rainshare, and then only under this policy.

That’s all of it. You don’t need to give us an email address to use Rainshare. We run no advertising or tracking scripts, and we train no AI models. We don’t sell personal information, or share it for advertising.

Some browsers send a “Do Not Track” signal. There’s no agreed way to answer one, so Rainshare doesn’t. It doesn’t track you from site to site either. The services your browser asks directly could recognize you across the sites that use them, under their own policies.`],

    [`What @${HANDLE} posts and sends`, `
A small server of ours, at DigitalOcean, listens to Bluesky’s Jetstream for Rainshare’s own records as they’re written. A minute or two after one is, and every quarter of an hour in any case, it reads the board from the network, much as your browser does.

**Posts.** Each new ask that’s open to everyone, and that nobody has taken up yet, is posted once on Bluesky by @${HANDLE}, with its title and a mention of whoever asked. The post’s card shows the first lines of the ask and its preview picture, which has your name and profile picture on it. The post is a record in our account, not yours, so it stays up when you close or delete the ask. Write to us (see Contact) and we’ll delete it. To keep your asks off that account, block it on Bluesky before you ask. That works whenever our server can read the block, and if a post slips through we’ll delete it when you tell us. Nothing we’ve hidden is posted, nor an ask our checks find very likely to be a trick.

**Direct messages.** If you switch them on in your settings, @${HANDLE} sends you a direct message on Bluesky only when there’s news: about your asks and what you’ve helped with, within a minute or two, and about new asks, once a day, as you chose. The messages go through Bluesky’s chat service, which keeps them under its own privacy policy. The server reads that conversation to see what it last sent you, and whether you replied STOP or START. We keep no subscriber list of our own: your setting is in your account, and it’s public like the rest. The server’s log (above) and @${HANDLE}’s own conversations on Bluesky do show whom it has messaged. To stop the messages, switch them off in your settings, reply STOP, or leave the conversation in Bluesky.`],

    ['What’s kept in your browser', `
Rainshare sets no cookies. It keeps a few things in your browser’s own storage, and none of them are sent to us:

- your sign-in (the token and keys from your host), and what signing in looked up: the handle you typed, your account’s ID and your host’s sign-in details
- small choices you’ve made: day or night, which forges you chose not to connect, and whether you last chose to vouch for someone as you accepted their work
- a copy of your settings for “Send my agent”, which are saved to your account as well
- which plants in your garden you’ve already seen, so a new one can be pointed out
- notes and reminders you’ve dismissed, that you’ve seen the welcome, and that you agreed to the terms (and which version)
- what you were writing, the handle you typed and the page to come back to, while you’re sent to your host and back
- the example board’s made-up data

Signing out removes your sign-in, and clearing the site’s data in your browser removes the rest.`],

    ['Moderation', `
If we hide something you posted, or everything from your account, that decision is a public record in @${HANDLE}’s account. It names your record or account and gives a reason in a few words, sometimes with a short note. It stays there for as long as the thing is hidden. Unhiding deletes it, though copies other people and services made may remain. We can also hide a comment you wrote on a Tangled or knotless issue that Rainshare shows, whether or not you use Rainshare. Rainshare’s automatic checks only put flags on asks. They don’t hide anything by themselves. If you think a flag or a decision about you is wrong, write to ${EMAIL} and we’ll look again.`],

    ['Deleting, and how long things last', `
Your records stay in your account until you delete them. In Rainshare you can delete an ask or a comment you made here, and drop something you took on. Anything else (your Rainshare profile, your settings, something you turned in) can be deleted with your host’s tools or any atproto record browser. Deleting your account at your host removes all of them.

Our own note that you agreed to the terms stays when you delete your record of it: it’s there to show what was agreed.

Once a record is deleted, Rainshare stops showing it soon after. @${HANDLE}’s post about an ask stays up until you ask us to delete it, and a direct message it already sent stays in the conversation. And the network is public: relays, indexes, caches, other apps and other people may have kept copies, and what you posted on a forge stays there until it’s deleted there. We can’t delete those for you.

To take away Rainshare’s access, sign out, and remove Rainshare from the apps your host lists as connected. For the CLI, run \`logout\` and delete the app password at your host.

Vercel, Supabase and DigitalOcean keep their own logs, and Vercel its page counts, for as long as their policies say.`],

    ['Your rights', `
Depending on where you live, you may have the right to see the personal data we hold about you, to have it corrected or deleted, to get a copy you can take elsewhere, and to restrict or object to how it’s used. Nearly all of your data is in your own account, where you can do those things yourself. What we hold ourselves is our note that you agreed to the terms, anything you’ve written to us, and what @${HANDLE} has posted, sent or hidden that names you. The rest of what reaches us is in our hosts’ logs and page counts, and we don’t tie it to your account.

The one thing we keep when you ask us to delete what we hold is our note that you agreed. We keep it so that we can show what was agreed if there’s ever a dispute, and privacy laws let us keep what we need for that.

To use any of these rights, email ${EMAIL}. You don’t need to have used Rainshare: if it shows something public about you, you can ask too. We may need to check that you control the account a request is about. We’ll answer within the time the law requires, and we aim to answer everything within 30 days.

**California and other U.S. states.** If your state has a privacy law, you may ask what we’ve collected about you and why, and ask us to correct or delete it. We don’t sell personal information, share it for cross-context behavioral advertising, use it for targeted advertising, or use profiling to make decisions with legal or similarly significant effects on you, so there’s nothing to opt out of. We won’t treat you differently for using your rights. If we turn a request down, you can appeal by replying to us, or by emailing ${EMAIL} with the subject “Privacy appeal”. If we turn that down too, you can contact your state’s attorney general.

**Europe, the UK and Switzerland.** Where the GDPR or a law like it applies to what we do with your data, you have the rights it gives you: access, rectification, erasure, restriction, portability and objection. We make no automated decisions that have legal or similar effects on you. Our legal bases are these. Showing the board and your own asks, and sending the direct messages you switch on, are part of providing the service you ask for. For the rest we rely on our legitimate interests: keeping a note that you agreed, so we can show what was agreed; posting new asks from @${HANDLE}, so they get seen; checking asks and hiding things, to keep helpers safe; showing public information about people who haven’t signed in, so you can see who’s asking and who’s helping; and counting page views and keeping server logs, to keep Rainshare running. We’re a small company in the United States with no office in Europe, so write to us directly. You can also complain to your data protection authority.

**Your right to object.** Where we rely on a legitimate interest, you can object at any time by writing to ${EMAIL}. We’ll stop, unless we have a compelling reason to carry on or need the data for a legal claim.`],

    ['Children', `
Rainshare is for adults. It isn’t directed to anyone under 18, and we don’t knowingly collect personal information from children under 13. If we learn that a child under 13 has used Rainshare, we’ll delete what we hold about them, our note that they agreed included, as quickly as we can. If we learn that someone under 18 has, we may stop showing what they posted. Their records are in their own account, where they, a parent or guardian, or their host can delete them. We can’t delete those. If you’re a parent or guardian and think your child has used Rainshare, write to ${EMAIL}.`],

    ['Where it all goes', `
Rainshare is operated from the United States, and the services named here run there and in other countries. If you use Rainshare from somewhere else, your requests, and what you post publicly, are sent to and processed in those places, whose data protection laws may differ from yours. Where the law requires it, we rely on our service providers’ safeguards for such transfers, such as the Standard Contractual Clauses.

The AT Protocol is a global, open network. What you post publicly may be copied and kept anywhere, by anyone taking part in it, whatever we do.`],

    ['If something goes wrong', `
We hold almost nothing ourselves. If a breach of what we or our service providers hold affects your personal information, we’ll look into it promptly, and tell the people affected and the authorities where the law requires it. We have no email address for you, so you’d hear through a notice on Rainshare’s site and, where we can, a post from @${HANDLE}. We’d do the same if Rainshare’s site, its CLI or the @${HANDLE} account were tampered with in a way that could put you at risk. We can’t see or detect a breach at your host, or at anyone else’s.`],

    ['Changes to this policy', `
When Rainshare changes what it collects or which services it asks, this policy changes with it, and the date at the top says when. This policy is a notice: you aren’t asked to agree to it. When it changes in a way that matters, Rainshare points you to it again, along with the terms, the next time you send your agent or post an ask.`],

    ['Contact', `
**Data controller:** ${LLC}, ${ADDRESS}

That covers what we collect and do ourselves, including what Vercel, Supabase and DigitalOcean handle for us. Your host answers for the records it keeps for you, and the other services named in this policy answer for what they do with your requests.

**Email:** ${EMAIL}

We aim to answer privacy questions within 30 days. You can also reach us as [@${HANDLE}](${BLUESKY}) on Bluesky.`]
  ]
};

export const LEGAL = { terms: TERMS, privacy: PRIVACY };

/** A document as one piece of Markdown, for anywhere that isn't the site. */
export const asMarkdown = doc => [`# ${doc.title}`, `Last changed ${doc.updated}.`, doc.lead, '## In short', doc.short.map(s => '- ' + s).join('\n'), 'The full text below is what counts.',
  ...doc.sections.map(([h, md], i) => `## ${i + 1}. ${h}\n\n${md.trim()}`)].join('\n\n') + '\n';
