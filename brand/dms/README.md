# Announcing direct messages from @rainshare.dev

Five pictures for saying on Bluesky that Rainshare can now send you a direct message about your
asks and your help, with a post to go with them and alt text for each. They're 2000 by 1125, the
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

## The post

One post, at 298 of Bluesky's 300 characters. Bluesky only shortens long links, so
rainshare.dev/settings and @rainshare.dev count in full. It goes with picture 2, which shows three
of the four kinds of message. A post takes up to four pictures, so 2 and 4 (where to switch them
on) work together too.

> Rainshare can now keep you in the loop by Bluesky DM ☔
>
> • when someone's on your ask
> • when they turn in work on it
> • when your help on an ask is accepted 🌱
> • with a daily list of new asks nobody's on yet
>
> Pick yours at rainshare.dev/settings. It follows @rainshare.dev for you. Reply STOP to stop.

What it relies on:
- Messages are switched on in Settings, at rainshare.dev/settings, not on your profile.
- Ticking either kind follows @rainshare.dev for you. Bluesky only lets accounts you follow message
  you.
- The three updates are one setting ("Updates on my asks and my work"), and the daily list is the
  other ("New asks on the board").

Posted from @rainshare.dev itself, "It follows @rainshare.dev for you" reads better as "It follows
us for you".

## Alt text

**1-the-dm.png**: A Bluesky DM from @rainshare.dev: "Updates from Rainshare: Kai is on your ask 'Dark mode for the carbon calculator'. Priya turned in work on your ask 'Fix the flaky timezone test'." Beside it: "Updates on your asks, straight to your DMs. Turn it on at rainshare.dev/settings."

**2-notifications-like-rain.png**: Three Rainshare notifications fall like rain from a cloud onto a flowering plant: "Kai is on your ask", "Kai turned in work on your ask", and "Amara marked 'Fix the flaky timezone test' done with your work. It's in your garden now." Headline: "Hear the moment it starts to rain."

**3-seed-to-garden.png**: Three DMs from @rainshare.dev above three plants growing from sprout to flower. You asked: "Kai is on your ask." You asked: "Kai turned in work on your ask." You helped: "Amara marked it done with your work. It's in your garden now." Headline: "Every step of an ask, in your DMs."

**4-two-ticks-night.png**: A settings panel, "Messages from @rainshare.dev", with "Updates on my asks and my work" and "New asks on the board" both ticked, and a new DM below it: "Juniper is on your ask." Headline: "Two ticks and you're in the loop."

**5-youve-got-rain-night.png**: The Rainshare raindrop at night, with a typing bubble and an unread badge. Headline: "You've got rain." Rainshare can now send you a Bluesky DM when someone's on your ask, turns in work, or your help is accepted.
