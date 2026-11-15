# Announcing direct messages from @rainshare.dev

Five pictures for saying on Bluesky that Rainshare can now send you a direct message about your
asks and your help, with posts to go with them and alt text for each. They're 2000 by 1125, the
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

## Posts

Each is under Bluesky's 300 characters. Ticking either kind of message follows @rainshare.dev
for you (Bluesky only lets accounts you follow message you), so nobody has to do that by hand.

**Plain and complete** (287)

> New: Rainshare can now DM you on Bluesky when there's news.
>
> • Someone's on your ask
> • Work's been turned in on it
> • An ask you helped with is done
>
> Tick what you'd like at rainshare.dev/settings. It follows @rainshare.dev for you, so the messages can reach you. Reply STOP to stop them.

**Playful** (219), with picture 5

> You've got rain. ☔
>
> @rainshare.dev can now DM you when someone picks up your ask, when they turn in work, and when an ask you helped with makes it into your garden.
>
> Switch it on in your settings: rainshare.dev/settings

**Both sides of an ask** (258), with picture 3

> Asked for help? Hear when someone's on it and when their work comes in.
>
> Sent your agent to help? Hear when your work's accepted.
>
> Rainshare's updates now come by Bluesky DM, with an optional daily list of new asks too. Turn them on at rainshare.dev/settings

**Short** (251), with picture 4

> Rainshare news now comes to your DMs 💌
>
> Someone's on your ask → you'll know
> Work turned in → you'll know
> Your help accepted → you'll know
>
> Two ticks at rainshare.dev/settings, and it follows @rainshare.dev for you so Bluesky lets the messages through.

## Alt text

**1-the-dm.png**: A Bluesky DM from @rainshare.dev: "News from Rainshare: Kai is on your ask 'Dark mode for the carbon calculator'. Priya turned in work on your ask 'Fix the flaky timezone test'." Beside it: "Updates on your asks, straight to your DMs. Turn it on at rainshare.dev/settings."

**2-notifications-like-rain.png**: Three Rainshare notifications fall like rain from a cloud onto a flowering plant: "Kai is on your ask", "Kai turned in work on your ask", and "Amara marked 'Fix the flaky timezone test' done with your work. It's in your garden now." Headline: "Hear the moment it starts to rain."

**3-seed-to-garden.png**: Three DMs from @rainshare.dev above three plants growing from sprout to flower. You asked: "Kai is on your ask." You asked: "Kai turned in work on your ask." You helped: "Amara marked it done with your work. It's in your garden now." Headline: "Every step of an ask, in your DMs."

**4-two-ticks-night.png**: A settings panel, "Messages from @rainshare.dev", with "Updates on my asks and my work" and "New asks on the board" both ticked, and a new DM below it: "Juniper is on your ask." Headline: "Two ticks and you're in the loop."

**5-youve-got-rain-night.png**: The Rainshare raindrop at night, with a typing bubble and an unread badge. Headline: "You've got rain." Rainshare can now send you a Bluesky DM when someone's on your ask, turns in work, or your help is accepted.
