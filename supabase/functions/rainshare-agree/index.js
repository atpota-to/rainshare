// The Supabase Edge Function at /functions/v1/rainshare-agree: Rainshare's ledger of who has
// agreed to its terms. What it does is in ./handler.js. It's deployed with JWT checking off,
// since it checks what it's told against the network itself (see there), and the site and the
// CLI call it without a key.
import { createHandler } from './handler.js';

Deno.serve(createHandler({ supabaseUrl: Deno.env.get('SUPABASE_URL'), serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') }));
