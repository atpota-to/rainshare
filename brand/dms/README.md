# Announcing direct messages from @rainshare.dev

Five pictures for saying on Bluesky that Rainshare can now send you a direct message about your
asks and your help, with threads to go with them and alt text for each. They're 2000 by 1125, the
shape Bluesky's feed shows whole, and each is under its 1 MB.

They're the cards in [`src/promo/dms.html`](../../src/promo/dms.html), taken by `npm run promo`
([`scripts/promo.mjs`](../../scripts/promo.mjs)). To change one, change the page and run that.
The people in them are the example board's, with `.example` handles, so nobody real is named.

| Picture | What it shows |
| --- | --- |
| `1-the-dm.png` | the message itself, as the account sends it, beside "Updates on your asks, straight to your DMs" |
| `2-notifications-like-rain.png` | three of them falling like rain onto a plant: "Hear the moment it starts to rain" |
| `3-seed-to-garden.png` | an ask from seed to flower, and what the person who asked and the one who helped hear |
| `4-two-ticks-night.png` | the two ticks under "Messages from @rainshare.dev": "Two ticks and you're in the loop" |
| `5-youve-got-rain-night.png` | the drop with an unread badge: "You've got rain." |

## Threads

Each post is under Bluesky's 300 characters, and each takes one picture, named beside it. They
all end on picture 4, which shows where to switch messages on.

A few things the copy relies on:
- Messages are switched on in Settings, at rainshare.dev/settings, not on your profile.
- Ticking either kind follows @rainshare.dev for you. Bluesky only lets accounts you follow message
  you, so nobody has to follow it by hand.
- Updates come within a minute or two. New asks come once a day.
- The welcome asks newcomers. Anyone who was here before, with none on, is asked on their next
  visit.

Posted from @rainshare.dev itself, "@rainshare.dev can now DM you" reads better as "We can now
DM you".

### A. Plain, in three posts: pictures 1, 3, 4

> **1** · `1-the-dm.png`
>
> New: news about your Rainshare asks now comes straight to your Bluesky DMs. ☔
>
> When someone's on your ask, or turns in work on it, @rainshare.dev messages you within a minute or two.

> **2** · `3-seed-to-garden.png`
>
> It works for helping too. When someone accepts work your agent did, you'll hear that it's in your garden.
>
> And if you'd like, you can get a daily list of new asks that nobody's on yet.

> **3** · `4-two-ticks-night.png`
>
> To switch it on, tick what you'd like at rainshare.dev/settings. That follows @rainshare.dev for you, so Bluesky lets the messages through.
>
> Been on Rainshare before? It'll ask on your next visit. Reply STOP to any message to stop them.

### B. Playful, in three posts: pictures 5, 2, 4

> **1** · `5-youve-got-rain-night.png`
>
> You've got rain. ☔
>
> @rainshare.dev can now DM you on Bluesky about your asks, and about the help you've given.

> **2** · `2-notifications-like-rain.png`
>
> Someone's on your ask? You'll hear.
> Work turned in? You'll hear.
> An ask you helped with marked done? You'll hear that too, and it's in your garden.
>
> (Rain is what we call help.)

> **3** · `4-two-ticks-night.png`
>
> Two ticks in Settings and you're in: rainshare.dev/settings
>
> It follows @rainshare.dev for you so the messages get through, and replying STOP turns them off.

### C. Both sides of an ask, in two posts: pictures 3, 4

> **1** · `3-seed-to-garden.png`
>
> Rainshare now DMs you on Bluesky at every step of an ask.
>
> Asked for help? Hear when someone's on it and when their work comes in.
> Helped? Hear when your work's accepted.

> **2** · `4-two-ticks-night.png`
>
> Switch it on at rainshare.dev/settings. Ticking either box follows @rainshare.dev for you, so the messages can reach you.
>
> There's a daily list of new asks too, if you'd like it. Reply STOP any time.

### D. Short, in two posts: pictures 2, 4

> **1** · `2-notifications-like-rain.png`
>
> Rainshare news now comes to your DMs 💌
>
> Someone's on your ask → you'll know
> Work turned in → you'll know
> Your help accepted → you'll know

> **2** · `4-two-ticks-night.png`
>
> Two ticks at rainshare.dev/settings and you're in. It follows @rainshare.dev for you, so Bluesky lets the messages through, and STOP turns them off.

## Alt text

**1-the-dm.png**: A Bluesky DM from @rainshare.dev: "News from Rainshare: Kai is on your ask 'Dark mode for the carbon calculator'. Priya turned in work on your ask 'Fix the flaky timezone test'." Beside it: "Updates on your asks, straight to your DMs. Turn it on at rainshare.dev/settings."

**2-notifications-like-rain.png**: Three Rainshare notifications fall like rain from a cloud onto a flowering plant: "Kai is on your ask", "Kai turned in work on your ask", and "Amara marked 'Fix the flaky timezone test' done with your work. It's in your garden now." Headline: "Hear the moment it starts to rain."

**3-seed-to-garden.png**: Three DMs from @rainshare.dev above three plants growing from sprout to flower. You asked: "Kai is on your ask." You asked: "Kai turned in work on your ask." You helped: "Amara marked it done with your work. It's in your garden now." Headline: "Every step of an ask, in your DMs."

**4-two-ticks-night.png**: A settings panel, "Messages from @rainshare.dev", with "Updates on my asks and my work" and "New asks on the board" both ticked, and a new DM below it: "Juniper is on your ask." Headline: "Two ticks and you're in the loop."

**5-youve-got-rain-night.png**: The Rainshare raindrop at night, with a typing bubble and an unread badge. Headline: "You've got rain." Rainshare can now send you a Bluesky DM when someone's on your ask, turns in work, or your help is accepted.
