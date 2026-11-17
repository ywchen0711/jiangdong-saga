// The army menu: generals and their order, equipment with a live paper-doll preview, tactics, formations
// with their diagrams, items, the generals' encyclopedia (武將錄), saving and settings. Also the full map.
import { ctx, W, H, text, textW, windowBox, bar, HAND, canvas } from './gfx.js?v=1';
import { input } from './input.js?v=1';
import { sfx, setMusic, music } from './audio.js?v=1';
import { UI, menu, say, ask, notice, wait, descBox, fit, panel, wrap, pushRaw, removeRaw } from './ui.js?v=1';
import { L, LANG, setLang } from './i18n.js?v=1';
import { GENERALS, GEN_LIST, genName } from './generals.js?v=1';
import { ITEMS, TACTICS, FORMS, SKILLS, UNITS, SLOTS, SLOT_NAME, itemName, tacName, TAC_DESC, skillName, skillDesc, unitName, formName, expFor } from './data.js?v=1';
import { S, member, stat, atkOf, defOf, troopsMax, tpMax, usableTactics, canEquip, give, take, have, healAll, formOk, condText, save, slotInfo, learnTactics, dismiss } from './state.js?v=1';
import { battleSheet, portrait, fieldSheet } from './doll.js?v=1';
import { PLACES, REGIONS, WW, WH } from './world.js?v=1';
import { overviewMap } from './worldgfx.js?v=1';
import { F, tileX, tileY } from './field.js?v=1';

const gold = () => panel(() => { windowBox(W - 112, 4, 108, 34); text(L(`金 ${S.gold}`, `Gold ${S.gold}`), W - 104, 9, '#ffe080'); text(L(`策略 ${S.tp}/${tpMax()}`, `SP ${S.tp}/${tpMax()}`), W - 104, 22, '#a0e0ff'); });
const allIds = () => [...S.front, ...Object.keys(S.roster).filter((id) => !S.front.includes(id))];

export async function openMenu() {
  sfx('ok');
  const close = gold();
  let last = 0;
  for (;;) {
    const opts = [L('武將', 'Generals'), L('裝備', 'Equip'), L('策略', 'Tactics'), L('陣形', 'Formation'), L('道具', 'Items'), L('武將錄', 'Who\'s Who'), L('地圖', 'Map'), L('記錄', 'Save'), L('設定', 'Settings')];
    const dis = [false, false, false, false, false, false, F.mode !== 'world', !(F.mode === 'world' || S.flags.canSave), false];
    const c = await menu(opts.map((s, i) => ({ label: s, disabled: dis[i] })), { x: 6, y: 4, w: 100, start: last });
    if (c < 0) break;
    last = c;
    if (c === 0) await generalsMenu();
    if (c === 1) await equipMenu();
    if (c === 2) await tacticsMenu();
    if (c === 3) await formationMenu();
    if (c === 4) await itemsMenu();
    if (c === 5) await encyclopedia();
    if (c === 6) { close(); await fullMap(); return; }
    if (c === 7) await saveMenu();
    if (c === 8) await settings();
  }
  close();
}

// ---------- a general's page ----------
export function drawStatus(id, x = 112, y = 4, w = W - 228, h = 190, cand = null) {
  const g = GENERALS[id], m = member(id);
  windowBox(x, y, w, h);
  const por = portrait(g.look, m ? (cand || m.equip) : {}, { shield: g.shield, quiver: g.quiver });
  ctx.fillStyle = '#100a14'; ctx.fillRect(x + 8, y + 8, 74, 74);
  if (por) ctx.drawImage(por, x + 9, y + 9, 72, 72);
  text(genName(g), x + 90, y + 8, '#f8e070');
  text(`${unitName(g.unit)}  Lv ${m ? m.lv : '-'}`, x + 90, y + 22, '#c0d8f0');
  if (m) {
    text(L(`兵力 ${m.troops}/${troopsMax(m)}`, `Troops ${m.troops}/${troopsMax(m)}`), x + 90, y + 36);
    bar(x + 90, y + 50, w - 104, m.troops, troopsMax(m));
    text(L(`經驗 ${m.exp}/${expFor(m.lv)}`, `EXP ${m.exp}/${expFor(m.lv)}`), x + 90, y + 56, '#b0b0c0');
    const st = [[L('武力', 'STR'), stat(m, 'str')], [L('智力', 'INT'), stat(m, 'int')], [L('統率', 'LEAD'), stat(m, 'lead')], [L('速度', 'SPD'), stat(m, 'spd')], [L('攻擊', 'ATK'), atkOf(m)], [L('防禦', 'DEF'), defOf(m)]];
    st.forEach(([k, v], i) => { text(k, x + 8 + (i % 3) * 82, y + 88 + Math.floor(i / 3) * 14, '#c8c8d8'); text(String(v), x + 76 + (i % 3) * 82, y + 88 + Math.floor(i / 3) * 14, '#ffffff', { align: 'right' }); });
    let yy = y + 120;
    text(L('技能', 'Skills') + ': ' + (g.skills.map(skillName).join(L('、', ', ')) || '-'), x + 8, yy, '#ffd0a0'); yy += 14;
    const tl = m.tactics.map(tacName).join(L('、', ', ')) || '-';
    for (const ln of wrap(L('策略', 'Tactics') + ': ' + tl, w - 16).slice(0, 2)) { text(ln, x + 8, yy, '#a0e0ff'); yy += 14; }
    const eq = SLOTS.map((s) => (m.equip[s] ? itemName(m.equip[s]) : null)).filter(Boolean).join(L('、', ', '));
    for (const ln of wrap(L('裝備', 'Gear') + ': ' + (eq || '-'), w - 16).slice(0, 2)) { text(ln, x + 8, yy, '#e0e0e0'); yy += 14; }
  } else {
    const st = [[L('武力', 'STR'), g.str], [L('智力', 'INT'), g.int], [L('統率', 'LEAD'), g.lead], [L('速度', 'SPD'), g.spd]];
    st.forEach(([k, v], i) => { text(k, x + 90 + (i % 2) * 70, y + 40 + Math.floor(i / 2) * 14, '#c8c8d8'); text(String(v), x + 150 + (i % 2) * 70, y + 40 + Math.floor(i / 2) * 14, '#ffffff', { align: 'right' }); });
    text(L('技能', 'Skills') + ': ' + (g.skills.map(skillName).join(L('、', ', ')) || '-'), x + 8, y + 90, '#ffd0a0');
  }
}
const rowLabel = (id) => { const m = member(id), g = GENERALS[id]; return { label: (S.front.includes(id) ? '◆' : '　') + genName(g) + (S.strategist === id ? L('〔軍師〕', '[Str]') : ''), right: m ? `Lv${m.lv}` : '', color: m && m.troops <= 0 ? '#8888a0' : undefined }; };
async function generalsMenu() {
  let start = 0;
  for (;;) {
    const ids = allIds();
    let cur = start;
    const c = await menu(ids.map(rowLabel), { x: 6, y: 4, w: 150, maxRows: 15, start, onMove: (i) => { cur = i; }, drawExtra: () => drawStatus(ids[cur], 160, 4, W - 166, 196) });
    if (c < 0) return;
    start = c;
    const id = ids[c];
    const inFront = S.front.includes(id);
    const o = await menu([inFront ? L('移到後備', 'Move to reserve') : L('編入前線', 'Put in front line'), L('與……交換位置', 'Swap places with...'), L('任命為軍師', 'Make strategist'), L('離隊', 'Dismiss')].map((s, i) => ({ label: s, disabled: (i === 0 && inFront && S.front.length <= 1) || (i === 0 && !inFront && S.front.length >= 5) || (i === 3 && (GENERALS[id].famous && ['sunquan', 'jeff', 'erin', 'josh', 'jasper'].includes(id))) })), { x: 170, y: 60, w: 160 });
    if (o === 0) { if (inFront) S.front = S.front.filter((x) => x !== id); else S.front.push(id); sfx('ok'); }
    if (o === 1) {
      const ids2 = allIds();
      const d = await menu(ids2.map(rowLabel), { x: 170, y: 4, w: 150, maxRows: 15, title: L('交換對象', 'Swap with') });
      if (d >= 0 && ids2[d] !== id) {
        const a = id, b = ids2[d], ia = S.front.indexOf(a), ib = S.front.indexOf(b);
        if (ia >= 0 && ib >= 0) { S.front[ia] = b; S.front[ib] = a; }
        else if (ia >= 0) S.front[ia] = b;
        else if (ib >= 0) S.front[ib] = a;
        sfx('ok');
      }
    }
    if (o === 2) { S.strategist = id; S.tp = Math.min(S.tp, tpMax()); sfx('ok'); await say(null, L(`${genName(id)}成為了軍師。全軍的策略由其智力指揮。`, `${genName(id)} is now the army's strategist; their INT guides every tactic.`)); }
    if (o === 3) { const ok = await ask(null, L(`真的要讓${genName(id)}離隊嗎？`, `Really dismiss ${genName(id)}?`), [L('是', 'Yes'), L('否', 'No')]); if (ok === 0) { dismiss(id); start = 0; } }
  }
}

// ---------- equipment, with the paper doll ----------
function drawDoll(sheet, x, y, scale = 2, anim = 'idle', t = 0) {
  if (!sheet) return;
  const m = sheet.meta[anim] || sheet.meta.idle; const f = Math.floor(t / (anim === 'walk' ? 6 : 24)) % (anim === 'walk' ? 8 : 2) + (anim === 'walk' ? 1 : 0);
  const row = anim === 'walk' ? 1 : 0;
  ctx.drawImage(sheet.img, f * m.cell, m.y + row * m.cell, m.cell, m.cell, x - (m.cell * scale) / 2, y - m.cell * scale + (m.cell === 64 ? 4 : 36) * scale, m.cell * scale, m.cell * scale);
}
let pv = { key: null, sheet: null };
function preview(id, equip) {
  const g = GENERALS[id], key = JSON.stringify(equip);
  if (pv.key !== id + key) { pv.key = id + key; const k = pv.key; battleSheet(g.look, equip, { shield: g.shield, quiver: g.quiver }).then((s) => { if (pv.key === k) pv.sheet = s; }); }
  return pv.key === id + key ? pv.sheet : null;
}
async function equipMenu() {
  let start = 0;
  for (;;) {
    const ids = allIds();
    let cur = start;
    const c = await menu(ids.map(rowLabel), { x: 6, y: 4, w: 150, maxRows: 15, start, onMove: (i) => { cur = i; }, drawExtra: () => drawEquip(ids[cur], null) });
    if (c < 0) return;
    start = c;
    await equipOne(ids[c]);
  }
}
let tt = 0;
function drawEquip(id, cand) {
  const m = member(id), g = GENERALS[id];
  windowBox(160, 4, W - 166, 196);
  ctx.fillStyle = '#18101c'; ctx.fillRect(168, 12, 140, 150);
  // a little ground for the doll to stand on
  ctx.fillStyle = '#3a2a24'; ctx.fillRect(168, 140, 140, 22);
  const sh = preview(id, cand || m.equip);
  tt++;
  drawDoll(sh, 238, 150, 2, 'idle', tt);
  text(genName(g), 316, 12, '#f8e070');
  text(unitName(g.unit), 316, 26, '#c0d8f0');
  const eq = cand || m.equip;
  SLOTS.forEach((s, i) => { text(L(SLOT_NAME[s][0], SLOT_NAME[s][1]), 316, 44 + i * 16, '#b0b8c8'); text(fit(eq[s] ? itemName(eq[s]) : '-', 108), 360, 44 + i * 16, cand && cand[s] !== m.equip[s] ? '#80ff a0'.replace(' ', '') : '#ffffff'); });
  const tmp = { ...m, equip: eq };
  const rows = [[L('攻擊', 'ATK'), atkOf(m), atkOf(tmp)], [L('防禦', 'DEF'), defOf(m), defOf(tmp)], [L('智力', 'INT'), stat(m, 'int'), stat(tmp, 'int')], [L('速度', 'SPD'), stat(m, 'spd'), stat(tmp, 'spd')]];
  rows.forEach(([k, a, b], i) => { const y = 132 + i * 14; text(k, 316, y, '#c8c8d8'); text(String(a), 380, y, '#fff', { align: 'right' }); if (cand) { text('→', 386, y, '#c0c0c0'); text(String(b), 420, y, b > a ? '#80ffa0' : b < a ? '#ff8080' : '#fff', { align: 'right' }); } });
  text(L('紙娃娃預覽', 'Paper doll'), 238, 166, '#a09080', { align: 'center' });
}
async function equipOne(id) {
  const m = member(id);
  let si = 0;
  for (;;) {
    const c = await menu(SLOTS.map((s) => ({ label: L(SLOT_NAME[s][0], SLOT_NAME[s][1]), right: m.equip[s] ? itemName(m.equip[s]) : '-' })), { x: 6, y: 120, w: 150, start: si, drawExtra: () => drawEquip(id, null) });
    if (c < 0) return;
    si = c;
    const slot = SLOTS[c];
    const owned = Object.keys(S.items).filter((k) => ITEMS[k] && ITEMS[k].kind === slot && canEquip(m, k));
    const list = [null, ...owned];
    let cur = 0;
    const cand = (i) => ({ ...m.equip, [slot]: list[i] });
    const d = await menu(list.map((k) => ({ label: k ? itemName(k) : L('（卸下）', '(remove)'), right: k ? S.items[k] : '' })), { x: 6, y: 4, w: 150, maxRows: 15, onMove: (i) => { cur = i; }, drawExtra: () => drawEquip(id, cand(cur)) });
    if (d < 0) continue;
    const old = m.equip[slot];
    if (list[d] && !take(list[d])) continue;
    if (old) give(old);
    m.equip[slot] = list[d];
    m.troops = Math.min(m.troops, troopsMax(m));
    learnTactics(m);
    sfx('ok');
  }
}

// ---------- tactics ----------
async function tacticsMenu() {
  const ids = allIds().filter((id) => member(id).tactics.length);
  if (!ids.length) { await notice(L('還沒有人懂得策略。', 'Nobody knows any tactics yet.'), 60); return; }
  let start = 0;
  for (;;) {
    const c = await menu(ids.map(rowLabel), { x: 6, y: 4, w: 150, maxRows: 15, start });
    if (c < 0) return;
    start = c;
    const m = member(ids[c]);
    const list = m.tactics;
    let cur = 0;
    const d = await menu(list.map((t) => ({ label: tacName(t), right: TACTICS[t].cost, disabled: !(TACTICS[t].heal || TACTICS[t].revive || TACTICS[t].escape) })), { x: 160, y: 4, w: 170, maxRows: 10, title: L(`策略值 ${S.tp}/${tpMax()}`, `SP ${S.tp}/${tpMax()}`), onMove: (i) => { cur = i; }, drawExtra: () => { const dd = TAC_DESC[list[cur]]; if (dd) descBox(L(dd[0], dd[1])); } });
    if (d < 0) continue;
    const t = TACTICS[list[d]];
    if (S.tp < t.cost) { sfx('buzz'); continue; }
    if (t.escape) { if (F.mode !== 'world' && F.map && F.map.kind === 'cave') { S.tp -= t.cost; sfx('warp'); const { exitCave } = await import('./story.js?v=1'); await exitCave(); return; } sfx('buzz'); continue; }
    if (t.heal) {
      const targets = t.t === 'aall' ? S.front.map(member) : null;
      if (targets) { for (const x of targets) if (x.troops > 0) x.troops = Math.min(troopsMax(x), x.troops + Math.round(troopsMax(x) * t.heal)); }
      else { const ids2 = allIds(); const e = await menu(ids2.map(rowLabel), { x: 170, y: 40, w: 160, maxRows: 10 }); if (e < 0) continue; const x = member(ids2[e]); if (x.troops <= 0) { sfx('buzz'); continue; } x.troops = Math.min(troopsMax(x), x.troops + Math.round(troopsMax(x) * t.heal)); }
      S.tp -= t.cost; sfx('heal');
    }
    if (t.revive) { const down = allIds().filter((i) => member(i).troops <= 0); if (!down.length) { sfx('buzz'); continue; } const e = await menu(down.map(rowLabel), { x: 170, y: 40, w: 160 }); if (e < 0) continue; const x = member(down[e]); x.troops = Math.round(troopsMax(x) * t.revive); S.tp -= t.cost; sfx('heal'); }
  }
}

// ---------- formations ----------
function drawForm(id, x, y) {
  const f = FORMS[id];
  windowBox(x, y, 220, 200);
  text(formName(id), x + 10, y + 8, '#f8e070');
  // the diagram: the enemy is to the left
  const gx = x + 30, gy = y + 30, cw = 32, chh = 30;
  ctx.fillStyle = '#20181c'; ctx.fillRect(gx - 4, gy - 4, 5 * cw + 8, 3 * chh + 8);
  for (let c = 0; c < 5; c++) for (let r = 0; r < 3; r++) { ctx.fillStyle = (c + r) % 2 ? '#2a2026' : '#30262c'; ctx.fillRect(gx + c * cw, gy + r * chh, cw, chh); }
  text(L('敵', 'Foe'), gx - 22, gy + chh + 8, '#ff9080');
  text('←', gx - 22, gy + chh + 20, '#ff9080');
  f.pos.forEach(([c, r], i) => {
    const px = gx + c * cw + cw / 2, py = gy + r * chh + chh / 2, id2 = S.front[i];
    ctx.fillStyle = i === 0 ? '#e0b858' : '#9a2418'; ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.fill();
    text(String(i + 1), px, py - 6, '#ffffff', { align: 'center' });
    if (id2) text(fit(genName(id2), cw), px, py + 8, '#e0e0e0', { align: 'center' });
  });
  const mods = [[L('攻', 'ATK'), f.atk], [L('防', 'DEF'), f.def], [L('速', 'SPD'), f.spd], [L('計', 'TAC'), f.tac]];
  mods.forEach(([k, v], i) => { const pct = Math.round((v - 1) * 100); text(`${k}${pct > 0 ? '+' : ''}${pct}%`, x + 12 + i * 52, y + 132, pct > 0 ? '#80ffa0' : pct < 0 ? '#ff9080' : '#c0c0c0'); });
  const lines = wrap(L(f.desc[0], f.desc[1]), 200);
  lines.slice(0, 3).forEach((l, i) => text(l, x + 10, y + 148 + i * 14, '#d0d0e0'));
  if (f.cond) text((formOk(id) ? '✓ ' : '✗ ') + condText(id), x + 10, y + 188 - 4, formOk(id) ? '#80ffa0' : '#ff8080');
}
async function formationMenu() {
  const list = S.forms;
  let cur = Math.max(0, list.indexOf(S.formation));
  const c = await menu(list.map((id) => ({ label: formName(id) + (S.formation === id ? '　◆' : ''), color: formOk(id) ? undefined : '#a08888' })), { x: 6, y: 4, w: 140, start: cur, maxRows: 12, onMove: (i) => { cur = i; }, drawExtra: () => drawForm(list[cur], 150, 4) });
  if (c < 0) return;
  if (!formOk(list[c])) { sfx('buzz'); await notice(L('條件不足，無法布陣。', 'The conditions are not met.'), 70); return; }
  S.formation = list[c]; sfx('ok');
}

// ---------- items ----------
async function itemsMenu() {
  let start = 0;
  for (;;) {
    const ids = Object.keys(S.items).filter((k) => ITEMS[k]).sort((a, b) => Object.keys(ITEMS).indexOf(a) - Object.keys(ITEMS).indexOf(b));
    if (!ids.length) { await notice(L('沒有道具。', 'No items.'), 50); return; }
    let cur = start;
    const c = await menu(ids.map((k) => ({ label: itemName(k), right: S.items[k] })), { x: 6, y: 4, w: 190, maxRows: 13, start, onMove: (i) => { cur = i; }, drawExtra: () => descBox(itemDesc(ids[cur])) });
    if (c < 0) return;
    start = c;
    const id = ids[c], it = ITEMS[id];
    if (it.kind === 'supply' && !it.battleOnly) {
      if (it.repel) { take(id); S.repel = it.repel; sfx('heal'); await notice(L('點起了隱蹤香。', 'You light the hiding incense.'), 60); continue; }
      if (it.warp) { if (F.mode !== 'world') { sfx('buzz'); continue; } take(id); const { warpHome } = await import('./story.js?v=1'); await warpHome(); return; }
      if (it.tp) { take(id); S.tp = Math.min(tpMax(), S.tp + it.tp); sfx('heal'); continue; }
      if (it.target === 'all') { take(id); for (const m of S.front.map(member)) if (m.troops > 0) m.troops = Math.min(troopsMax(m), m.troops + Math.round(troopsMax(m) * it.heal)); sfx('heal'); continue; }
      const ids2 = allIds();
      const e = await menu(ids2.map((x) => ({ label: genName(x), right: `${member(x).troops}/${troopsMax(member(x))}` })), { x: 200, y: 20, w: 200, maxRows: 12 });
      if (e < 0) continue;
      const m = member(ids2[e]);
      if (it.revive) { if (m.troops > 0) { sfx('buzz'); continue; } take(id); m.troops = Math.round(troopsMax(m) * it.revive); sfx('heal'); continue; }
      if (m.troops <= 0) { sfx('buzz'); continue; }
      take(id); m.troops = Math.min(troopsMax(m), m.troops + Math.round(troopsMax(m) * it.heal)); sfx('heal');
    } else if (it.kind === 'book') {
      if (it.form) { if (!S.forms.includes(it.form)) { S.forms.push(it.form); take(id); sfx('level'); await say(null, L(`習得了「${FORMS[it.form].zh}」！`, `Learned the ${FORMS[it.form].en} formation!`)); } continue; }
      const ids2 = allIds();
      const e = await menu(ids2.map((x) => ({ label: genName(x), right: L('智', 'INT') + stat(member(x), 'int'), disabled: member(x).tactics.includes(it.teach) })), { x: 200, y: 20, w: 200, maxRows: 12, title: L('誰來研讀？', 'Who will study it?') });
      if (e < 0) continue;
      const m = member(ids2[e]);
      if (stat(m, 'int') < 60) { await say(null, L(`${genName(ids2[e])}看不懂這本書。（需要智力60）`, `${genName(ids2[e])} cannot make sense of it. (INT 60 needed)`)); continue; }
      take(id); m.tactics.push(it.teach); sfx('level');
      await say(null, L(`${genName(ids2[e])}學會了「${TACTICS[it.teach].zh}」！`, `${genName(ids2[e])} learned ${TACTICS[it.teach].en}!`));
    } else sfx('buzz');
  }
}
export function itemDesc(id) {
  const it = ITEMS[id]; if (!it) return '';
  const p = [];
  if (it.atk) p.push(L(`攻擊+${it.atk}`, `ATK +${it.atk}`)); if (it.def) p.push(L(`防禦+${it.def}`, `DEF +${it.def}`)); if (it.int) p.push(L(`智力+${it.int}`, `INT +${it.int}`)); if (it.lead) p.push(L(`統率+${it.lead}`, `LEAD +${it.lead}`)); if (it.spd) p.push(L(`速度+${it.spd}`, `SPD +${it.spd}`));
  if (it.kind === 'weapon') p.unshift({ sword: L('劍刀', 'Sword'), spear: L('槍', 'Spear'), halberd: L('戟', 'Halberd'), axe: L('斧鞭', 'Axe'), bow: L('弓', 'Bow'), xbow: L('弩', 'Crossbow'), staff: L('杖扇（任何兵種可用）', 'Staff/fan (anyone)') }[it.cat]);
  if (it.weakFire) p.push(L('怕火', 'Weak to fire'));
  if (it.naval) p.push(L('水戰有利', 'Good at sea'));
  if (it.heal) p.push(it.target === 'all' ? L(`恢復全軍兵力${Math.round(it.heal * 100)}%`, `Restores ${Math.round(it.heal * 100)}% troops to all`) : L(`恢復兵力${Math.round(it.heal * 100)}%`, `Restores ${Math.round(it.heal * 100)}% troops`));
  if (it.revive) p.push(L('讓敗走的武將歸隊', 'Brings a routed general back'));
  if (it.tp) p.push(L('恢復策略值', 'Restores strategy points'));
  if (it.fire) p.push(L('戰鬥中：火燒全部敵軍', 'In battle: burns all enemies'));
  if (it.escape) p.push(L('戰鬥中：撤退', 'In battle: escape'));
  if (it.repel) p.push(L('一段時間內少遇敵', 'Fewer battles for a while'));
  if (it.warp) p.push(L('回到上一座城', 'Return to the last town'));
  if (it.gift) p.push(L('送給武將的禮物，招降時有用', 'A gift that helps win generals over'));
  if (it.teach) p.push(L(`研讀可學會「${TACTICS[it.teach].zh}」`, `Teaches ${TACTICS[it.teach].en}`));
  if (it.form) p.push(L(`習得「${FORMS[it.form].zh}」`, `Teaches the ${FORMS[it.form].en} formation`));
  if (it.horse) p.push(L('騎乘時騎兵更強；地圖上可騎馬', 'A mount; ride it on the map'));
  if (it.kind === 'key') p.push(L('重要物品', 'Key item'));
  return p.join(L('，', ', '));
}

// ---------- the generals' encyclopedia ----------
async function encyclopedia() {
  const met = GEN_LIST.filter((g) => S.met[g.id]);
  if (!met.length) return;
  let cur = 0;
  const c = await menu(met.map((g) => ({ label: genName(g), right: S.roster[g.id] ? '◆' : '', color: S.roster[g.id] ? '#ffe080' : undefined })), { x: 6, y: 4, w: 150, maxRows: 15, title: L(`武將錄 ${met.length}/500`, `Who's Who ${met.length}/500`), onMove: (i) => { cur = i; }, drawExtra: () => drawEntry(met[cur]) });
  void c;
}
const FACTION_NAME = { sun: ['孫權軍', 'Sun Quan'], sun_hao: ['孫暠叛軍', 'Sun Hao\'s rebels'], shanyue: ['山越', 'Shanyue'], liu_xun: ['劉勳軍', 'Liu Xun'], huang_zu: ['黃祖軍', 'Huang Zu'], cai_mao: ['荊州軍', 'Jing'], liu: ['劉備軍', 'Liu Bei'], cao: ['曹操軍', 'Cao Cao'], yuan: ['袁家軍', 'the Yuan'], dong: ['董卓軍', 'Dong Zhuo'], liu_zhang: ['益州軍', 'Yi'], nanman: ['南蠻', 'Nanman'], qiang: ['西涼', 'Xiliang'], gongsun: ['公孫軍', 'Gongsun'], shi: ['交州士家', 'the Shi of Jiao'], pirate: ['海賊', 'Pirates'], sect: ['黑蓮教', 'Black Lotus'], free: ['在野', 'Unaffiliated'] };
function drawEntry(g) {
  windowBox(160, 4, W - 166, 196);
  const por = portrait(g.look, g.gear || {}, { shield: g.shield, quiver: g.quiver });
  ctx.fillStyle = '#100a14'; ctx.fillRect(168, 12, 74, 74);
  if (por) ctx.drawImage(por, 169, 13, 72, 72);
  text(genName(g), 250, 14, '#f8e070');
  text(unitName(g.unit), 250, 30, '#c0d8f0');
  const fac = FACTION_NAME[S.roster[g.id] ? 'sun' : g.faction] || ['?', '?'];
  text(L(fac[0], fac[1]), 250, 46, '#ffb0a0');
  const st = [[L('武力', 'STR'), g.str], [L('智力', 'INT'), g.int], [L('統率', 'LEAD'), g.lead], [L('速度', 'SPD'), g.spd]];
  st.forEach(([k, v], i) => { const y = 96 + i * 14; text(k, 170, y, '#c8c8d8'); text(String(v), 230, y, '#fff', { align: 'right' }); ctx.fillStyle = '#20181c'; ctx.fillRect(236, y + 4, 100, 4); ctx.fillStyle = v >= 90 ? '#ffd040' : v >= 75 ? '#80e080' : '#80a0e0'; ctx.fillRect(236, y + 4, v, 4); });
  text(L('技能', 'Skills') + ': ' + (g.skills.map(skillName).join(L('、', ', ')) || '-'), 170, 156, '#ffd0a0');
  if (g.famous) text(L('名將', 'Famous'), W - 14, 14, '#ffe080', { align: 'right' });
}

// ---------- saving, settings ----------
async function saveMenu() {
  const slots = [0, 1, 2].map((i) => slotInfo(i));
  const c = await menu(slots.map((s, i) => ({ label: s ? L(`記錄${i + 1}  第${s.chapter}章  Lv${s.lv}`, `Slot ${i + 1}  Ch.${s.chapter}  Lv${s.lv}`) : L(`記錄${i + 1}  （空）`, `Slot ${i + 1}  (empty)`) })), { x: 110, y: 40, w: 220, title: L('存到哪裡？', 'Save to which slot?') });
  if (c < 0) return;
  if (save(c)) { sfx('save'); await notice(L('記錄完成。', 'Saved.'), 60); } else { sfx('buzz'); await notice(L('無法記錄（瀏覽器不允許）。', 'Could not save (storage blocked).'), 90); }
}
async function settings() {
  for (;;) {
    const c = await menu([LANG === 'en' ? '中文' : 'English', music.on ? L('音樂：開', 'Music: on') : L('音樂：關', 'Music: off')], { x: 110, y: 40, w: 160 });
    if (c < 0) return;
    if (c === 0) setLang(LANG === 'en' ? 'zh' : 'en');
    if (c === 1) setMusic(!music.on);
  }
}

// ---------- the full map ----------
export async function fullMap() {
  sfx('ok');
  let zoom = 1, sx = 0, sy = 0;
  const ov1 = overviewMap(1);
  let ox = tileX(), oy = tileY();
  return new Promise((res) => {
    const w = {
      t: 0,
      update() {
        this.t++;
        if (this.t < 3) return;
        if (input.pressed('b') || input.pressed('map') || input.pressed('menu')) { sfx('cancel'); removeRaw(w); res(); return; }
        if (input.pressed('a')) { zoom = zoom === 1 ? 2 : 1; sfx('cursor'); }
        const d = input.dir(); const sp = 3;
        if (zoom === 2 && d) { if (d === 'left') ox -= sp / 2; if (d === 'right') ox += sp / 2; if (d === 'up') oy -= sp / 2; if (d === 'down') oy += sp / 2; }
      },
      draw() {
        ctx.fillStyle = '#0a0808'; ctx.fillRect(0, 0, W, H);
        if (zoom === 1) {
          // the whole land at one pixel per tile
          const x0 = (W - WW) / 2, y0 = (H - WH) / 2 + 4;
          ctx.drawImage(ov1, x0, y0);
          drawMarks(x0, y0, 1, 0, 0);
        } else {
          const ov2 = overviewMap(2);
          const vw = W, vh = H - 20;
          sx = Math.max(0, Math.min(WW * 2 - vw, ox * 2 - vw / 2)); sy = Math.max(0, Math.min(WH * 2 - vh, oy * 2 - vh / 2));
          ctx.drawImage(ov2, sx, sy, vw, vh, 0, 20, vw, vh);
          drawMarks(-sx, 20 - sy, 2, 0, 0);
        }
        windowBox(0, 0, W, 20);
        text(L('天下全圖　A：放大/縮小　B：返回', 'The realm   A: zoom   B: back'), 8, 4, '#f8e070');
      },
    };
    function drawMarks(x0, y0, s) {
      for (const [id, p] of Object.entries(PLACES)) {
        const open = REGIONS[p[5]] && REGIONS[p[5]][4] <= S.chapter;
        const X = x0 + p[2] * s, Y = y0 + p[3] * s;
        ctx.fillStyle = S.visited[id] ? '#ffe070' : open ? '#e05a40' : '#6a5a5a';
        ctx.fillRect(Math.round(X) - 1, Math.round(Y) - 1, 3, 3);
        if (s === 2 && (S.visited[id] || (open && ['capital', 'castle'].includes(p[4])))) text(L(p[0], p[1]), Math.round(X) + 3, Math.round(Y) - 6, S.visited[id] ? '#fff0c0' : '#e0c0b0');
      }
      if ((w.t >> 4) % 2 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x0 + tileX() * s) - 2, Math.round(y0 + tileY() * s) - 2, 5, 5); }
      if (s === 1) {
        // region names over the land
        for (const [k, r] of Object.entries(REGIONS)) { if (r[4] > S.chapter + 0) continue; text(L(r[0], r[1]), x0 + r[2] - 8, y0 + r[3] - 4, '#e8e8e8'); void k; }
      }
    }
    pushRaw(w);
  });
}
