// Rough checks on an ask, for what's often used to misuse a helper's agent: words hidden from
// people but read by agents, talk that tries to change an agent's rules, reaching for secrets,
// running code from elsewhere, and asks for things AI plans rule out.
//
// They're a smoke alarm, not a lock. Someone set on tricking an agent can word things so none
// of this notices, and an honest ask can trip a check now and then, so nothing is refused for
// what's found here. What it does is put a note in front of the helper (the board, an ask's
// page), in the brief their agent gets, and before the CLI starts an agent, and it gives
// @rainshare.dev a list to look over (the moderation page). Every finding is a plain sentence
// of Rainshare's own: the asker's words are only ever quoted to people, never to an agent.
//
//   high   very likely a trick: the CLI asks before starting, and the site before taking it on
//   look   worth a look before your agent starts

// Characters a person doesn't see and an agent still reads. Some have honest uses (emoji are
// built with a joiner, a flag of Scotland with tags), so those are let through where they sit.
const TAG = cp => cp >= 0xE0000 && cp <= 0xE007F;
const VS = cp => (cp >= 0xFE00 && cp <= 0xFE0F) || (cp >= 0xE0100 && cp <= 0xE01EF);
const BIDI = cp => (cp >= 0x202A && cp <= 0x202E) || (cp >= 0x2066 && cp <= 0x2069);
const QUIET = cp => cp === 0x200B || cp === 0x200C || cp === 0x2060 || cp === 0xFEFF || cp === 0x180E;
const OPERATOR = cp => cp >= 0x2061 && cp <= 0x2064;
const PICTURE = /\p{Extended_Pictographic}|\p{Emoji_Modifier}|️/u;
const BLACK_FLAG = 0x1F3F4;

/** Every character an agent reads and a person doesn't see, for taking out of a brief. */
export const INVISIBLE = /[​-‍⁠-⁤﻿᠎︀-️\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;

/**
 * The hidden characters in `s`, and what they spell where that can be read: { count, reads }.
 * `count` leaves out the honest ones: a joiner inside an emoji, a variation selector on its
 * own after a character, a flag's tags. A few quiet spaces copied in from a web page aren't
 * counted until there are enough of them to carry a message.
 */
export function hiddenIn(s){
  const chars = [...String(s ?? '')];
  let strong = 0, weak = 0, tags = '', run = [];
  const runs = [];
  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i].codePointAt(0);
    if (VS(cp)) { run.push(cp); continue; }
    if (run.length) { runs.push(run); run = []; }
    if (TAG(cp)) {
      // 🏴 and a few tags ending in the cancel tag is a flag (Scotland, Wales, England).
      let j = i; while (j < chars.length && TAG(chars[j].codePointAt(0))) j++;
      const flag = i > 0 && chars[i - 1].codePointAt(0) === BLACK_FLAG && j - i <= 7 && chars[j - 1].codePointAt(0) === 0xE007F;
      if (!flag) { strong += j - i; tags += chars.slice(i, j).map(c => c.codePointAt(0)).filter(c => c >= 0xE0020 && c <= 0xE007E).map(c => String.fromCharCode(c - 0xE0000)).join(''); }
      i = j - 1;
    } else if (BIDI(cp) || OPERATOR(cp)) strong++;
    else if (QUIET(cp)) weak++;
    else if (cp === 0x200D && !(PICTURE.test(chars[i - 1] || '') && PICTURE.test(chars[i + 1] || ''))) weak++;
  }
  if (run.length) runs.push(run);
  // Variation selectors one after another carry bytes (emoji smuggling): 16 of one kind, 240 of the other.
  let smuggled = '';
  for (const r of runs.filter(r => r.length > 1)) {
    strong += r.length;
    const bytes = r.map(cp => cp <= 0xFE0F ? cp - 0xFE00 : cp - 0xE0100 + 16);
    try { smuggled += new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); } catch (_) { /* not text */ }
  }
  const reads = (tags + ' ' + smuggled).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return { count: strong || weak >= 4 ? strong + weak : 0, reads };
}

// Words that would fit a request for help, kept from tripping the checks for harm: a phishing
// detector is fine to build.
const NOT_HARM = String.raw`(?![\s-]*(detect|detection|detector|filter|classif|aware|protect|scan|defen|block|report|prevent))`;

const RULES = [
  { id: 'override', level: 'high',
    said: 'It talks to the agent as if it could change the agent’s own rules (“ignore your previous instructions” and the like). An honest ask has no need to.',
    test: [
      /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,30}\b(previous|prior|above|earlier|preceding|original|system|safety|your|all)\b[^.\n]{0,20}\b(instructions?|guardrails?|directives?)\b/i,
      // ("Prompts" alone are often a CLI's: a build that ignores all prompts is fine.)
      /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,30}\b(previous|prior|above|earlier|preceding|original|system|your)\b[^.\n]{0,10}\bprompts?\b/i,
      /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,20}\b(your|previous|prior|system|safety)\b[^.\n]{0,15}\b(rules|guidelines|polic(y|ies)|restrictions|constraints|training)\b/i,
      /\byou(['’]re| are) now (no longer|free (from|of)|DAN\b|in (developer|god|unrestricted|jailbreak) mode|an? (unrestricted|unfiltered|uncensored|jailbroken|evil) )/i,
      /\bfrom now on,? you (are|will|must|should) (ignore|disregard|obey|act as|only follow|follow only|pretend)\b/i,
      /\b(act as|pretend to be|you are) (an? )?(unrestricted|unfiltered|uncensored|jailbroken)\b|\bDAN mode\b|\bdeveloper mode (enabled|on)\b|\bjailbroken (ai|assistant|model|agent|mode)\b/i,
      /^\s*\[?(SYSTEM|ASSISTANT)\]?\s*:/m,
      /^\s*(system|developer) (message|prompt|instructions?)\s*:/im,
      /<\/?\s*(system|system-reminder|instructions?|im_start|im_end|tool_call|tool_result|function_calls?|function_results?|antml:[\w-]+)\s*>/i,
      /<\|(im_start|im_end|system|assistant|user|endoftext|eot_id|start_header_id)\|>|\[\/?INST\]|<<\/?SYS>>/i
    ] },
  { id: 'secrecy', level: 'high',
    said: 'It asks the agent to keep something from you. An agent working for you should tell you everything it does.',
    test: [
      /\b(don['’]?t|do not|never|without)\s+(tell|inform|ask|mention|notify|alert|show|let)\w*\s+(your (user|human|operator|owner)|the (human|operator))\b/i,
      /\bhide (this|it|these|that|the (change|commit|code|step|command)s?) from (your|the) (user|human|reviewer|operator)\b/i
    ] },
  { id: 'hidden', level: 'high',
    said: 'It has characters you can’t see, which an agent still reads. Rainshare takes them out of the brief, but ask why they’re there.' },
  { id: 'secrets', level: 'high',
    said: 'It reaches for secrets on the helper’s machine: SSH keys, cloud or package credentials, or everything in the environment.',
    test: [
      /(~|\$HOME|\$\{HOME\}|%USERPROFILE%|\/home\/[\w.-]+|\/Users\/[\w.-]+|\/root)[\\/]\.(ssh|aws|gnupg|kube|docker|azure|npmrc|pypirc|netrc|git-credentials|config[\\/](gh|gcloud))\b/i,
      /\bid_(rsa|ed25519|ecdsa|dsa)\b(?!\.pub)/,
      /\.git-credentials\b|\/etc\/shadow\b|\bwallet\.dat\b/i,
      /\b(printenv\b|env\s*[|>]\s*\S|Get-ChildItem\s+env:|gci\s+env:|JSON\.stringify\(\s*process\.env\s*\)|dict\(\s*os\.environ\s*\)|os\.environ\.copy\(\))/i
    ] },
  { id: 'remote-code', level: 'high',
    said: 'It has the agent download something and run it straight away. Code from somewhere else should be read before it runs.',
    test: [
      /\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\n|;]{0,200}\|\s*(sudo\s+)?(ba|z|da|k|fi)?sh\b/i,
      /\b(curl|wget)\b[^\n|;]{0,200}\|\s*(sudo\s+)?(python3?|node|perl|ruby|php)\b/i,
      /\b(ba|z)?sh\s+(-c\s+)?["']?\$\(\s*(curl|wget)\b/i,
      /\b(ba|z)?sh\s+<\(\s*(curl|wget)\b/i,
      /\b(iex|Invoke-Expression)\s*[(\s]\s*\(?\s*(iwr|irm|Invoke-WebRequest|Invoke-RestMethod|New-Object\s+Net\.WebClient)/i,
      /\bpowershell(\.exe)?\b[^\n]{0,60}\s-(e|enc|encodedcommand)\s+[A-Za-z0-9+/=]{16,}/i,
      /\bbase64\s+(-d|--decode|-D)\b[^\n]{0,60}\|\s*(ba|z)?sh\b/i,
      /\beval\s*\(\s*(atob|Buffer\.from)\s*\(/i,
      /\bexec\s*\(\s*(base64\.b64decode|urllib|requests\.get|__import__\(\s*['"](base64|urllib))/i
    ] },
  { id: 'collector', level: 'high',
    said: 'It names a service that collects whatever is sent to it (webhook.site and the like), which is how stolen secrets usually leave a machine.',
    test: [
      /\b(webhook\.site|requestbin\.(com|net)|pipedream\.net|interact\.sh|oast\.(pro|live|site|online|fun|me)|burpcollaborator\.net|canarytokens\.(com|org)|hookbin\.com|beeceptor\.com|requestcatcher\.com|postb\.in|transfer\.sh|0x0\.st|termbin\.com)\b/i,
      /\bdiscord(app)?\.com\/api\/webhooks\/|\bapi\.telegram\.org\/bot/i
    ] },
  { id: 'permissions', level: 'high',
    said: 'It asks for the agent’s own safety checks to be turned off. Keep them on for someone else’s ask.',
    test: [
      /--dangerously-skip-permissions|\bbypassPermissions\b|--dangerously-bypass-approvals-and-sandbox|--yolo\b/i,
      /\b(turn off|disable|skip|bypass|ignore)\s+(all\s+)?your\s+(permission|approval|confirmation|safety)\s+(prompts?|checks?|requests?|rules?)/i,
      /\b(turn off|disable|escape|break out of|leave)\s+(your|the agent['’]?s?)\s+sandbox\b/i
    ] },
  { id: 'destructive', level: 'high',
    said: 'It has a command that wipes far more than a repository (rm -rf ~ and the like).',
    test: [
      /\brm\s+-[a-z]*r[a-z]*\s+(--no-preserve-root\s+)?(~|\/|\$HOME)(\/?\*?)(?=\s|$|["'`;&|)])/im,
      /\bmkfs(\.\w+)?\s+\/dev\/|\bdd\s+if=[^\n]{0,60}of=\/dev\/(sd|nvme|disk|hd)|:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/i
    ] },
  { id: 'backdoor', level: 'high',
    said: 'It would let someone into the helper’s machine: a key added to authorized_keys, or sudo with no password.',
    test: [/\bauthorized_keys\b|\/etc\/sudoers\b|\bNOPASSWD\b/] },
  { id: 'send-secrets', level: 'look',
    said: 'It talks about sending keys, tokens or passwords somewhere. Check where they’d go and whose they are.',
    // Only with somewhere to send them: an ask that says to send a token in a header is fine.
    test: [new RegExp(String.raw`\b(api[ _-]?keys?|access tokens?|tokens|secrets|credentials|passwords|private keys?|ssh keys?|seed phrases?|cookies|env(ironment)? (var(iable)?s|file)|\.env)\b[^.\n]{0,50}\b(to|into|at)\s+(me\b|https?:\/\/|(my|our|this|that|a) (own |private |personal )?(server|endpoint|webhook|url|address|email|inbox|discord|telegram|gist|pastebin|bucket)\b)`, 'i')] },
  { id: 'encoded', level: 'look',
    said: 'It has a long encoded blob. Ask what it decodes to before your agent touches it.',
    test: [/[A-Za-z0-9+/]{160,}={0,2}/, /\b[0-9a-f]{200,}\b/i, /(\\x[0-9a-f]{2}){20,}/i, /fromCharCode\(\s*\d+(\s*,\s*\d+){15,}/] },
  { id: 'agent-setup', level: 'look',
    said: 'It asks for changes to your agent’s own setup, outside the repository: its settings, or a tool server added to it.',
    test: [/(~|\$HOME|%USERPROFILE%)[\\/]\.(claude|codex|cursor|gemini|aider|continue|config[\\/](claude|codex|opencode|goose))\b/i, /\b(claude|codex|gemini)\s+mcp\s+add\b/i] },
  { id: 'machine', level: 'look',
    said: 'It has commands that reach past the repository into the machine itself (sudo, crontab, shell profiles, system files).',
    test: [/\bsudo\s+(?!apt(-get)?\s+install|dnf\s+install|yum\s+install|pacman\s+-S|zypper\s+install|apk\s+add)\S/, /\bcrontab\s+-|\blaunchctl\s+(load|bootstrap)\b|\bsystemctl\s+(enable|start)\b/i, /(~|\$HOME)[\\/]\.(bashrc|zshrc|profile|bash_profile|zprofile|zshenv)\b/, /\/etc\/(hosts|passwd|profile|crontab|rc\.local)\b/, /\breg(\.exe)?\s+add\s+HK/i] },
  { id: 'harmful', level: 'look',
    said: 'It mentions something AI plans’ usage policies usually rule out (malware, phishing, attacks on others). Read it before your agent does: what it asks for is on your plan.',
    test: [new RegExp(String.raw`\b(keyloggers?|ransomware|cryptojack\w*|info[- ]?stealers?|credential (stealer|harvester)s?|password stealers?|botnets?|rootkits?|spyware|stalkerware|phishing (pages?|sites?|kits?|emails?|campaigns?)|(ddos|dos) (tools?|scripts?|bots?)|sms bomb\w*|(evade|bypass|disable) (antivirus|anti-virus|edr|windows defender|defender)|captcha (solver|bypass)|account (checker|cracker)s?|aimbots?|wallhacks?)\b${NOT_HARM}`, 'i')] }
];
export const LEVELS = ['high', 'look'];
const ORDER = new Map(RULES.map((r, i) => [r.id, i]));

/** One line of what matched, for people to read: control and hidden characters out, cut to `max`. */
const quoteOf = (s, max = 80) => {
  const t = String(s).replace(INVISIBLE, '').replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
};

/**
 * What's worth a look in an ask (a seed's value), worst first: [{ id, level, said, quote }].
 * `said` is Rainshare's own sentence, safe to hand an agent. `quote` is the asker's words that
 * set it off, for people only. Reads the title, the spec, the notes and the longer spec's link.
 */
export function concerns(value){
  const v = value && typeof value === 'object' ? value : {};
  const text = [v.title, v.spec, v.wants?.notes, v.specUrl].filter(x => typeof x === 'string').join('\n');
  if (!text.trim()) return [];
  const out = [];
  for (const rule of RULES) {
    if (rule.id === 'hidden') {
      const h = hiddenIn(text);
      if (h.count) out.push({ id: rule.id, level: rule.level, said: rule.said, quote: h.reads ? `hidden text that reads “${quoteOf(h.reads, 120)}”` : `${h.count} hidden character${h.count === 1 ? '' : 's'}` });
      continue;
    }
    for (const re of rule.test) {
      const m = text.match(re);
      if (m) { out.push({ id: rule.id, level: rule.level, said: rule.said, quote: quoteOf(m[0]) }); break; }
    }
  }
  return out.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || ORDER.get(a.id) - ORDER.get(b.id));
}
/** Whether any of `list` (from concerns) is one that's very likely a trick. */
export const alarming = list => (list || []).some(c => c.level === 'high');
