// What shows while something is on its way: the same cards, rows and pictures as the real
// screens, as soft blocks with a light passing over them. Each is laid out by the real
// screen's own classes (.rs-item, .rs-detail, .rs-seed…), so a placeholder is the size and
// shape of what replaces it and nothing jumps when it arrives. ./rainshare.js swaps them for
// the real thing, and lets them dissolve as it does.
//
// A region of placeholders is marked data-rs-sk with its name ("board", "seed", "garden"…):
// that's what dissolves when the part it stands for arrives. They're hidden from screen
// readers, which are told once, in words, that it's loading.
const line = (w, cls = '') => `<i class="rs-sk rs-sk-line${cls ? ' ' + cls : ''}" style="--w:${w}"></i>`;
const face = (cls = '') => `<i class="rs-sk rs-sk-face${cls ? ' ' + cls : ''}"></i>`;
const plant = px => `<i class="rs-sk rs-sk-plant" style="--rs-plant:${px}px"></i>`;
const pill = w => `<i class="rs-sk rs-sk-pill" style="--w:${w}px"></i>`;
const said = text => `<span class="rs-sr" role="status">${text}</span>`;
const pick = (list, i) => list[i % list.length];

// One card on the board: who across the top, then the title and the start of the ask beside its plant.
const CARDS = [['34%', '78%', '62%'], ['28%', '58%', '44%'], ['40%', '86%', '70%'], ['30%', '66%', '38%'], ['36%', '50%', '56%']];
export const cardSk = (i = 0) => {
  const [who, title, ask] = pick(CARDS, i);
  return `<li aria-hidden="true"><div class="rs-item rs-sk-item">
    <span class="rs-item-top">${face('xs')}${line(who)}</span>
    <span class="rs-item-main">
      ${line(title, 'rs-sk-title')}
      <span class="rs-item-ask">${line('96%', 'rs-sk-meta')}${line(ask, 'rs-sk-meta')}</span>
    </span>
    ${plant(52)}
  </div></li>`;
};
export const cardsSk = n => Array.from({ length: n }, (_, i) => cardSk(i)).join('');

// "Where", "The job", "Models"…: a label and what it says, row by row.
const LABELS = ['44px', '58px', '52px', '36px', '64px'], VALUES = ['56%', '74%', '32%', '24%', '48%'];
const factsSk = (n, cls = '') => `<dl class="rs-facts${cls ? ' ' + cls : ''}">${Array.from({ length: n }, (_, i) => `<dt>${line(pick(LABELS, i))}</dt><dd>${line(pick(VALUES, i))}</dd>`).join('')}</dl>`;
const askSk = () => `<div class="rs-ask">${line('56px')}${line('96%')}${line('88%')}${line('52%')}</div>`;

// The one you picked, beside the list: who, its title and plant, how it suits you, the facts, the ask, what to do.
export const detailSk = ({ fit = false } = {}) => `<article class="rs-detail" aria-hidden="true">
  <div class="rs-detail-top">${face()}${line('32%')}</div>
  <div class="rs-seed-head"><div class="rs-seed-title">${line('84%', 'rs-sk-h2')}${line('46%', 'rs-sk-h2')}${line('38%')}</div>${plant(88)}</div>
  ${fit ? '<i class="rs-sk rs-sk-box"></i>' : ''}
  ${factsSk(fit ? 5 : 4)}
  ${askSk()}
  <div class="rs-row rs-detail-actions">${pill(156)}${pill(172)}${pill(92)}</div>
</article>`;

/** The board's heading, before it's known who's looking. */
export const headSk = () => `<header class="rs-head" aria-hidden="true"><div class="rs-sk-stack">${line('min(420px,80%)', 'rs-sk-h1')}${line('min(280px,60%)')}</div></header>`;
/** A few cards, for a list that's still being read. */
export const listSk = (n, key) => `<ul class="rs-list" data-rs-sk="${key}">${cardsSk(n)}</ul>`;

/** The board: its list, and the picked one beside it (which a phone keeps tucked away). */
export const boardSk = ({ fit = false } = {}) => `<div class="rs-split" data-rs-sk="board">
  <ul class="rs-list">${cardsSk(5)}</ul>
  <div class="rs-side rs-sk-side">${detailSk({ fit })}</div>
</div>${said('Looking across the network…')}`;

/** One ask's page: the ask itself, and whoever asked beside it. */
export const seedSk = () => `<div class="rs-seed" data-rs-sk="seed" aria-hidden="true">
  <div class="rs-seed-main">
    <div class="rs-seed-head"><div class="rs-detail-top">${face()}${line('180px')}</div>
      <div class="rs-seed-title">${line('78%', 'rs-sk-h1')}${line('44%', 'rs-sk-h1')}${line('210px')}</div>${plant(120)}</div>
    ${factsSk(4)}
    ${askSk()}
    <div class="rs-row">${pill(176)}${pill(96)}</div>
  </div>
  <div class="rs-seed-side"><div class="rs-panel">${line('120px', 'rs-sk-h3')}${line('92%')}${line('70%')}${factsSk(2, 'rs-facts-sm')}${line('96px')}</div></div>
</div>${said('Loading…')}`;

/** Someone's page: who they are, what they've said, what they've helped with, what they've asked for. */
export const personSk = () => `<section class="rs-person" data-rs-sk="person" aria-hidden="true">
  <header>${face('lg')}<div class="rs-sk-stack">${line('220px', 'rs-sk-h2')}${line('140px')}</div></header>
  <div class="rs-panel">${line('88%')}${line('62%')}${factsSk(2, 'rs-facts-sm')}</div>
  ${line('200px', 'rs-sk-h3')}
  ${activitySk()}
  ${line('140px', 'rs-sk-h3')}
  ${gardenSk()}
  ${line('220px', 'rs-sk-h3')}
  <ul class="rs-list">${cardsSk(2)}</ul>
</section>${said('Looking them up…')}`;

/** A garden: a line saying what's in it, and a plant for each. */
export const gardenSk = () => `<div class="rs-panel" data-rs-sk="garden" aria-hidden="true">${line('58%')}<div class="rs-sk-row">${plant(76)}${plant(76)}${plant(76)}</div>${line('74%')}</div>`;

/** What someone's been doing: a few rows, each a plant beside a line and the steps under it. */
export const activitySk = () => `<div class="rs-panel" data-rs-sk="activity" aria-hidden="true">${[['62%', '40%'], ['48%', '56%'], ['70%', '34%']].map(([a, b]) => `<div class="rs-sk-row rs-sk-act">${plant(40)}<div class="rs-sk-stack">${line(a)}${line(b)}</div></div>`).join('')}</div>`;

/** Your profile: the form's sections, and your garden beside it. */
export const meSk = () => `<div class="rs-me-wrap" data-rs-sk="me" aria-hidden="true">
  <div class="rs-form">${line('190px', 'rs-sk-h1')}${line('62%')}
    ${['150px', '110px', '130px'].map(w => `<div class="rs-sk-group">${line(w, 'rs-sk-h3')}${line('78%')}<i class="rs-sk rs-sk-field"></i></div>`).join('')}
  </div>
  <div class="rs-me-side">${line('170px', 'rs-sk-h3')}${gardenSk()}</div>
</div>${said('Loading your profile…')}`;
