// /oauth-client-metadata.json (see the rewrite in vercel.json): the site's OAuth client
// document. Built from the host the request came in on, so production, preview and branch
// URLs each get a document whose client_id is their own address.
import { clientMetadata } from '../src/scope.js';

export default function handler(req, res){
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) { res.status(400).json({ error: 'bad host' }); return; }
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, max-age=300');
  res.status(200).send(JSON.stringify(clientMetadata('https://' + host), null, 2));
}
