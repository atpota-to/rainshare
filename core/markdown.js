// A small, safe Markdown renderer for specs: everything is escaped first, then a few
// constructs are turned back on (headings, lists, code, emphasis, links to http(s) only).
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LINK = 'target="_blank" rel="noopener nofollow ugc"';

const emphasis = t => t
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g, '$1<em>$2</em>')
  .replace(/(^|[^_\w])_([^_\n]+)_(?=[^_\w]|$)/g, '$1<em>$2</em>');

function inline(s){
  // Code, links and bare addresses are set aside first, so emphasis can't reach into an
  // address and a link can't end up inside another. NULs in the text are dropped, so nothing
  // the writer types can pass for one of the placeholders.
  const kept = [], keep = html => `\u0000${kept.push(html) - 1}\u0000`;
  let t = esc(String(s).replace(/\u0000/g, ''))
    .replace(/`([^`]+)`/g, (_, c) => keep(`<code>${c}</code>`))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, text, href) => keep(`<a href="${href}" ${LINK}>${emphasis(text)}</a>`))
    // A bare address stops before the punctuation that ends a sentence.
    .replace(/(^|[\s(])(https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<)])*(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<).,;:!?]))/g, (_, pre, href) => pre + keep(`<a href="${href}" ${LINK}>${href}</a>`));
  t = emphasis(t);
  for (let i = 0; i < 3 && /\u0000\d+\u0000/.test(t); i++) t = t.replace(/\u0000(\d+)\u0000/g, (_, k) => kept[k] ?? '');
  return t;
}

export function renderMarkdown(src){
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n'), out = [];
  let list = null, para = [];
  const flush = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^```\s*([\w+-]*)\s*$/);
    if (fence) {
      flush(); close();
      const code = [];
      while (++i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flush(); close(); const n = Math.min(h[1].length + 2, 6); out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }
    const li = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/);
    if (li) {
      flush();
      const kind = li[1] ? 'ul' : 'ol';
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind; }
      const box = li[3].match(/^\[( |x|X)\]\s+(.*)$/);
      out.push(`<li>${box ? `<span class="rs-box" role="img" aria-label="${box[1] === ' ' ? 'To do' : 'Done'}">${box[1] === ' ' ? '☐' : '☑'}</span> ${inline(box[2])}` : inline(li[3])}</li>`);
      continue;
    }
    if (/^>\s?/.test(line)) { flush(); close(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue; }
    if (!line.trim()) { flush(); close(); continue; }
    close(); para.push(line);
  }
  flush(); close();
  return out.join('');
}
