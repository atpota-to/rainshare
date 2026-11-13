// A seed's comments as conversations. Each comment said to the seed itself starts a thread,
// and every reply in it, however deep, sits under that one, oldest first.
//
// The records come from many people's servers, so nothing in them is taken on trust: a
// comment has to point at this seed and say something, and it can only answer a comment that
// came before it (so no set of records can make a loop). A reply whose comment isn't here
// (deleted, from someone you block, or on another seed) stands on its own, marked `lost`.

const when = c => String(c?.value?.createdAt || '');
const byTime = (a, b) => when(a).localeCompare(when(b)) || String(a.uri).localeCompare(String(b.uri));

/** Whether a record is a comment on `seedUri` with something to show. */
export const isComment = (c, seedUri) => !!c?.uri && c.value?.seed?.uri === seedUri && typeof c.value.text === 'string' && !!c.value.text.trim();

/**
 * The comments on one seed as threads, oldest first:
 *   [{ ...comment, lost, replies: [{ ...reply, to }] }]
 * `lost`: it answers a comment that isn't here. `to`: on a reply, the comment it answers, when
 * that isn't the one that started the thread.
 */
export function threads(comments, seedUri){
  const list = (comments || []).filter(c => isComment(c, seedUri)).sort(byTime);
  const at = new Map(list.map((c, i) => [c.uri, i])), out = [], threadOf = new Map();
  list.forEach((c, i) => {
    const up = c.value.parent?.uri, k = up ? at.get(up) : undefined, parent = k !== undefined && k < i ? list[k] : null;
    const root = parent && threadOf.get(parent.uri);
    if (!root) {
      const t = { ...c, lost: !!up, replies: [] };
      out.push(t); threadOf.set(c.uri, t);
      return;
    }
    root.replies.push({ ...c, to: parent.uri === root.uri ? null : parent });
    threadOf.set(c.uri, root);
  });
  return out;
}

/** How many comments there are to show on a seed. */
export const commentCount = (comments, seedUri) => (comments || []).filter(c => isComment(c, seedUri)).length;
