// Horse coats. The LPC horses come in five coats (brown, black, gray, white, golden); the famous horses' other
// coats (red, chestnut, blood bay, purple bay, dappled, sage) are those sheets shifted in hue, saturation and
// lightness once, on first use, and kept.
import { IMG } from './assets.js?v=11';
import { canvas } from './gfx.js?v=11';

const COATS = {
  red: ['brown', -18, 1.8, 1], chestnut: ['brown', -8, 1.3, 0.95], bloodbay: ['brown', -14, 1.5, 0.82], purple: ['brown', -48, 0.9, 0.78],
  dapple: ['gray', 0, 1, 1.14], sage: ['gray', 70, 1.4, 1.02],
};
const cache = {};
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
// the picture for a coat (an Image or a canvas), or null before the sheets have loaded
export function horseImg(coat) {
  if (!coat) coat = 'brown';
  if (IMG['h:' + coat]) return IMG['h:' + coat];
  if (cache[coat]) return cache[coat];
  const c = COATS[coat]; if (!c) return IMG['h:brown'];
  const base = IMG['h:' + c[0]]; if (!base) return null;
  const cv = canvas(base.width, base.height); cv.x.drawImage(base, 0, 0);
  const id = cv.x.getImageData(0, 0, base.width, base.height), d = id.data;
  const memo = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    let o = memo.get(k);
    if (!o) {
      const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
      // only the coat moves: very dark outline pixels and pale tack keep their colour
      o = l < 0.12 ? [d[i], d[i + 1], d[i + 2]] : hsl2rgb(h + c[1], Math.min(1, s * c[2] + (c[0] === 'gray' && c[1] ? 0.18 : 0)), Math.min(1, l * c[3]));
      memo.set(k, o);
    }
    d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
  }
  cv.x.putImageData(id, 0, 0);
  return (cache[coat] = cv);
}
export const HORSE_COAT_NAME = { brown: ['棕', 'brown'], black: ['黑', 'black'], gray: ['灰', 'grey'], white: ['白', 'white'], golden: ['金', 'golden'], red: ['赤', 'red'], chestnut: ['棗紅', 'chestnut'], bloodbay: ['血紅', 'blood bay'], purple: ['紫騮', 'purple bay'], dapple: ['花斑', 'dappled'], sage: ['青', 'sage'] };
