#!/usr/bin/env node
// Generates the README's "Worked with" / "Planned" cards from the data below.
//   node scripts/stack-cards.mjs   → rewrites assets/worked-with.svg + assets/planned.svg, syncs their README alt text
// Zero dependencies. Palette = github-readme-stats "tokyonight" (same as the trophies/stats cards above them).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ─── data ────────────────────────────────────────────────────────────────────

const DOMAINS = [
  {
    title: 'Languages', rows: [
      { label: '', items: ['TypeScript', 'JavaScript', 'Java', 'SQL'] },
    ],
  },
  {
    title: 'Frontend', rows: [
      { label: 'Frameworks', items: ['React', 'Preact', 'Astro'], note: 'SSG → SPA · SSR + ISR' },
      { label: 'State', items: ['Redux', 'Saga', 'Thunk', 'Jotai', 'Nanostores'] },
      { label: 'Markup / styles', items: ['HTML', 'CSS', 'Sass', 'Tailwind'] },
      { label: 'UI kits', items: ['Bootstrap', 'Chakra', 'MUI', 'Radix', 'shadcn/ui'] },
      { label: 'Build', items: ['Vite', 'esbuild', 'Webpack'] },
      { label: 'Architecture', items: ['Feature-Sliced Design'] },
    ],
  },
  {
    title: 'Backend', rows: [
      { label: 'Runtime', items: ['Node.js'] },
      { label: 'Frameworks', items: ['NestJS', 'Fastify', 'Express', 'Spring Boot'] },
      { label: 'API docs', items: ['Swagger'] },
      { label: 'Data', items: ['PostgreSQL', 'MongoDB', 'Redis', 'SQLite'] },
      { label: 'ORM / migrations', items: ['TypeORM', 'Flyway'] },
      { label: 'Messaging', items: ['RabbitMQ', 'SQS'] },
    ],
  },
  {
    title: 'Infra & Ops', rows: [
      { label: 'Containers', items: ['Docker', 'Compose', 'Kubernetes'] },
      { label: 'GitOps / CI', items: ['Argo CD', 'GitHub Actions'] },
      { label: 'Cloud', items: ['AWS'], note: 'CF · ECS · ASG · LB · VPC · NAT …' },
      { label: 'Proxy / hosting', items: ['Nginx', 'VPS', 'GitHub Pages', 'Heroku'] },
      { label: 'Observability', items: ['Prometheus', 'Grafana', 'Loki', 'Fluentd'] },
    ],
  },
  {
    title: 'Scraping', rows: [
      { label: 'Browsers', items: ['Puppeteer', 'Playwright', 'Camoufox'] },
      { label: 'TLS fingerprint', items: ['curl-impersonate', 'JA3/4'] },
    ],
  },
  {
    title: 'Reverse eng.', rows: [
      { label: 'Android', items: ['adb', 'frida'] },
    ],
  },
];

// Plans only: once something gets used it moves into DOMAINS.
const PLANNED = ['Proper frontend testing', 'GraphQL', 'Go', 'Next.js'];

// ─── style ───────────────────────────────────────────────────────────────────

const TN = {
  bg: '#1a1b27', title: '#70a5fd', icon: '#bf91f3', text: '#38bdae', border: '#e4e2e2',
  label: '#8a94c4', note: '#9aa5ce', rule: '#2b2f45',
};
const SANS = "'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
const CW = 7.2; // 12px monospace advance (0.6em); textLength pins it so layout holds on any font
const NW = 6.6; // 11px monospace advance

const CARD_W = 634; // = wakatime (255) + top-langs (375) row above, so the edges line up
const PX = 25, ROW = 26, GAP = 6, MAX_X = CARD_W - PX, X_LBL_END = 205, X_CHIPS = 215;

// ─── render ──────────────────────────────────────────────────────────────────

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');
const allTech = DOMAINS.flatMap((d) => d.rows.flatMap((r) => r.items));

function chip(x, y, label, cls = 'c') {
  const tw = [...label].length * CW;
  const w = tw + 14;
  return {
    w,
    svg: `<rect class="${cls}" x="${x}" y="${y}" width="${w.toFixed(1)}" height="20" rx="4"/>`
      + `<text class="${cls}t" x="${x + 7}" y="${y + 14}" textLength="${tw.toFixed(1)}">${esc(label)}</text>`,
  };
}

function svgFrame(w, h, title, desc, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(desc)}</desc>
<style>
  .ttl { font: 600 18px ${SANS}; fill: ${TN.title}; }
  .dom { font: 700 11px ${SANS}; fill: ${TN.icon}; letter-spacing: .08em; }
  .lbl { font: 400 12px ${SANS}; fill: ${TN.label}; }
  .nt { font: italic 400 11px ${MONO}; fill: ${TN.note}; }
  .c { fill: rgba(56, 189, 174, .08); stroke: rgba(56, 189, 174, .38); }
  .ct { font: 400 12px ${MONO}; fill: ${TN.text}; }
  .cp { fill: rgba(191, 145, 243, .06); stroke: rgba(191, 145, 243, .6); stroke-dasharray: 4 3; }
  .cpt { font: 400 12px ${MONO}; fill: ${TN.icon}; }
  .rule { stroke: ${TN.rule}; }
  .r { animation: in .45s ease-out backwards; }
  @keyframes in { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .r { animation: none; } }
</style>
<rect x="0.5" y="0.5" rx="4.5" width="${w - 1}" height="${h - 1}" fill="${TN.bg}" stroke="${TN.border}" stroke-opacity="1"/>
<text class="ttl" x="25" y="35">${esc(title)}</text>
${body}
</svg>
`;
}

// grid rows: domain label | area label | chips (wrap within the chip column)
function svgWorkedWith() {
  const parts = [];
  let y = 52, n = 0, x;
  for (const [di, d] of DOMAINS.entries()) {
    if (di > 0) parts.push(`<line class="rule" x1="${PX}" y1="${y - 6}" x2="${MAX_X}" y2="${y - 6}"/>`);
    d.rows.forEach((r, i) => {
      let g = '';
      if (i === 0) g += `<text class="dom" x="${PX}" y="${y + 14}">${esc(d.title.toUpperCase())}</text>`;
      if (r.label) g += `<text class="lbl" x="${X_LBL_END}" y="${y + 14}" text-anchor="end">${esc(r.label.toLowerCase())}</text>`;
      x = X_CHIPS;
      for (const t of r.items) {
        let c = chip(x, y, t);
        if (x > X_CHIPS && x + c.w > MAX_X) { y += ROW; x = X_CHIPS; c = chip(x, y, t); }
        g += c.svg; x += c.w + GAP;
      }
      if (r.note) {
        const nw = [...r.note].length * NW;
        if (x + nw + 2 > MAX_X) { y += ROW; x = X_CHIPS; }
        g += `<text class="nt" x="${x + 2}" y="${y + 14}" textLength="${nw.toFixed(1)}">${esc(r.note)}</text>`;
      }
      parts.push(`<g class="r" style="animation-delay:${n++ * 35}ms">${g}</g>`);
      y += ROW;
    });
    y += 10;
  }
  parts.push(`<text class="nt" x="${MAX_X}" y="${y + 4}" text-anchor="end">…and some others</text>`);
  return svgFrame(CARD_W, y + 22, 'Worked with', `Worked with: ${allTech.join(', ')}.`, parts.join('\n'));
}

// plans: dashed "not yet" chips on the title line, in the same chip column as the card above
function svgPlanned() {
  const parts = [];
  let x = X_CHIPS, y = 21, n = 0; // chip text baseline = title baseline (35)
  for (const p of PLANNED) {
    let c = chip(x, y, p, 'cp');
    if (x > X_CHIPS && x + c.w > MAX_X) { x = X_CHIPS; y += ROW; c = chip(x, y, p, 'cp'); }
    parts.push(`<g class="r" style="animation-delay:${n++ * 35}ms">${c.svg}</g>`);
    x += c.w + GAP;
  }
  return svgFrame(CARD_W, y + ROW + 14, 'Planned', `Planned: ${PLANNED.join(', ')}.`, parts.join('\n'));
}

// ─── write ───────────────────────────────────────────────────────────────────

mkdirSync(join(ROOT, 'assets'), { recursive: true });
writeFileSync(join(ROOT, 'assets', 'worked-with.svg'), svgWorkedWith());
writeFileSync(join(ROOT, 'assets', 'planned.svg'), svgPlanned());

// images aren't text: keep the README alt text listing the same items
const alts = {
  'worked-with.svg': `Worked with: ${allTech.join(', ')}`,
  'planned.svg': `Planned: ${PLANNED.join(', ')}`,
};
const readmePath = join(ROOT, 'README.md');
let readme = readFileSync(readmePath, 'utf8');
for (const [file, alt] of Object.entries(alts)) {
  const re = new RegExp(`(<img src="assets/${file.replace('.', '\\.')}" alt=")[^"]*(")`);
  if (!re.test(readme)) console.warn(`README: <img src="assets/${file}" alt="…"> not found, alt text not synced`);
  readme = readme.replace(re, (_, open, close) => open + attr(alt) + close);
}
writeFileSync(readmePath, readme);

console.log('wrote assets/worked-with.svg, assets/planned.svg');
