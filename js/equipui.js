// The paper doll on screen: the equip page (a big figure that turns through four directions, the battle pose
// beside it, mounted when a horse is worn, each slot with its icon, stats before and after), trying things on
// from the bag or a shop counter, and the treasure codex (寶物錄) with its 300 entries.
import { ctx, W, H, text, textW, windowBox } from './gfx.js?v=7';
import { input } from './input.js?v=7';
import { sfx } from './audio.js?v=7';
import { menu, notice, fit, wrap, pushRaw, removeRaw, say } from './ui.js?v=7';
import { L } from './i18n.js?v=7';
import { GENERALS, genName } from './generals.js?v=7';
import { ITEMS, TACTICS, FORMS, SLOTS, SLOT_NAME, itemName, unitName, gearFx, fxText, setCount, SETS, RARITY, TREASURES, TREASURE_KIND, RELIC_FX, ONE_HAND } from './data.js?v=7';
import { S, member, stat, atkOf, defOf, troopsMax, canEquip, give, take, learnTactics, fitShield } from './state.js?v=7';
import { battleSheet } from './doll.js?v=7';
import { horseImg } from './horses.js?v=7';
import { drawItemIcon, itemIcon, warmIcons } from './itemicons.js?v=7';
import { hintText, owned, setTryOn } from './treasure_world.js?v=7';
import { traitName } from './traits.js?v=7';

// ---------- what an item does, in words ----------
export function itemDesc(id) {
  const it = ITEMS[id]; if (!it) return '';
  const p = [];
  if (it.atk) p.push(L(`攻擊+${it.atk}`, `ATK +${it.atk}`)); if (it.def) p.push(L(`防禦+${it.def}`, `DEF +${it.def}`)); if (it.int) p.push(L(`智力+${it.int}`, `INT +${it.int}`)); if (it.lead) p.push(L(`統率+${it.lead}`, `LEAD +${it.lead}`)); if (it.spd) p.push(L(`速度+${it.spd}`, `SPD +${it.spd}`));
  if (it.kind === 'weapon') p.unshift({ sword: L('劍刀', 'Sword'), twin: L('雙刀（不能持盾）', 'Twin blades (no shield)'), spear: L('槍', 'Spear'), halberd: L('戟（雙手）', 'Halberd (two hands)'), axe: L('斧', 'Axe'), mace: L('鞭錘', 'Mace'), bow: L('弓（雙手）', 'Bow (two hands)'), xbow: L('弩（雙手）', 'Crossbow (two hands)'), staff: L('杖扇（任何兵種可用）', 'Staff/fan (anyone)') }[it.cat]);
  if (it.kind === 'shield') p.unshift(L('盾牌（單手兵器才能用）', 'Shield (one-handed weapons only)'));
  if (it.kind === 'cape') p.unshift(L('披風', 'Cape'));
  if (it.kind === 'treasure') p.unshift(L('飾品', 'Accessory'));
  if (it.weakFire) p.push(L('怕火', 'Weak to fire'));
  if (it.naval) p.push(L('水戰有利', 'Good at sea'));
  if (it.fx && Object.keys(it.fx).length) p.push(fxText(it.fx));
  if (it.set) { const st = SETS[it.set], n = TREASURES.filter((x) => ITEMS[x].set === it.set).length; p.push(L(`「${st.zh}」套裝（${n}件）：`, `${st.en} set (${n}): `) + Object.entries(st.b).map(([k, c]) => `${k}${L('件', 'pc')} ${fxText(gearFxOf(c))}`).join(L('；', '; '))); }
  if (it.heal) p.push(it.target === 'all' ? L(`恢復全軍兵力${Math.round(it.heal * 100)}%`, `Restores ${Math.round(it.heal * 100)}% troops to all`) : L(`恢復兵力${Math.round(it.heal * 100)}%`, `Restores ${Math.round(it.heal * 100)}% troops`));
  if (it.revive) p.push(L('讓敗走的武將歸隊', 'Brings a routed general back'));
  if (it.tp) p.push(L('恢復策略值', 'Restores strategy points'));
  if (it.cure) p.push(L('戰鬥中：解除一名武將的混亂、恐懼、昏睡、封策與詛咒', 'In battle: lifts confusion, fear, sleep, sealed ploys and curses from one general'));
  if (it.fire) p.push(L('戰鬥中：火燒全部敵軍', 'In battle: burns all enemies'));
  if (it.escape) p.push(L('戰鬥中：撤退', 'In battle: escape'));
  if (it.repel) p.push(L('一段時間內少遇敵', 'Fewer battles for a while'));
  if (it.warp) p.push(L('回到上一座城', 'Return to the last town'));
  if (it.gift) p.push(L('送給武將的禮物，招降時有用', 'A gift that helps win generals over'));
  if (it.teach) p.push(L(`研讀可學會「${TACTICS[it.teach].zh}」`, `Teaches ${TACTICS[it.teach].en}`));
  if (it.form) p.push(L(`習得「${FORMS[it.form].zh}」`, `Teaches the ${FORMS[it.form].en} formation`));
  if (it.boost) p.push(L('研讀後永久提升：', 'Read it for good: ') + Object.entries(it.boost).map(([k, v]) => `${{ str: L('武力', 'STR'), int: L('智力', 'INT'), lead: L('統率', 'LEAD'), spd: L('速度', 'SPD') }[k]}+${v}`).join(' '));
  if (it.relic) p.push(L('戰具（每場戰鬥可用一次，不會消耗）：', 'War relic (once each battle, never used up): ') + L(RELIC_FX[it.relic][0], RELIC_FX[it.relic][1]));
  if (it.horse) p.push(L('坐騎：騎兵更強；地圖上可騎馬', 'A mount; ride it on the map'));
  if (it.kind === 'key') p.push(L('重要物品', 'Key item'));
  return p.join(L('，', ', '));
}
import { parseFx } from './treasures.js?v=7';
const gearFxOf = (code) => parseFx(code);

// ---------- the doll on stage ----------
const DIRS = [2, 1, 0, 3]; // walking rows shown in turn: facing you, left, away, right
const sheets = new Map();
function sheetFor(id, equip) {
  const g = GENERALS[id], key = id + JSON.stringify(equip);
  let s = sheets.get(key);
  if (!s) { s = { v: null }; sheets.set(key, s); battleSheet(g.look, equip, { quiver: g.quiver }).then((r) => { s.v = r; }); if (sheets.size > 40) sheets.delete(sheets.keys().next().value); }
  return s.v;
}
let T0 = 0;
// the figure turning on its spot: walking frames, one direction after another
export function drawTurning(id, equip, cx, feet, scale = 2) {
  const sh = sheetFor(id, equip); if (!sh) { text('…', cx, feet - 40, '#a09080', { align: 'center' }); return; }
  const m = sh.meta.walk, t = T0;
  const row = DIRS[Math.floor(t / 70) % 4], f = 1 + Math.floor(t / 6) % 8;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sh.img, f * m.cell, m.y + row * m.cell, m.cell, m.cell, cx - 32 * scale, feet - 60 * scale, 64 * scale, 64 * scale);
}
// the battle pose: on guard, then the weapon's swing, then a ploy; on horseback when a horse is worn
export function drawPose(id, equip, cx, feet, scale = 1) {
  const sh = sheetFor(id, equip); if (!sh) return;
  const seq = [['idle', 50], [sh.swing || 'slash', 0], ['cast', 0]];
  const t = T0 % 200;
  let a = 'idle', f = Math.floor(t / 25) % 2;
  const sw = sh.meta[sh.swing] ? sh.swing : 'slash', ns = sh.meta[sw] ? sh.meta[sw].n : 6;
  if (t >= 80 && t < 80 + ns * 5) { a = sw; f = Math.floor((t - 80) / 5); }
  else if (t >= 140 && t < 175) { a = 'cast'; f = Math.min(6, Math.floor((t - 140) / 5)); }
  void seq;
  const m = sh.meta[a] || sh.meta.idle; if (!m) return;
  const horse = equip.horse && ITEMS[equip.horse] ? ITEMS[equip.horse].horse : null;
  ctx.save(); ctx.translate(cx, feet); ctx.scale(scale, scale); ctx.imageSmoothingEnabled = false;
  if (horse) {
    const hi = horseImg(horse), fr = a === 'idle' ? 0 : 1, hfeet = 94, sx = 62, sy = 52;
    if (hi) ctx.drawImage(hi, fr * 128, 5 * 128, 128, 128, -59, 1 - hfeet, 128, 128);
    const off = (m.cell - 64) / 2, cut = 50, top = 1 - hfeet + sy - 44;
    ctx.drawImage(sh.img, f * m.cell, m.y, m.cell, off + cut, -59 + sx - m.cell / 2, top - off, m.cell, off + cut);
  } else ctx.drawImage(sh.img, f * m.cell, m.y, m.cell, m.cell, -m.cell / 2, -60 - (m.cell - 64) / 2, m.cell, m.cell);
  ctx.restore();
}
function stage(x, y, w, h) {
  ctx.fillStyle = '#18101c'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2a1e22'; ctx.fillRect(x, y + h - 14, w, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h - 10, 22, 4, 0, 0, 7); ctx.fill();
}
// the whole equip panel for a general: doll, slots, numbers. cand: the gear being tried; note: a line at the bottom
export function drawEquipPanel(id, cand, x0 = 160, hilite = null, note = null) {
  T0++;
  const m = member(id), g = GENERALS[id];
  const pw = W - 4 - x0, ph = H - 8;
  windowBox(x0, 4, pw, ph);
  const eq = cand || (m ? m.equip : g.gear) || {};
  // the turning figure and the battle pose
  stage(x0 + 6, 10, 104, 140);
  drawTurning(id, eq, x0 + 58, 142, 2);
  text(L('轉身', 'Turn'), x0 + 9, 12, '#806870');
  stage(x0 + 6, 154, 104, H - 166);
  drawPose(id, eq, x0 + (eq.horse ? 64 : 58), H - 18, eq.horse ? 0.84 : 1.25);
  text(L('戰鬥', 'Battle'), x0 + 9, 156, '#806870');
  // the slots
  const cx = x0 + 116, cw = pw - 122;
  text(fit(genName(g), cw - 74), cx, 10, '#f8e070'); text(unitName(g.unit), x0 + pw - 40, 10, '#c0d8f0', { align: 'right' });
  SLOTS.forEach((s, i) => {
    const y = 26 + i * 17, idn = eq[s], changed = cand && m && cand[s] !== m.equip[s];
    if (hilite === s) { ctx.fillStyle = 'rgba(248,224,112,0.16)'; ctx.fillRect(cx - 2, y - 2, cw, 17); }
    text(L(SLOT_NAME[s][0], SLOT_NAME[s][1]).slice(0, L(2, 4)), cx, y, '#9098b0');
    if (idn) drawItemIcon(idn, cx + L(28, 40), y - 2, 1, { frame: !!ITEMS[idn].tr });
    const blocked = s === 'shield' && eq.weapon && ITEMS[eq.weapon] && !ONE_HAND.has(ITEMS[eq.weapon].cat);
    text(fit(idn ? itemName(idn) : blocked ? L('（雙手兵器）', '(two-handed)') : '—', cw - L(48, 60)), cx + L(48, 60), y, changed ? '#80ffa0' : idn && ITEMS[idn].tr ? RARITY[ITEMS[idn].rar][2] : '#e8e8e8');
  });
  // numbers, before and after
  if (m) {
    const tmp = { ...m, equip: eq };
    const rows = [[L('攻擊', 'ATK'), atkOf(m), atkOf(tmp)], [L('防禦', 'DEF'), defOf(m), defOf(tmp)], [L('智力', 'INT'), stat(m, 'int'), stat(tmp, 'int')], [L('統率', 'LEAD'), stat(m, 'lead'), stat(tmp, 'lead')], [L('速度', 'SPD'), stat(m, 'spd'), stat(tmp, 'spd')], [L('兵力', 'TRP'), troopsMax(m), troopsMax(tmp)]];
    const trp = `${m.troops}/${troopsMax(m)}`;
    const half = Math.floor(cw / 2);
    rows.forEach(([k, a, b], i) => {
      // the troops get a whole line: now/max, and the new max if the gear changes it
      const full = i === 5, x = full ? cx : cx + (i % 2) * half, y = full ? 185 : 146 + Math.floor(i / 2) * 13;
      text(k, x, y, '#c8c8d8');
      let show = full ? (cand && b !== a ? `${m.troops}/${a}→${b}` : trp) : cand && b !== a ? `${a}→${b}` : String(a);
      // a narrow panel shows just the new number with an arrow
      if (!full && textW(show) + textW(k) + 8 > half) show = (b > a ? '▲' : '▼') + b;
      text(show, full ? cx + cw - 6 : x + half - 6, y, cand && b > a ? '#80ffa0' : cand && b < a ? '#ff8080' : '#ffffff', { align: 'right' });
    });
    // what the gear does together (effects and sets)
    const fx = fxText(gearFx(eq)), sets = Object.entries(setCount(eq)).filter(([k, n]) => n >= 2 && SETS[k]).map(([k, n]) => L(`${SETS[k].zh}${n}件`, `${SETS[k].en} x${n}`));
    let y = 201;
    const trs = (g.traits || []).map((t) => traitName(t)).join(L('、', ', '));
    const body = note || [trs ? L('特性：', 'Traits: ') + trs : '', sets.length ? L('套裝：', 'Sets: ') + sets.join(' ') : '', fx ? L('效果：', 'Effects: ') + fx : L('效果：無', 'Effects: none')].filter(Boolean).join('\n');
    for (const ln of wrap(body, cw).slice(0, 5)) { if (y > H - 20) break; text(ln, cx, y, note ? '#e8e0c8' : '#a8e0b0'); y += 14; }
  }
}
// ---------- equipping ----------
export async function equipMenu(allIds, rowLabel) {
  let start = 0;
  for (;;) {
    const ids = allIds();
    let cur = start;
    const c = await menu(ids.map(rowLabel), { x: 6, y: 4, w: 150, maxRows: 15, start, onMove: (i) => { cur = i; }, drawExtra: () => drawEquipPanel(ids[cur], null) });
    if (c < 0) return;
    start = c;
    await equipOne(ids[c]);
  }
}
const slotLabel = (m, s) => ({ label: L(SLOT_NAME[s][0], SLOT_NAME[s][1]), right: m.equip[s] ? fit(itemName(m.equip[s]), 70) : '-', icon: m.equip[s] ? (x, y) => drawItemIcon(m.equip[s], x, y, 1, { frame: false }) : null });
export async function equipOne(id) {
  const m = member(id);
  let si = 0;
  for (;;) {
    let hs = si;
    const c = await menu(SLOTS.map((s) => slotLabel(m, s)), { x: 4, y: 4, w: 154, start: si, title: genName(id), onMove: (i) => { hs = i; }, drawExtra: () => drawEquipPanel(id, null, 160, SLOTS[hs]) });
    if (c < 0) return;
    si = c;
    const slot = SLOTS[c];
    const owned = Object.keys(S.items).filter((k) => ITEMS[k] && ITEMS[k].kind === slot);
    warmIcons(owned);
    const list = [null, ...owned.sort((a, b) => (canEquip(m, b) - canEquip(m, a)) || (ITEMS[b].rar || 0) - (ITEMS[a].rar || 0))];
    let cur = 0;
    const cand = (i) => { const e = { ...m.equip, [slot]: list[i] }; if (slot === 'weapon' && list[i] && !ONE_HAND.has(ITEMS[list[i]].cat)) e.shield = null; return e; };
    const why = (k) => (k && !canEquip(m, k) ? (ITEMS[k].kind === 'shield' ? L('（現在的兵器要雙手，不能持盾）', '(the weapon needs both hands; no shield)') : L(`（${unitName(GENERALS[id].unit)}不能用）`, `(not for ${unitName(GENERALS[id].unit)})`)) : '');
    const d = await menu(list.map((k) => ({ label: k ? itemName(k) : L('（卸下）', '(remove)'), right: k ? S.items[k] : '', disabled: !!k && !canEquip(m, k), color: k && ITEMS[k].tr ? RARITY[ITEMS[k].rar][2] : undefined, icon: k ? (x, y) => drawItemIcon(k, x, y, 1, { frame: false }) : null })),
      { x: 4, y: 4, w: 154, maxRows: 14, title: L(`${SLOT_NAME[slot][0]}：試穿`, `${SLOT_NAME[slot][1]}: try on`), onMove: (i) => { cur = i; }, drawExtra: () => drawEquipPanel(id, cand(cur), 160, slot, list[cur] ? `${itemName(list[cur])}${why(list[cur])}\n${itemDesc(list[cur])}` : null) });
    if (d < 0) continue;
    const old = m.equip[slot];
    if (list[d] && !take(list[d])) continue;
    if (old) give(old);
    m.equip[slot] = list[d];
    const off = fitShield(m);
    m.troops = Math.min(m.troops, troopsMax(m));
    learnTactics(m);
    sfx('ok');
    if (off) await notice(L(`雙手兵器：卸下了${itemName(off)}。`, `A two-handed weapon: ${itemName(off)} goes back in the bag.`), 70);
  }
}

// ---------- the treasure codex ----------
const KINDS = Object.keys(TREASURE_KIND);
export async function codex() {
  warmIcons(TREASURES);
  for (;;) {
    const got = TREASURES.filter(owned).length;
    const items = KINDS.map((k) => { const all = TREASURES.filter((id) => ITEMS[id].kind === k); const n = all.filter(owned).length; return { label: L(TREASURE_KIND[k][0], TREASURE_KIND[k][1]), right: `${n}/${all.length}`, color: n === all.length ? '#ffe080' : undefined }; });
    const c = await menu(items, { x: 6, y: 4, w: 150, title: L(`寶物錄 ${Math.floor(got / 3)}%`, `Codex ${Math.floor(got / 3)}%`), drawExtra: () => codexSummary(got) });
    if (c < 0) return;
    await codexGrid(KINDS[c]);
  }
}
function codexSummary(got) {
  windowBox(160, 4, W - 166, H - 8);
  text(L('寶物錄', 'Treasure Codex'), 172, 12, '#f8e070');
  text(L(`收集 ${got}/300（${Math.floor(got / 3)}%）`, `Found ${got}/300 (${Math.floor(got / 3)}%)`), 172, 30, '#ffffff');
  ctx.fillStyle = '#20181c'; ctx.fillRect(172, 46, 280, 6); ctx.fillStyle = '#e0b858'; ctx.fillRect(172, 46, Math.round(280 * got / 300), 6);
  RARITY.forEach((r, i) => { const all = TREASURES.filter((id) => ITEMS[id].rar === i), n = all.filter(owned).length; text(`${L(r[0], r[1])} ${n}/${all.length}`, 172 + (i % 3) * 96, 60 + Math.floor(i / 3) * 14, r[2]); });
  let y = 96;
  text(L('套裝', 'Sets'), 172, y, '#f8e070'); y += 14;
  const sets = Object.entries(SETS);
  sets.forEach(([k, st], i) => { const ids = TREASURES.filter((id) => ITEMS[id].set === k), n = ids.filter(owned).length; text(fit(`${L(st.zh, st.en)} ${n}/${ids.length}`, 140), 172 + (i % 2) * 146, y + Math.floor(i / 2) * 13, n === ids.length ? '#ffe080' : '#c8c8d8'); });
  y += Math.ceil(sets.length / 2) * 13 + 6;
  for (const ln of wrap(L('收集達50、100、150、200、250、300件，或集齊一套，都有獎賞。酒館可以打聽寶物的下落。', 'Rewards at 50, 100, 150, 200, 250 and 300 found, and for each full set. Ask in taverns for rumours of where treasures lie.'), W - 190).slice(0, 3)) { text(ln, 172, y, '#a0a8c0'); y += 13; }
}
function codexGrid(kind) {
  const ids = TREASURES.filter((id) => ITEMS[id].kind === kind).sort((a, b) => ITEMS[a].ch - ITEMS[b].ch || ITEMS[a].rar - ITEMS[b].rar);
  const COLS = 8, P = 20, X0 = 12, Y0 = 26, VIS = 11;
  let i = 0, scroll = 0;
  return new Promise((res) => {
    const w = {
      update() {
        let mv = 0;
        if (input.repeat('right')) mv = 1; if (input.repeat('left')) mv = -1; if (input.repeat('down')) mv = COLS; if (input.repeat('up')) mv = -COLS;
        if (mv) { i = Math.max(0, Math.min(ids.length - 1, i + mv)); sfx('cursor'); }
        const r = Math.floor(i / COLS); if (r < scroll) scroll = r; if (r >= scroll + VIS) scroll = r - VIS + 1;
        if (input.pressed('b') || input.pressed('a')) { sfx('cancel'); removeRaw(w); res(); }
      },
      draw() {
        windowBox(4, 4, COLS * P + 18, H - 8);
        text(L(TREASURE_KIND[kind][0], TREASURE_KIND[kind][1]) + ` ${ids.filter(owned).length}/${ids.length}`, X0, 10, '#f8e070');
        for (let k = scroll * COLS; k < Math.min(ids.length, (scroll + VIS) * COLS); k++) {
          const x = X0 + (k % COLS) * P, y = Y0 + (Math.floor(k / COLS) - scroll) * P;
          drawItemIcon(ids[k], x + 1, y + 1, 1, { sil: !owned(ids[k]) });
          if (k === i) { ctx.strokeStyle = '#fff070'; ctx.lineWidth = 1; ctx.strokeRect(x - 1.5, y - 1.5, 21, 21); }
        }
        if (scroll > 0) text('▲', X0 + COLS * P / 2, Y0 - 12, '#f8e070', { align: 'center' });
        if ((scroll + VIS) * COLS < ids.length) text('▼', X0 + COLS * P / 2, H - 16, '#f8e070', { align: 'center' });
        codexDetail(ids[i]);
      },
    };
    pushRaw(w);
  });
}
function codexDetail(id) {
  const it = ITEMS[id], got = owned(id), heard = S.rumours && S.rumours[id];
  const x0 = 4 + 8 * 20 + 22, pw = W - 4 - x0;
  windowBox(x0, 4, pw, H - 8);
  drawItemIcon(id, x0 + 10, 14, 2, { sil: !got });
  const r = RARITY[it.rar];
  text(got || heard ? fit(L(it.zh, it.en), pw - 60) : L('？？？', '???'), x0 + 50, 14, got ? r[2] : '#a0a0b0');
  text(`${L(r[0], r[1])}　${L(`第${it.ch}章`, `Ch.${it.ch}`)}`, x0 + 50, 30, r[2]);
  let y = 54;
  const lines = [];
  if (got) {
    lines.push([itemDesc(id), '#e8e8f0']);
    const who = Object.values(S.roster).find((m) => Object.values(m.equip).includes(id));
    lines.push([who ? L(`${genName(who.id)}裝備中`, `Worn by ${genName(who.id)}`) : S.items[id] ? L('在行囊中', 'In the bag') : L('已讓出', 'Traded away'), '#c0d8f0']);
    lines.push([L('來源：', 'Where: ') + hintText(id), '#a0a8c0']);
  } else if (heard) {
    lines.push([L('（傳聞）', '(rumour) ') + hintText(id), '#ffe0a0']);
  } else lines.push([L('尚未發現。到酒館打聽，或許能聽到它的下落。', 'Not found yet. A tavern rumour may tell you where it lies.'), '#8088a0']);
  for (const [s, c] of lines) for (const ln of wrap(s, pw - 18)) { if (y > H - 20) break; text(ln, x0 + 10, y, c); y += 13; }
  // a found piece of gear: how it looks on the leader
  if (got && ['weapon', 'armour', 'helm', 'cape', 'shield', 'horse', 'treasure'].includes(it.kind) && y < H - 90) {
    const lead = S.front[0] || 'sunquan', m = member(lead);
    if (m) { T0++; const e = { ...m.equip, [it.kind]: id }; if (it.kind === 'weapon' && !ONE_HAND.has(it.cat)) e.shield = null; stage(x0 + pw - 86, H - 96, 80, 86); drawTurning(lead, e, x0 + pw - 46, H - 14, 1.25); }
  }
}
setTryOn((...a) => drawEquipPanel(...a));
export { owned, itemIcon };
