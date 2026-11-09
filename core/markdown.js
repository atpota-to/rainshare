// A small, safe Markdown renderer for specs: everything is escaped first, then a few
// constructs are turned back on (headings, lists, code, emphasis, links to http(s) only).
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function inline(s){
  const codes = [];
  let t = esc(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, text, href) => `<a href="${href}" target="_blank" rel="noopener nofollow">${text}</a>`)
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, pre, href) => `${pre}<a href="${href}" target="_blank" rel="noopener nofollow">${href}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\n]+)_(?=[^_\w]|$)/g, '$1<em>$2</em>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
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
      out.push(`<li>${box ? `<span class="rs-box" aria-label="${box[1] === ' ' ? 'To do' : 'Done'}">${box[1] === ' ' ? '☐' : '☑'}</span> ${inline(box[2])}` : inline(li[3])}</li>`);
      continue;
    }
    if (/^>\s?/.test(line)) { flush(); close(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue; }
    if (!line.trim()) { flush(); close(); continue; }
    close(); para.push(line);
  }
  flush(); close();
  return out.join('');
}
