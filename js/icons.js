// Tiny pixel icons for the battle screen: unit types, statuses, buffs, telegraphs, matchup arrows, and a
// 3x5 digit font for the turns a status has left. Each icon is a small bitmap drawn in a colour with a
// dark outline, cached on first use.
import { ctx, canvas } from './gfx.js?v=11';

const G = {
  // unit types (7x7)
  inf: ['......#', '.....#.', '....#..', '.#.#...', '..#....', '.#.#...', '#......'],
  cav: ['..###..', '.#...#.', '#.....#', '#.....#', '#.....#', '##...##', '.......'],
  arc: ['.##....', '#..#...', '#...#..', '#######', '#...#..', '#..#...', '.##....'],
  nav: ['...#...', '...##..', '...###.', '...#...', '#######', '.#####.', '..###..'],
  // statuses (5x5)
  confuse: ['.###.', '...#.', '..#..', '.....', '..#..'],
  stun: ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
  sleep: ['#####', '...#.', '..#..', '.#...', '#####'],
  fear: ['..#..', '..#..', '..#..', '.....', '..#..'],
  burn: ['..#..', '.##..', '.###.', '#####', '.###.'],
  poison: ['..#..', '.###.', '#####', '#####', '.###.'],
  silence: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  curse: ['.###.', '#.#.#', '#####', '.###.', '.#.#.'],
  provoke: ['#.#..', '.#...', '#.#.#', '...#.', '..#.#'],
  up: ['..#..', '.###.', '#####', '..#..', '..#..'],
  down: ['..#..', '..#..', '#####', '.###.', '..#..'],
  // telegraphs and stances (7x7)
  charge: ['..###..', '..###..', '..###..', '..###..', '.......', '..###..', '..###..'],
  mark: ['...#...', '.#####.', '.#.#.#.', '###.###', '.#.#.#.', '.#####.', '...#...'],
  mirror: ['...#...', '..#.#..', '.#...#.', '#..#..#', '.#...#.', '..#.#..', '...#...'],
  wall: ['#######', '#.#.#.#', '#######', '#.#.#.#', '#######', '.#####.', '..###..'],
  ice: ['#..#..#', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '#..#..#'],
  guard: ['#######', '#.....#', '#.###.#', '#.###.#', '.#...#.', '..#.#..', '...#...'],
  veil: ['.#.#.#.', '#.#.#.#', '.......', '.#.#.#.', '#.#.#.#', '.......', '.#.#.#.'],
  berserk: ['#..#..#', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '#..#..#'],
  // matchups (5x5)
  good: ['..#..', '.###.', '#####', '.###.', '.###.'],
  bad: ['.###.', '.###.', '#####', '.###.', '..#..'],
};
export const ICON_COL = {
  inf: '#d8d0b0', cav: '#f0b860', arc: '#a0e070', nav: '#70c0ff',
  confuse: '#e080ff', stun: '#ffe060', sleep: '#80b0ff', fear: '#d0d0d0', burn: '#ff9040', poison: '#a0e060', silence: '#60e0d0', curse: '#d050d0', provoke: '#ff6050', defdown: '#ff9070',
  atkup: '#ff8060', defup: '#80b0ff', spdup: '#80f0ff', atkdown: '#ff8060',
  charge: '#ffe040', mark: '#ff5040', mirror: '#c0f0ff', wall: '#c0b8a8', ice: '#a0e8ff', guard: '#90c0ff', veil: '#c090ff', berserk: '#ff4030',
  good: '#60f080', bad: '#ff6060',
};
const cache = {};
function bake(name, col) {
  const k = name + col;
  if (cache[k]) return cache[k];
  const rows = G[name], h = rows.length, w = rows[0].length;
  const c = canvas(w + 2, h + 2), g = c.x;
  const on = (x, y) => rows[y] && rows[y][x] === '#';
  g.fillStyle = '#100810';
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) g.fillRect(x + 1, y + 1, 1, 1);
  g.fillStyle = col;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) g.fillRect(x + 1, y + 1, 1, 1);
  return (cache[k] = c);
}
// draw an icon with its top-left at x, y; returns its width
export function icon(name, x, y, col) {
  const glyph = G[name] ? name : null;
  if (!glyph) return 0;
  const c = bake(glyph, col || ICON_COL[name] || '#ffffff');
  ctx.drawImage(c, Math.round(x), Math.round(y));
  return c.width;
}
// 3x5 digits for the turns left on a status
const D = ['###,#.#,#.#,#.#,###', '.#.,##.,.#.,.#.,###', '###,..#,###,#..,###', '###,..#,.##,..#,###', '#.#,#.#,###,..#,..#', '###,#..,###,..#,###', '###,#..,###,#.#,###', '###,..#,..#,.#.,.#.', '###,#.#,###,#.#,###', '###,#.#,###,..#,###'].map((s) => s.split(','));
export function digits(n, x, y, col = '#ffffff') {
  const s = String(n);
  ctx.fillStyle = '#100810';
  for (let i = 0; i < s.length; i++) { const d = D[+s[i]]; if (!d) continue; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (d[r][c] === '#') ctx.fillRect(x + i * 4 + c + 1, y + r + 1, 1, 1); }
  ctx.fillStyle = col;
  for (let i = 0; i < s.length; i++) { const d = D[+s[i]]; if (!d) continue; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (d[r][c] === '#') ctx.fillRect(x + i * 4 + c, y + r, 1, 1); }
  return s.length * 4;
}
