// When someone's take on an ask has lapsed. A take ("my agent is on this") lives in the
// helper's own repo, so nobody else can delete one that's been forgotten. Instead every app
// reads the same rule: a take holds an ask until the day its helper said they'd turn it in
// (`until`), and once that has passed with nothing turned in, the ask is free again. The take
// is still there, and still shown, as someone who went quiet; it just doesn't keep others away.
//
//   dueOf(take)            when it lapses, as a time in ms (or NaN if it can't be told)
//   lapsed(take, item)     whether it has, for that ask
//   activeTakes(item)      the takes on an ask that still hold it
//
// A take from before `until` existed lapses a week after it was written. However far off a
// take's `until` is, it holds an ask for no more than 30 days from when it was last written,
// so a date years away can't keep an ask from everyone else.
const DAY = 864e5;
export const LEGACY_DAYS = 7;
export const MAX_DAYS = 30;

/** When a take stops holding its ask, in ms since the epoch. NaN if it has no date to go by. */
export function dueOf(take){
  const v = take?.value || {}, wrote = Date.parse(v.updatedAt) || Date.parse(v.createdAt), said = Date.parse(v.until);
  if (!(wrote > 0)) return NaN;
  const cap = wrote + MAX_DAYS * DAY;
  return said > 0 ? Math.min(said, cap) : Date.parse(v.createdAt) + LEGACY_DAYS * DAY;
}
/**
 * Whether a take has lapsed: its day has passed and its helper hasn't turned anything in for
 * this ask. (Once they have, it's the turn-in that counts, and that doesn't lapse.) A take
 * with no date to go by never lapses.
 */
export function lapsed(take, item, now = Date.now()){
  if ((item?.deliveries || []).some(d => d.repo === take?.repo)) return false;
  const due = dueOf(take);
  return due === due && now > due;
}
/** The takes on an ask that still hold it. */
export const activeTakes = (item, now = Date.now()) => (item?.takes || []).filter(t => !lapsed(t, item, now));
/** The `until` for a take written now (or at `from`) that gives its helper `days` days. */
export const untilIn = (days, from = Date.now()) => new Date(from + Math.min(MAX_DAYS, Math.max(1, Math.round(Number(days) || 0))) * DAY).toISOString();
