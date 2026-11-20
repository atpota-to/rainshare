// The announcer's side of Rainshare's index (../../indexer/, kept by rainshare-index on the same
// droplet): every dev.rainshare.* record, in Supabase. The schema is
// ../../supabase/migrations/20261115210000_rainshare_index.sql.
//
// Reading the index instead of every repo makes a run one query per collection rather than a few
// hundred requests. It's only used while it's fresh: the indexer's heartbeat a few minutes old at
// most, and a first reconcile done. Otherwise a run reads the network, as it always has (reader
// in ./posts.js), and says so.
import { supabaseRest } from '../../indexer/src/supabase.js';

/** How old the indexer's heartbeat may be for its records to be read in place of the network's. */
export const FRESH = 5 * 60e3;

/**
 * The index, through Supabase's REST API with the service key, or null when it isn't set up
 * (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
 *   ready()                      { ok, why }: whether its records can be read in place of the network's
 *   list(collection)             every record of a collection, as ../../core/net.js listRecords has them
 */
export function indexDb({ url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, fetch = globalThis.fetch, clock = Date.now } = {}){
  if (!url || !key) return null;
  const db = supabaseRest({ url, key, fetch });
  return {
    async ready(){
      const [s] = await db.select('rainshare_status', 'id=eq.1&select=heartbeat_at,backfilled_at');
      const beat = Date.parse(s?.heartbeat_at);
      if (!s?.backfilled_at) return { ok: false, why: 'it hasn’t finished its first reconcile' };
      if (!(clock() - beat < FRESH)) return { ok: false, why: `its last heartbeat was ${Number.isFinite(beat) ? Math.round((clock() - beat) / 60e3) + ' minutes ago' : 'never'}` };
      return { ok: true, why: null };
    },
    async list(collection){
      const rows = await db.rpc('rainshare_list', { p_collection: collection });
      if (!Array.isArray(rows)) throw new Error('rainshare_list: not a list');
      return rows.map(r => ({ uri: r.uri, cid: r.cid, repo: r.did, collection, rkey: r.rkey, value: r.record }));
    }
  };
}
