// Replies to the account's messages, so that a STOP is answered within a minute or two rather
// than at the next sweep. Bluesky's chat has no firehose, so it's asked, as Poe's service asks
// (atpota-to/atpota.to, mentions/src/operator-dm.js): the latest message in each of the
// account's conversations, every so often. Anything newer from someone else asks for a run,
// which reads the conversations it needs (./messages.js) and does the rest.

/** `onReply()` when someone has written to the account since the last look. */
export function createInbox({ as, account, onReply, clock = Date.now }){
  let since = clock();
  return {
    async check(){
      const r = await as.get('chat.bsky.convo.listConvos', { limit: 100 }, { chat: true });
      let newest = since, heard = false;
      for (const c of Array.isArray(r?.convos) ? r.convos : []) {
        const m = c?.lastMessage, t = Date.parse(m?.sentAt);
        if (typeof m?.sender?.did === 'string' && m.sender.did !== account && t > since) { heard = true; newest = Math.max(newest, t); }
      }
      since = newest;
      if (heard) onReply();
      return heard;
    }
  };
}
