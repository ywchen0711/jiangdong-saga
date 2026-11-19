// The army menu: generals and their order, equipment with a live paper-doll preview, tactics, formations
// with their diagrams, items, the generals' encyclopedia (武將錄), saving and settings. Also the full map.
import { ctx, W, H, text, textW, windowBox, bar, HAND, canvas } from './gfx.js?v=12';
import { input } from './input.js?v=12';
import { sfx, setMusic, music } from './audio.js?v=12';
import { UI, menu, say, ask, notice, wait, descBox, fit, panel, wrap, pushRaw, removeRaw } from './ui.js?v=12';
import { L, LANG, setLang } from './i18n.js?v=12';
import { GENERALS, GEN_LIST, genName, gearFor } from './generals.js?v=12';
import { ITEMS, TACTICS, FORMS, SKILLS, UNITS, SLOTS, SLOT_NAME, itemName, tacName, TAC_DESC, skillName, skillDesc, unitName, formName, expFor, BEATS, beatenBy, STATUS, RARITY, maxTroops } from './data.js?v=12';
import { icon, ICON_COL } from './icons.js?v=12';
import { S, member, stat, atkOf, defOf, troopsMax, tpMax, usableTactics, canEquip, give, take, have, healAll, formOk, condText, save, slotInfo, learnTactics, dismiss, party, PARTY_MAX, toCamp, mustTravel } from './state.js?v=12';
import { battleSheet, portrait, fieldSheet } from './doll.js?v=12';
import { equipMenu as equipMenu2, codex, itemDesc, drawTurning, drawPose } from './equipui.js?v=12';
import { drawItemIcon, warmIcons } from './itemicons.js?v=12';
import { TRAITS, TRAIT_IDS, FAMILY, traitName, traitDesc } from './traits.js?v=12';
export { itemDesc };
import { PLACES, REGIONS, WW, WH } from './world.js?v=12';
import { overviewMap, placeMark } from './worldgfx.js?v=12';
import { questLog } from './sidequests.js?v=12';
import { TERRAIN } from './battle.js?v=12';
import { F, tileX, tileY } from './field.js?v=12';

const gold = () => panel(() => { windowBox(W - 112, 4, 108, 34); text(L(`金 ${S.gold}`, `Gold ${S.gold}`), W - 104, 9, '#ffe080'); text(L(`策略 ${S.tp}/${tpMax()}`, `SP ${S.tp}/${tpMax()}`), W - 104, 22, '#a0e0ff'); });
const allIds = () => [...S.front, ...party().filter((id) => !S.front.includes(id))];

export async function openMenu() {
  sfx('ok');
  const close = gold();
  let last = 0;
  for (;;) {
    const opts = [L('武將', 'Generals'), L('裝備', 'Equip'), L('策略', 'Tactics'), L('陣形', 'Formation'), L('道具', 'Items'), L('武將錄', 'Who\'s Who'), L('寶物錄', 'Treasures'), L('任務', 'Quests'), L('兵法', 'Art of War'), L('地圖', 'Map'), L('記錄', 'Save'), L('設定', 'Settings')];
    const dis = [false, false, false, false, false, false, false, false, false, F.mode !== 'world', !(F.mode === 'world' || S.flags.canSave), false];
    const c = await menu(opts.map((s, i) => ({ label: s, disabled: dis[i] })), { x: 6, y: 4, w: 100, start: last });
    if (c < 0) break;
    last = c;
    if (c === 0) await generalsMenu();
    if (c === 1) await equipMenu();
    if (c === 2) await tacticsMenu();
    if (c === 3) await formationMenu();
    if (c === 4) await itemsMenu();
    if (c === 5) await encyclopedia();
    if (c === 6) await codex();
    if (c === 7) await questLog();
    if (c === 8) await helpPage();
    if (c === 9) { close(); await fullMap(); return; }
    if (c === 10) await saveMenu();
    if (c === 11) await settings();
  }
  close();
}

// ---------- a general's page ----------
export function drawStatus(id, x = 112, y = 4, w = W - 228, h = 190, cand = null, joinLv = 0) {
  const g = GENERALS[id], m = member(id);
  windowBox(x, y, w, h);
  ctx.fillStyle = '#100a14'; ctx.fillRect(x + 8, y + 8, 74, 74);
  ctx.save(); ctx.beginPath(); ctx.rect(x + 8, y + 8, 74, 74); ctx.clip();
  drawTurning(id, m ? (cand || m.equip) : (g.gear || gearFor(g, joinLv || 20)), x + 45, y + 80, 1.05);
  ctx.restore();
  text(genName(g), x + 90, y + 8, '#f8e070');
  text(`${unitName(g.unit)}  Lv ${m ? m.lv : joinLv || '-'}`, x + 90, y + 22, '#c0d8f0');
  if (m) {
    text(L(`兵力 ${m.troops}/${troopsMax(m)}`, `Troops ${m.troops}/${troopsMax(m)}`), x + 90, y + 36);
    bar(x + 90, y + 50, w - 104, m.troops, troopsMax(m));
    text(L(`經驗 ${m.exp}/${expFor(m.lv)}`, `EXP ${m.exp}/${expFor(m.lv)}`), x + 90, y + 56, '#b0b0c0');
    const st = [[L('武力', 'STR'), stat(m, 'str')], [L('智力', 'INT'), stat(m, 'int')], [L('統率', 'LEAD'), stat(m, 'lead')], [L('速度', 'SPD'), stat(m, 'spd')], [L('攻擊', 'ATK'), atkOf(m)], [L('防禦', 'DEF'), defOf(m)]];
    st.forEach(([k, v], i) => { text(k, x + 8 + (i % 3) * 82, y + 88 + Math.floor(i / 3) * 14, '#c8c8d8'); text(String(v), x + 76 + (i % 3) * 82, y + 88 + Math.floor(i / 3) * 14, '#ffffff', { align: 'right' }); });
    let yy = y + 116;
    yy = traitLines(g, x + 8, yy, w - 16);
    const tl = m.tactics.map(tacName).join(L('、', ', ')) || '-';
    for (const ln of wrap(L('策略', 'Tactics') + ': ' + tl, w - 16).slice(0, 2)) { text(ln, x + 8, yy, '#a0e0ff'); yy += 13; }
    const eq = SLOTS.map((s) => (m.equip[s] ? itemName(m.equip[s]) : null)).filter(Boolean).join(L('、', ', '));
    for (const ln of wrap(L('裝備', 'Gear') + ': ' + (eq || '-'), w - 16).slice(0, 2)) { if (yy > y + h - 16) break; text(ln, x + 8, yy, '#e0e0e0'); yy += 13; }
  } else {
    const st = [[L('武力', 'STR'), g.str], [L('智力', 'INT'), g.int], [L('統率', 'LEAD'), g.lead], [L('速度', 'SPD'), g.spd]];
    st.forEach(([k, v], i) => { text(k, x + 90 + (i % 2) * 70, y + 40 + Math.floor(i / 2) * 14, '#c8c8d8'); text(String(v), x + 150 + (i % 2) * 70, y + 40 + Math.floor(i / 2) * 14, '#ffffff', { align: 'right' }); });
    let yy = y + 86;
    yy = traitLines(g, x + 8, yy, w - 16) + 1;
    // someone who might join: what they would bring, beside the army's own numbers
    if (joinLv) {
      const tm = maxTroops(joinLv, g.lead, g.skills.includes('haoling')), gear = gearFor(g, joinLv);
      text(L(`加入時：Lv${joinLv}　兵力${tm}`, `Joins at Lv${joinLv} with ${tm} troops`), x + 8, yy, '#a0e0a0'); yy += 14;
      const eq = SLOTS.map((s) => (gear[s] ? itemName(gear[s]) : null)).filter(Boolean).join(L('、', ', '));
      for (const ln of wrap(L('裝備', 'Gear') + ': ' + (eq || '-'), w - 16).slice(0, 2)) { text(ln, x + 8, yy, '#e0e0e0'); yy += 14; }
      const fr = S.front.map(member).filter(Boolean);
      if (fr.length) {
        const avg = (f) => Math.round(fr.reduce((t, mm) => t + f(mm), 0) / fr.length);
        for (const ln of wrap(L(`我軍前線平均：Lv${avg((mm) => mm.lv)}　武${avg((mm) => stat(mm, 'str'))} 智${avg((mm) => stat(mm, 'int'))} 統${avg((mm) => stat(mm, 'lead'))}　兵力${avg((mm) => troopsMax(mm))}`, `Front line average: Lv${avg((mm) => mm.lv)} STR${avg((mm) => stat(mm, 'str'))} INT${avg((mm) => stat(mm, 'int'))} LEAD${avg((mm) => stat(mm, 'lead'))} troops ${avg((mm) => troopsMax(mm))}`), w - 16).slice(0, 2)) { text(ln, x + 8, yy, '#b0b8d0'); yy += 14; }
      }
    }
  }
}
// a general's two traits: the name, then what it does, one line each when it fits
export function traitLines(g, x, y, w, full = false) {
  for (const id of g.traits || []) {
    const T = TRAITS[id]; if (!T) continue;
    const nm = traitName(id), col = T.fam === 'legend' ? '#ffd860' : '#ffe0a0';
    const one = `${nm}：${traitDesc(id)}`;
    if (!full && textW(one) <= w) { text(nm, x, y, col); text(L('：', ': ') + traitDesc(id), x + textW(nm), y, '#e8e0d0'); y += 13; continue; }
    text(nm, x, y, col);
    const rest = wrap(traitDesc(id), w - textW(nm) - 8);
    if (!full) { text(fit(rest.join(''), w - textW(nm) - 8), x + textW(nm) + 8, y, '#e8e0d0'); y += 13; continue; }
    y += 13; for (const ln of wrap(traitDesc(id), w)) { text(ln, x, y, '#e8e0d0'); y += 12; }
    y += 1;
  }
  return y;
}
const rowLabel = (id) => { const m = member(id), g = GENERALS[id]; return { label: (S.front.includes(id) ? '◆' : '　') + genName(g) + (S.strategist === id ? L('〔軍師〕', '[Str]') : ''), right: m ? `Lv${m.lv}` : '', color: m && m.troops <= 0 ? '#8888a0' : undefined }; };
async function generalsMenu() {
  let start = 0;
  for (;;) {
    const ids = allIds();
    let cur = start;
    const c = await menu(ids.map(rowLabel), { x: 6, y: 4, w: 150, maxRows: 15, start, title: L(`隊伍 ${ids.length}/${PARTY_MAX}　營帳 ${(S.camp || []).length}`, `Party ${ids.length}/${PARTY_MAX}  camp ${(S.camp || []).length}`), onMove: (i) => { cur = i; }, drawExtra: () => drawStatus(ids[cur], 160, 4, W - 166, 196) });
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
    if (o === 3) { const ok = await ask(null, L(`真的要讓${genName(id)}離隊嗎？`, `Really dismiss ${genName(id)}?`), [L('是', 'Yes'), L('否', 'No')], { back: 1 }); if (ok === 0) { dismiss(id); start = 0; } }
  }
}

// ---------- equipment, with the paper doll (equipui.js) ----------
const equipMenu = () => equipMenu2(allIds, rowLabel);

// ---------- tactics ----------
// healing outside battle: each general's troops now, and what the heal would add, always in view
const healAmt = (x, frac) => (x.troops <= 0 ? 0 : Math.min(troopsMax(x) - x.troops, Math.round(troopsMax(x) * frac)));
const troopRow = (id, frac = 0, down = false) => { const x = member(id), h = frac ? healAmt(x, frac) : 0; return { label: genName(id), right: `${x.troops}/${troopsMax(x)}${h ? ' +' + h : ''}`, rcolor: h ? '#90ffa8' : x.troops <= 0 ? '#ff8080' : undefined, disabled: down ? x.troops > 0 : x.troops <= 0 }; };
function armyPanel(frac = 0, all = false, x0 = 336) {
  const ids = allIds().slice(0, 12);
  windowBox(x0, 4, W - 4 - x0, Math.min(H - 8, ids.length * 20 + 26));
  text(L('兵力', 'Troops'), x0 + 8, 8, '#f8e070');
  ids.forEach((id, i) => {
    const m = member(id), mx = troopsMax(m), y = 24 + i * 20, h = all && S.front.includes(id) ? healAmt(m, frac) : 0;
    text(fit(genName(id), 64), x0 + 8, y, m.troops <= 0 ? '#8088a8' : S.front.includes(id) ? '#ffffff' : '#b0b8c8');
    text(`${m.troops}/${mx}`, W - 10, y, '#e0e0e0', { align: 'right' });
    const bw = W - 22 - x0;
    ctx.fillStyle = '#20181c'; ctx.fillRect(x0 + 8, y + 13, bw, 3);
    ctx.fillStyle = m.troops / mx < 0.3 ? '#e05040' : '#60c070'; ctx.fillRect(x0 + 8, y + 13, Math.round(bw * m.troops / mx), 3);
    if (h) { ctx.fillStyle = '#b0ffc0'; ctx.fillRect(x0 + 8 + Math.round(bw * m.troops / mx), y + 13, Math.round(bw * h / mx), 3); }
  });
}
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
    const d = await menu(list.map((t) => ({ label: tacName(t), right: TACTICS[t].cost, disabled: !(TACTICS[t].heal || TACTICS[t].revive || TACTICS[t].escape) })), { x: 160, y: 4, w: 170, maxRows: 10, title: L(`策略值 ${S.tp}/${tpMax()}`, `SP ${S.tp}/${tpMax()}`), onMove: (i) => { cur = i; }, drawExtra: () => { const T = TACTICS[list[cur]]; armyPanel(T.heal || 0, T.t === 'aall'); const dd = TAC_DESC[list[cur]]; if (dd) descBox(L(dd[0], dd[1])); } });
    if (d < 0) continue;
    const t = TACTICS[list[d]];
    if (S.tp < t.cost) { sfx('buzz'); continue; }
    if (t.escape) { if (F.mode !== 'world' && F.map && F.map.kind === 'cave') { S.tp -= t.cost; sfx('warp'); const { exitCave } = await import('./story.js?v=12'); await exitCave(); return; } sfx('buzz'); continue; }
    if (t.heal) {
      const targets = t.t === 'aall' ? S.front.map(member) : null;
      if (targets) { for (const x of targets) if (x.troops > 0) x.troops = Math.min(troopsMax(x), x.troops + Math.round(troopsMax(x) * t.heal)); }
      else { const ids2 = allIds(); const e = await menu(ids2.map((x) => troopRow(x, t.heal)), { x: 160, y: 4, w: 172, maxRows: 14, title: L('治療誰？', 'Heal whom?'), drawExtra: () => armyPanel() }); if (e < 0) continue; const x = member(ids2[e]); if (x.troops <= 0) { sfx('buzz'); continue; } x.troops = Math.min(troopsMax(x), x.troops + Math.round(troopsMax(x) * t.heal)); }
      S.tp -= t.cost; sfx('heal');
    }
    if (t.revive) { const down = allIds().filter((i) => member(i).troops <= 0); if (!down.length) { sfx('buzz'); continue; } const e = await menu(down.map((x) => troopRow(x, 0, true)), { x: 160, y: 4, w: 172, title: L('讓誰歸隊？', 'Rally whom?'), drawExtra: () => armyPanel() }); if (e < 0) continue; const x = member(down[e]); x.troops = Math.round(troopsMax(x) * t.revive); S.tp -= t.cost; sfx('heal'); }
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
  for (let c = 0; c < 5; c++) for (let r = 0; r < 3; r++) { ctx.fillStyle = c >= 2 ? ((c + r) % 2 ? '#22283e' : '#2a3046') : ((c + r) % 2 ? '#2a2026' : '#30262c'); ctx.fillRect(gx + c * cw, gy + r * chh, cw, chh); }
  // the back rows (columns three and deeper) are hard to reach with blades
  text(L('藍底＝後排', 'blue = back'), x + 210, y + 8, '#a0b8e0', { align: 'right' });
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
  // which formation this one beats, and which beats it
  const b = BEATS[id], by = beatenBy(id);
  windowBox(x, y + 202, 220, 34);
  if (b || by) {
    text(L('克制', 'Beats'), x + 10, y + 207, '#80ff90'); text(b ? formName(b) : '—', x + 46, y + 207, '#e0ffe0');
    text(L('被克', 'Loses to'), x + 10, y + 220, '#ff9080'); text(by ? formName(by) : '—', x + (L('a', 'aa') === 'a' ? 46 : 64), y + 220, '#ffe0e0');
  } else text(L('不在相剋之列：水戰時最強。', 'Outside the circle: strongest at sea.'), x + 10, y + 213, '#c0d8f0');
}
async function formationMenu() {
  const list = S.forms;
  let cur = Math.max(0, list.indexOf(S.formation));
  const c = await menu(list.map((id) => ({ label: formName(id) + (S.formation === id ? '　◆' : ''), color: formOk(id) ? undefined : '#a08888' })), { x: 6, y: 4, w: 140, start: cur, maxRows: 12, onMove: (i) => { cur = i; }, drawExtra: () => drawForm(list[cur], 150, 2) });
  if (c < 0) return;
  if (!formOk(list[c])) { sfx('buzz'); await notice(L('條件不足，無法布陣。', 'The conditions are not met.'), 70); return; }
  S.formation = list[c]; sfx('ok');
}


// ---------- the art of war: how battles work ----------
const HELP = [
  { t: ['兵種相剋', 'The Unit Triangle'], draw: 'tri', s: ['騎兵克步兵、步兵克弓兵、弓兵克騎兵：克制時傷害×1.3，被克制時×0.8。\n水軍在水戰中克制所有兵種，在陸上攻擊較弱（×0.85）。\n選目標時，敵軍腳邊的綠色▲表示我方克制，紅色▼表示被克制；傷害數字旁也會顯示「克制!」。', 'Horse beat foot, foot beat bow, bow beat horse: x1.3 damage when you have the edge, x0.8 when they do.\nNavy beats everything on the water but hits weaker on land (x0.85).\nWhen choosing a target, a green arrow by an enemy\'s feet means you have the edge, a red one that they do.'] },
  { t: ['陣形相剋', 'Formations'], draw: 'forms', s: ['每個陣形克制一個、被一個克制。陣形克制時，我軍傷害+15%，開戰士氣+10；被克制則傷害減少、士氣下降。\n敵軍的陣形顯示在畫面上方。戰鬥中可以下令「變陣」（用掉一名武將的行動）。有些首領打到一半會變陣，記得跟著變。', 'Each formation beats one and loses to another. When yours beats theirs you deal 15% more and start with more morale; when theirs beats yours, the opposite.\nThe enemy\'s formation shows at the top. In battle you can order a change of formation (it takes one general\'s turn). Some leaders change formation halfway: change with them.'] },
  { t: ['前排與後排', 'Front and Back Rows'], s: ['陣形圖第三列以後是後排。只要前排還有人，刀槍打到後排的傷害只剩六成；弓弩、策略與首領的狙擊不受影響。\n把軍師與弓兵放在後排。軍師必須出戰，才能把策略與智力借給全軍；軍師敗走，就只剩每人自己會的策略。\n敵人也會盯上我軍的軍師與傷兵。', 'Columns three and deeper of the formation grid are the back rows. While anyone stands in front, blades do only 60% to the back; bows, tactics and a leader\'s marked shots are not affected.\nKeep the strategist and archers at the back. The strategist must be in the line to lend tactics and INT to everyone; if the strategist is routed, each general has only their own tactics.\nEnemies go for your strategist and your wounded too.'] },
  { t: ['士氣', 'Morale'], s: ['雙方各有一條士氣（畫面上方）。擊倒敵將、會心一擊、克制、鼓舞、打斷敵人的大招都會提升士氣；我將倒下、計策失敗、中伏、硬吃大招會讓士氣下降。\n士氣滿時傷害+20%，見底時−20%。野戰中士氣崩潰的敵軍會逃走；首領戰中，所有首領倒下，殘兵就會潰散。', 'Each side has a morale bar (at the top). Felling a general, critical hits, good matchups, Rally and breaking off a big move raise it; losing a general, failed ploys, ambushes and taking a big move head-on lower it.\nFull morale deals 20% more damage, empty 20% less. A field army whose morale breaks runs away; in a leader\'s battle, when every leader falls the rest scatter.'] },
  { t: ['策略', 'Tactics'], s: ['策略值在戰鬥中不會自己恢復，只能靠策略丹、神機丹。每個策略都有成功率（顯示在選單與瞄準時）：取決於施計者（或軍師）與目標的智力。\n火計雨天差、風天強、林中強；水計在江河與雨天強；落石在山地強、水上幾乎無用；雷擊雨天強。首領較能抵抗混亂、昏睡等狀態，有些首領完全免疫。', 'Strategy points do not come back by themselves in battle, only from Strategy and Sage Pills. Every tactic has a chance to work (shown in the menu and when aiming): the caster\'s (or strategist\'s) INT against the target\'s.\nFire is weak in rain, strong in wind and forests; water is strong on rivers and in rain; Rockfall is strong in the mountains and nearly useless at sea; thunder is strong in rain. Leaders resist statuses, and some are immune.'] },
  { t: ['狀態', 'Statuses'], draw: 'status', s: ['', ''] },
  { t: ['裝備與寶物', 'Gear and Treasures'], s: ['每位武將有七個裝備欄：武器、盾牌、鎧甲、頭盔、披風、坐騎、飾品。除了飾品，每件都會改變武將在地圖、城鎮、戰場與選單上的模樣（飾品也常有項鍊、腰帶等小細節）。雙手兵器（戟、弓、弩、雙刀）不能持盾。\n天下藏著三百件寶物，分為普通、精良、稀有、名品、傳說。寶物除了數值，還有效果：對某兵種傷害、某陣形時攻防、策略威力與消耗、抵抗異常、反彈策略、反擊、先制、士氣、策略值上限、水戰、每回合回兵……同一套裝穿兩到四件另有加成。寶物藏在太守府、廟堂、洞窟與街上的紅色寶箱裡、賈斯珀才看得見的野地、首領的戰利品、各地敵軍偶爾掉落、百姓的委託、商店的稀有貨與寶物商人那裡。到酒館打聽，寶物錄會記下線索。', 'Every general has seven slots: weapon, shield, armour, helm, cape, mount and accessory. All but the accessory change how they look on the map, in towns, in battle and in menus (accessories often add a small detail, a pendant or a belt). Two-handed weapons (halberds, bows, crossbows, twin blades) leave no hand for a shield.\nThree hundred treasures lie across the realm: Common, Fine, Rare, Famed and Legendary. Besides their numbers they have effects: damage against a unit type, attack and defence in a formation, tactic power and cost, resisting statuses, reflecting ploys, counters, first strikes, morale, extra strategy points, naval power, troops back each turn... and two to four pieces of one set add more. Look in red chests in governors\' halls, shrines, caves and streets, in the wilds where only Jasper sees, among leaders\' spoils, as rare drops from each land\'s armies, as rewards for townsfolk\'s favours, in shops\' rare stock and at the treasure merchant\'s. Ask in taverns: the Codex notes every rumour.'] },
  { t: ['雙特性', 'Traits'], draw: 'traits', s: ['五百名武將每人都有兩個特性，沒有兩人的組合相同。特性一直有效，觸發時武將頭上會浮現特性名稱。\n戰鬥中選「情報」、按選單鍵或點一下武將，就能看到他的特性、能力與狀態；敵人的弱點、抗性與首領的下一招要偵察才看得到（賈斯珀的「斥候」與郭嘉的「鬼才」也能看穿）。\n按A打開特性一覽：←→換類別，↑↓選擇。', 'Each of the 500 generals has two traits, and no two share the same pair. Traits always work, and a trait\'s name rises over the general when it triggers.\nIn battle, Info, the Menu key or a tap on a general shows their traits, numbers and statuses; an enemy\'s weak points, resistances and a leader\'s next move need scouting (Jasper\'s Scouts and Guo Jia\'s Ghost Talent see through them too).\nPress A for the trait glossary: left/right for a family, up/down to choose.'] },
  { t: ['首領戰', 'Leaders'], s: ['首領沒有特殊能力，和我們一樣用通用規則作戰。他們強在：\n‧ 等級較高，穿著寶物；名將有自己的兩個特性（傳說特性也一樣）。\n‧ 主將：每支軍隊（包括我們）排在最前面的主將，攻擊與防禦+15%。\n‧ 軍師：敵軍也有策略值（畫面右上「敵軍策略」），由他們最聰明的武將決定，用完就只能攻擊。\n‧ 智力或統率85以上的敵將會看穿我軍陣形：只要他們的陣形沒有克制我軍，第二回合起就會變陣反制一次。我們可以再變回來。\n‧ 首領戰中敵軍會合力圍攻：每回合主將點名一個我軍最虛弱、刀兵碰得到的人，大半的攻擊都打向他（挑釁的武將能把他們引開）；他們也會盯上我軍軍師，兵力少時會防禦。任何一方的主將倒下，軍心大跌；首領的軍隊會戰到最後一人。\n對策也是通用的：偵察看清他們的特性、裝備與陣形，用克制的陣形、兵種相剋、狀態、治療與我們自己的特性應戰。只會「全軍突擊」的軍隊不換陣、不治療、不用計，通常打不過首領。出戰前聽聽軍師怎麼說。', 'Leaders have no special powers; they fight by the same rules as we do. What makes them strong:\n- A higher level and treasures; famous generals have their own two traits (legendary ones too).\n- Commander: the general at the head of every army (ours too) gets +15% attack and defence.\n- Strategist: the enemy has strategy points too ("Enemy SP" at the top right), set by its cleverest general; when they run out, they can only fight.\n- An enemy general with INT or LEAD 85+ reads our formation: unless theirs already beats ours, from the second round he changes once to one that does. We may change back.\n- In a leader\'s battle the enemy works together: each round its commander names the most worn-down of ours its blades can reach and most blows go there (a Taunt general draws them off); they also go for our strategist, and stand on guard when low. When either side\'s commander falls its morale plunges; a leader\'s army fights to the last.\nThe answers are the general ones: scout their traits, gear and formation, then counter with formation, the unit triangle, statuses, healing and our own traits. An army that only uses All-out Charge never changes formation, heals or uses a ploy, and will usually lose to a leader. Listen to your advisers before the battle.'] },
  { t: ['地形', 'The Ground'], draw: 'terrain', s: ['地形對雙方一視同仁。野戰的地形就是遇敵那一格的地形；首領會挑對自己有利的地方：守隘口、佔高地、隔河以待、據城而守。高地：該方弓兵+20%、防禦+10%、落石+20%。渡河：涉水的一方前兩回合速度−20%、防禦−10%。畫面右上角與情報卡會顯示地形對每個人的影響。', 'The ground is the same for both armies. A field battle is fought on the ground of the tile where it began; leaders pick ground that suits them: a pass, a height, the far bank of a river, their own walls. High ground: that side\'s archers +20%, defence +10%, rockfalls +20%. Wading a ford: 20% slower and 10% weaker in defence for two rounds. The top right of the screen and the info card show what the ground does to each general.'] },
  { t: ['攻城', 'Sieges'], s: ['攻打城池或關隘時，守軍站在城牆上：弓兵+25%、防禦+25%，刀兵只能從垛口刺擊（八成五）。城門有自己的耐久：步兵×1.4、水軍×1.2、騎兵衝撞×1、弓兵×0.3，工匠×1.5，火計×1.5、落石×1.3，火藥與投石車也行。騎兵上不了城牆；步兵可以爬梯直接攻擊城上的人（傷害減半，還要挨一輪箭）。城門一破，城牆就沒有用了，守軍士氣大跌。守將可能開門出城迎戰（出城的人沒有城牆保護）；拖得太久，敵軍援軍會從城後趕到。', 'When you attack a city or a gate, the defenders stand on the walls: their archers +25%, their defence +25%, and their blades can only thrust over the parapet (85%). The gate has its own durability: foot x1.4, navy x1.2, horse ramming x1, archers x0.3, engineers x1.5, fire ploys x1.5, rocks x1.3; gunpowder and the catapult work too. Horse cannot climb walls; foot can take ladders straight at the men on top (half damage, and they take a volley). Once the gate is broken the walls are useless and the defenders lose heart. Their leader may open the gate and ride out (outside, the walls do not protect him); take too long and a relief force arrives from behind the city.'] },
  { t: ['軍議', 'The War Council'], s: ['開戰前會召開軍議，每一項準備都用平常的手段完成：偵察城防（賈斯珀、斥候或會偵察的人：看穿全軍、城門−25%）、斷糧道（打一場仗：守軍兵力八成五、敵策略−25%、沒有援軍）、夜襲（打一場仗：一員敵將帶傷、敵士氣−10）、火燒城門（兩包火藥：城門−40%）、策反（金子與能言善道的人：一員敵將倒戈）。守隘口或高地的敵人可以繞道（山戰的武將帶路，高地反而歸我們）；隔河的敵人可以夜渡上游。做過的準備，之後每一次進攻都有效。', 'Before the battle there is a war council, and every preparation uses the ordinary means: scout the defences (Jasper, a Scout or someone who knows Scout: the enemy seen through, the gate 25% weaker), cut the supply road (a battle: the garrison at 85%, their strategy -25%, no relief), a night raid (a battle: one officer wounded, their morale -10), burn the gate (two kegs of gunpowder: 40% weaker), win over a defender (gold and a persuasive officer: one of them changes sides). An enemy holding a pass or a height can be outflanked by another road (with a mountaineer guiding, the height becomes ours); one behind a river can be crossed upstream by night. What you prepare counts for every later attempt.'] },
  { t: ['隊伍與營帳', 'The Party and the Camp'], s: ['最多八名武將隨軍：前列五人、後備三人，軍師也在其中。第九名武將加入時，要選一位回營帳等候（孫權，以及故事需要時的傑夫一家不能離開）。任何一間酒館，或大本營（建業）的客棧，都能打開「營帳名冊」：換人、看情報與特性、換裝備、卸下裝備。營帳裡的武將保有自己的裝備，每場勝仗也分到兩成經驗；花錢「訓練」能讓他們追上隊伍平均等級減二。', 'At most eight generals march with you: the front line of five and three in reserve, the strategist among them. When a ninth joins, choose one to wait at the camp (Sun Quan, and Jeff\'s family when the story needs them, cannot be sent away). Any tavern, or the inn of your home city (Jianye), opens the camp roster: swap generals, read their card and traits, change or take off their gear. Generals in camp keep their gear and get a fifth of the experience of every victory; paid training brings them up to the party\'s average level less two.'] },
  { t: ['秘境與渡船', 'Exploring and Ferries'], s: ['天下比從前大了四倍。路上有許多可以探索的地方：石灰岩洞、海蝕洞、銅礦、冰洞、玄武岩窟；漁村、山村、農村與渡口；坐船才到得了的島嶼；有之字形山道與山頂景色的名山；藏著洞穴的瀑布（走進水簾試試）；竹海、雲夢澤、子午谷；遺跡下的地宮；山寨、燈塔、長城上的烽火臺、溫泉與蓬萊的隱士。每個地方都有人、有故事或秘密、有守著它的強敵與寶物。有了戰船之前，港口的船夫可以載你到島上。敵人的強度由地區固定，沿著故事的路走、順路探索，等級自然就跟得上首領。', 'The realm is four times larger than before, and the road passes many places to explore: limestone and sea caves, a copper mine, an ice cave and a basalt grotto; fishing, mountain and farming villages and ferry crossings; islands reached by boat; famous peaks climbed by switchbacks to a summit view; waterfalls hiding a cave (walk into the water); the Bamboo Sea, the Yunmeng marsh and the Ziwu gorge; crypts under ruins; bandit camps, a lighthouse, a beacon tower on the Wall, a hot spring and the hermit of Penglai. Each has its people, a story or a secret, a strong guardian and something to find. Before you have a warship, harbour boatmen take you to the islands. Enemy strength is fixed by land: follow the story\'s road, explore what you pass, and your levels keep pace with the leaders.'] },
  { t: ['試煉', 'Trials'], s: ['各地有人委託「試煉」：頭上有「！」的人。試煉的敵軍強度固定，比同一章的首領更強，委託時會告訴你建議等級與報酬。選單的「任務」頁記下每個委託的地點、目標與進度。\n‧ 有的限時（畫面左上角顯示剩餘回合），有的連戰不准休整，有的只准前列三人出戰。\n‧ 每個試煉都有對策：先偵察，看情報卡上敵將的特性、裝備與陣形。\n‧ 輸了不會結束遊戲，整頓兵馬隨時可以再來。', 'People with a "!" over them ask for Trials. A trial\'s army is fixed in strength and stronger than the leaders of the same chapter; you are told the recommended level and the reward when you are asked. The Quests page in the menu keeps the place, goal and progress of every request.\n- Some are against the clock (rounds left show at the top left), some are gauntlets with no rest, and one lets only the first three of your front line fight.\n- Every trial has an answer: scout first and read the enemy\'s traits, gear and formation on the info card.\n- Losing a trial does not end the game; regroup and come back any time.'] },
];
export async function helpPage(inBattle = false) {
  let pg = 0;
  return new Promise((res) => {
    const w = {
      update() {
        if (input.repeat('right') || input.repeat('down')) { pg = (pg + 1) % HELP.length; sfx('cursor'); }
        if (input.repeat('left') || input.repeat('up')) { pg = (pg + HELP.length - 1) % HELP.length; sfx('cursor'); }
        if (input.pressed('a') && HELP[pg].draw === 'traits') { sfx('ok'); glossary(); return; }
        if (input.pressed('b') || input.pressed('a') || input.pressed('menu')) { if (input.pressed('a') && pg < HELP.length - 1) { pg++; sfx('cursor'); return; } sfx('cancel'); removeRaw(w); res(); }
      },
      draw() {
        const h = HELP[pg];
        windowBox(6, 4, W - 34, H - 8);
        text(L(h.t[0], h.t[1]), 18, 12, '#f8e070');
        text(`${pg + 1}/${HELP.length}  ${L('←→翻頁', '←→ pages')}`, W - 40, 12, '#a0a8c0', { align: 'right' });
        let y = 30;
        if (h.draw === 'tri') {
          // horse -> foot -> bow -> horse, each arrow pointing at the one it beats
          const P = { cav: [60, 44], inf: [200, 44], arc: [130, 80] };
          const arrow = (a, b) => {
            const [x1, y1] = P[a], [x2, y2] = P[b], dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
            const sx = x1 + ux * 30, sy = y1 + 6 + uy * 12, ex = x2 - ux * 30, ey = y2 + 6 - uy * 12;
            ctx.strokeStyle = '#80ff90'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.fillStyle = '#80ff90'; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * 6 - uy * 4, ey - uy * 6 + ux * 4); ctx.lineTo(ex - ux * 6 + uy * 4, ey - uy * 6 - ux * 4); ctx.fill();
          };
          arrow('cav', 'inf'); arrow('inf', 'arc'); arrow('arc', 'cav');
          for (const u of ['cav', 'inf', 'arc']) { const [x, yy] = P[u]; icon(u, x - 18, yy + 3); text(unitName(u), x - 6, yy, ICON_COL[u]); }
          text(L('×1.3', 'x1.3'), 130, 30, '#80ff90', { align: 'center' });
          icon('nav', 280, 47); text(L('水軍：水上克制一切', 'Navy: beats all on water'), 292, 44, ICON_COL.nav);
          y = 96;
        }
        if (h.draw === 'forms') {
          const cyc = [['fengshi', 'fangyuan', 'heyi'], ['yulin', 'changshe', 'yanxing'], ['tuzhen', 'yanyue', 'bagua']];
          cyc.forEach((c, i) => { text(c.map((f) => FORMS[f][L('zh', 'en') === 'zh' ? 'zh' : 'en']).join(' → ') + ' → ' + FORMS[c[0]][L('zh', 'en') === 'zh' ? 'zh' : 'en'], 24, 30 + i * 14, '#e0e8ff'); });
          text(L('（箭頭指向被克制的陣形）', '(each beats the next)'), 24, 72, '#a0a8c0');
          y = 92;
        }
        if (h.draw === 'terrain') {
          // the kinds of ground: name and what it does, one line each
          for (const ln of wrap(L(h.s[0], h.s[1]), W - 64).slice(0, 4)) { text(ln, 20, y, '#e8e8f0'); y += 13; }
          y += 2;
          for (const [k, T] of Object.entries(TERRAIN)) { if (y > H - 22) break; text(L(T.zh, T.en), 20, y, '#d0e8c0'); text(fit(L(T.d[0], T.d[1]), W - 150), 100, y, '#e0e0e8'); y += 13; void k; }
          return;
        }
        if (h.draw === 'status') {
          const keys = Object.keys(STATUS);
          keys.forEach((k, i) => {
            const st = STATUS[k], col = i % 2, row = Math.floor(i / 2), x = 18 + col * 222, yy = 30 + row * 40;
            icon(k === 'defdown' ? 'down' : k, x, yy + 3, ICON_COL[k] || st[2]);
            text(L(st[0], st[1]), x + 12, yy, st[2]);
            for (const [j, ln] of wrap(L(st[3], st[4]), 196).slice(0, 2).entries()) text(ln, x + 12, yy + 13 + j * 12, '#d0d0e0');
          });
          const yy = 30 + Math.ceil(keys.length / 2) * 40;
          icon('up', 18, yy + 3, ICON_COL.atkup); icon('up', 28, yy + 3, ICON_COL.defup); icon('up', 38, yy + 3, ICON_COL.spdup);
          text(L('攻／防／速上升　數字＝剩餘回合', 'ATK / DEF / SPD up   number = turns left'), 52, yy, '#ffe080');
          return;
        }
        for (const ln of wrap(L(h.s[0], h.s[1]), W - 64)) { if (y > H - 22) break; text(ln, 20, y, '#e8e8f0'); y += 14; }
        if (h.draw === 'traits') {
          const fams = Object.keys(FAMILY).map((f) => `${L(FAMILY[f][0], FAMILY[f][1])} ${TRAIT_IDS.filter((t) => TRAITS[t].fam === f).length}`).join(L('　', '  '));
          text(fit(L(`共${TRAIT_IDS.length}種：`, `${TRAIT_IDS.length} traits: `) + fams, W - 64), 20, y + 4, '#ffe0a0');
          text(L('Ａ：特性一覽', 'A: trait glossary'), W - 44, H - 26, '#80ff90', { align: 'right' });
        }
        void inBattle;
      },
    };
    pushRaw(w);
  });
}

// ---------- the trait glossary ----------
// every trait by family: what it does, who of note has it and how many of the 500 do
const TABS = ['all', ...Object.keys(FAMILY)];
function holders(id) { return GEN_LIST.filter((g) => (g.traits || []).includes(id)); }
export function glossary() {
  let tab = 0, i = 0, scroll = 0;
  const listOf = () => TRAIT_IDS.filter((t) => TABS[tab] === 'all' || TRAITS[t].fam === TABS[tab]);
  return new Promise((res) => {
    const w = {
      update() {
        const list = listOf(), vis = 14;
        if (input.repeat('right')) { tab = (tab + 1) % TABS.length; i = 0; scroll = 0; sfx('cursor'); }
        if (input.repeat('left')) { tab = (tab + TABS.length - 1) % TABS.length; i = 0; scroll = 0; sfx('cursor'); }
        if (input.repeat('down')) { i = (i + 1) % list.length; sfx('cursor'); }
        if (input.repeat('up')) { i = (i + list.length - 1) % list.length; sfx('cursor'); }
        if (i < scroll) scroll = i; if (i >= scroll + vis) scroll = i - vis + 1;
        if (input.pressed('b') || input.pressed('menu')) { sfx('cancel'); removeRaw(w); res(); }
      },
      draw() {
        const list = listOf(), vis = 14;
        windowBox(6, 4, W - 34, H - 8);
        // the family tabs
        let tx = 14;
        TABS.forEach((f, k) => { const s1 = f === 'all' ? L('全部', 'All') : L(FAMILY[f][0], FAMILY[f][1]); const tw = textW(s1) + 8; if (k === tab) { ctx.fillStyle = 'rgba(248,224,112,0.22)'; ctx.fillRect(tx - 3, 9, tw, 15); } text(s1, tx, 11, k === tab ? '#f8e070' : '#a0a8c0'); tx += tw + 2; });
        text(`${i + 1}/${list.length}`, W - 40, 11, '#a0a8c0', { align: 'right' });
        // the list
        for (let k = scroll; k < Math.min(list.length, scroll + vis); k++) {
          const id = list[k], yy = 30 + (k - scroll) * 15, T = TRAITS[id];
          if (k === i) { ctx.fillStyle = 'rgba(248,224,112,0.16)'; ctx.fillRect(12, yy - 2, 134, 15); ctx.drawImage(HAND, 4, yy); }
          text(fit(traitName(id), 112), 18, yy, T.fam === 'legend' ? '#ffd860' : '#f0f0f0');
          text(String(holders(id).length), 142, yy, '#8890b0', { align: 'right' });
        }
        if (scroll > 0) text('▲', 80, 24, '#f8e070', { align: 'center' });
        if (scroll + vis < list.length) text('▼', 80, H - 18, '#f8e070', { align: 'center' });
        // the chosen trait
        const id = list[i], T = TRAITS[id], X = 158, CW = W - 44 - X;
        if (!T) return;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X - 6, 28, CW + 12, H - 40);
        text(traitName(id), X, 32, T.fam === 'legend' ? '#ffd860' : '#f8e070');
        text(L(FAMILY[T.fam][0], FAMILY[T.fam][1]) + (T.uniq ? L('・專屬', ', unique') : ''), X + CW, 32, '#a0a8c0', { align: 'right' });
        text(L(T.zh, T.en) === T.zh ? T.en : T.zh, X, 46, '#c0b8a0');
        let y = 64;
        for (const ln of wrap(traitDesc(id), CW)) { text(ln, X, y, '#e8e8f0'); y += 14; }
        y += 6;
        const hs = holders(id), fam = hs.filter((g) => g.famous);
        text(L(`持有者：${hs.length}人`, `Held by ${hs.length}`), X, y, '#ffe0a0'); y += 14;
        const known = fam.filter((g) => S.met[g.id] || S.roster[g.id]);
        const names = known.map((g) => genName(g));
        if (fam.length > known.length) names.push(L(`其他名將${fam.length - known.length}人（未見過）`, `${fam.length - known.length} famous not yet met`));
        if (hs.length > fam.length) names.push(L(`以及${hs.length - fam.length}名武將`, `and ${hs.length - fam.length} others`));
        for (const ln of wrap(names.join(L('、', ', ')), CW).slice(0, 7)) { text(ln, X, y, '#c8d0e0'); y += 13; }
        text(L('←→ 類別　↑↓ 選擇　B 返回', '←→ family  ↑↓ choose  B back'), X + CW, H - 22, '#8890b0', { align: 'right' });
      },
    };
    pushRaw(w);
  });
}

// ---------- items ----------
async function itemsMenu() {
  let start = 0;
  for (;;) {
    const ids = Object.keys(S.items).filter((k) => ITEMS[k]).sort((a, b) => Object.keys(ITEMS).indexOf(a) - Object.keys(ITEMS).indexOf(b));
    if (!ids.length) { await notice(L('沒有道具。', 'No items.'), 50); return; }
    let cur = start;
    warmIcons(ids);
    const c = await menu(ids.map((k) => ({ label: itemName(k), right: S.items[k], color: ITEMS[k].tr ? RARITY[ITEMS[k].rar][2] : undefined, icon: (x, y) => drawItemIcon(k, x, y, 1, { frame: false }) })), { x: 6, y: 4, w: 210, maxRows: 12, start, onMove: (i) => { cur = i; }, drawExtra: () => descBox(itemDesc(ids[cur])) });
    if (c < 0) return;
    start = c;
    const id = ids[c], it = ITEMS[id];
    if (it.kind === 'supply' && !it.battleOnly) {
      if (it.repel) { take(id); S.repel = it.repel; sfx('heal'); await notice(L('點起了隱蹤香。', 'You light the hiding incense.'), 60); continue; }
      if (it.warp) { if (F.mode !== 'world') { sfx('buzz'); continue; } take(id); const { warpHome } = await import('./story.js?v=12'); await warpHome(); return; }
      if (it.tp) { take(id); S.tp = Math.min(tpMax(), S.tp + it.tp); sfx('heal'); continue; }
      if (it.target === 'all') { take(id); for (const m of S.front.map(member)) if (m.troops > 0) m.troops = Math.min(troopsMax(m), m.troops + Math.round(troopsMax(m) * it.heal)); sfx('heal'); continue; }
      const ids2 = allIds();
      const e = await menu(ids2.map((x) => (it.revive ? troopRow(x, 0, true) : troopRow(x, it.heal || 0))), { x: 160, y: 4, w: 172, maxRows: 14, title: it.revive ? L('讓誰歸隊？', 'Rally whom?') : L('給誰用？', 'Use on whom?'), drawExtra: () => armyPanel() });
      if (e < 0) continue;
      const m = member(ids2[e]);
      if (it.revive) { if (m.troops > 0) { sfx('buzz'); continue; } take(id); m.troops = Math.round(troopsMax(m) * it.revive); sfx('heal'); continue; }
      if (m.troops <= 0) { sfx('buzz'); continue; }
      take(id); m.troops = Math.min(troopsMax(m), m.troops + Math.round(troopsMax(m) * it.heal)); sfx('heal');
    } else if (it.kind === 'book') {
      if (it.form) { if (!S.forms.includes(it.form)) { S.forms.push(it.form); take(id); sfx('level'); await say(null, L(`習得了「${FORMS[it.form].zh}」！`, `Learned the ${FORMS[it.form].en} formation!`)); } continue; }
      if (it.boost) {
        const ids3 = allIds();
        const e = await menu(ids3.map((x) => ({ label: genName(x), right: Object.keys(it.boost).map((k) => stat(member(x), k)).join('/') })), { x: 220, y: 20, w: 200, maxRows: 12, title: L('誰來研讀？', 'Who will study it?') });
        if (e < 0) continue;
        const mm = member(ids3[e]); mm.plus = mm.plus || {};
        for (const [k, v] of Object.entries(it.boost)) mm.plus[k] = (mm.plus[k] || 0) + v;
        take(id); sfx('level'); learnTactics(mm);
        await say(null, L(`${genName(ids3[e])}讀完了《${it.zh}》，能力永久提升了！`, `${genName(ids3[e])} studies ${it.en}; their numbers rise for good!`));
        continue;
      }
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
  ctx.fillStyle = '#100a14'; ctx.fillRect(168, 12, 74, 74);
  ctx.save(); ctx.beginPath(); ctx.rect(168, 12, 74, 74); ctx.clip();
  const m0 = S.roster[g.id];
  drawPose(g.id, m0 ? m0.equip : (g.gear || {}), 205, 84, m0 && m0.equip.horse ? 0.55 : 1.1);
  ctx.restore();
  text(genName(g), 250, 14, '#f8e070');
  text(unitName(g.unit), 250, 30, '#c0d8f0');
  const fac = FACTION_NAME[S.roster[g.id] ? 'sun' : g.faction] || ['?', '?'];
  text(L(fac[0], fac[1]), 250, 46, '#ffb0a0');
  if (g.role) text(L(g.role[0], g.role[1]), 250, 62, '#a0e0c0');
  // a painted portrait, when the general has one
  const art = UI.art && UI.art(g.id);
  if (art) { windowBox(W - 70, 30, 58, 66); ctx.fillStyle = '#000'; ctx.fillRect(W - 66, 34, 50, 58); ctx.drawImage(art, W - 65, 35); }
  const st = [[L('武力', 'STR'), g.str], [L('智力', 'INT'), g.int], [L('統率', 'LEAD'), g.lead], [L('速度', 'SPD'), g.spd]];
  st.forEach(([k, v], i) => { const y = 96 + i * 14; text(k, 170, y, '#c8c8d8'); text(String(v), 230, y, '#fff', { align: 'right' }); ctx.fillStyle = '#20181c'; ctx.fillRect(236, y + 4, 100, 4); ctx.fillStyle = v >= 90 ? '#ffd040' : v >= 75 ? '#80e080' : '#80a0e0'; ctx.fillRect(236, y + 4, v, 4); });
  traitLines(g, 170, 155, W - 186);
  text(L('兵法頁有全部特性的一覽', 'All traits: see the Art of War'), 170, 183, '#8890b0');
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
// three zooms: the whole realm at half a pixel a tile, then one and two pixels a tile, panned with the pad.
// Places are marked by kind (caves, temples, passes, peaks, waterfalls, groves, islands...), names from zoom 2.
export async function fullMap() {
  sfx('ok');
  let zoom = 0;
  const S_OF = [0.5, 1, 2];
  let ox = tileX(), oy = tileY();
  return new Promise((res) => {
    const w = {
      t: 0,
      update() {
        this.t++;
        if (this.t < 3) return;
        if (input.pressed('b') || input.pressed('map') || input.pressed('menu')) { sfx('cancel'); removeRaw(w); res(); return; }
        if (input.pressed('a')) { zoom = (zoom + 1) % 3; sfx('cursor'); }
        const d = input.dir(), sp = zoom === 1 ? 3 : 1.5;
        if (zoom > 0 && d) { if (d === 'left') ox -= sp; if (d === 'right') ox += sp; if (d === 'up') oy -= sp; if (d === 'down') oy += sp; }
        ox = Math.max(0, Math.min(WW, ox)); oy = Math.max(0, Math.min(WH, oy));
        // a tap pans to that spot (or zooms in on the whole map)
        const tp = input.takeTap && input.takeTap();
        if (tp && tp.y > 20) { const s = S_OF[zoom]; if (zoom === 0) { ox = (tp.x - (W - WW * s) / 2) / s; oy = (tp.y - 24 - (H - 24 - WH * s) / 2) / s; zoom = 1; } else { ox += (tp.x - W / 2) / s; oy += (tp.y - (20 + (H - 20) / 2)) / s; } sfx('cursor'); }
      },
      draw() {
        ctx.fillStyle = '#0a0808'; ctx.fillRect(0, 0, W, H);
        const s = S_OF[zoom];
        if (zoom === 0) {
          // the whole land at half a pixel per tile
          const ov = overviewMap(0.5), x0 = Math.round((W - ov.width) / 2), y0 = 24 + Math.round((H - 24 - ov.height) / 2);
          ctx.drawImage(ov, x0, y0);
          drawMarks(x0, y0, s);
        } else {
          const ov = overviewMap(s === 2 ? 1 : 1);
          const vw = W, vh = H - 20;
          // at two pixels a tile the one-pixel picture is drawn doubled (crisp: smoothing is off on the screen)
          const sx = Math.max(0, Math.min(WW * s - vw, ox * s - vw / 2)), sy = Math.max(0, Math.min(WH * s - vh, oy * s - vh / 2));
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(ov, sx / s, sy / s, vw / s, vh / s, 0, 20, vw, vh);
          drawMarks(-sx, 20 - sy, s);
        }
        windowBox(0, 0, W, 20);
        text(L(`天下全圖　A：放大（${['全圖', '一倍', '兩倍'][zoom]}）　十字鍵：移動　B：返回`, `The realm   A: zoom (${['all', 'x1', 'x2'][zoom]})   pad: pan   B: back`), 8, 4, '#f8e070');
      },
    };
    function drawMarks(x0, y0, s) {
      for (const [id, p] of Object.entries(PLACES)) {
        const open = REGIONS[p[5]] && REGIONS[p[5]][4] <= S.chapter;
        const X = x0 + p[2] * s, Y = y0 + p[3] * s;
        if (X < -10 || Y < 14 || X > W + 10 || Y > H + 10) continue;
        const col = S.visited[id] ? '#ffe070' : open ? '#e05a40' : '#6a5a5a', rx = Math.round(X), ry = Math.round(Y);
        placeMark(ctx, id, rx, ry, col);
        if (s >= 1 && (S.visited[id] || (open && (s >= 2 || ['capital', 'castle', 'cave', 'temple', 'gate'].includes(p[4]))))) text(L(p[0], p[1]), rx + 4, ry - 7, S.visited[id] ? '#fff0c0' : '#e0c0b0');
      }
      if ((w.t >> 4) % 2 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x0 + tileX() * s) - 2, Math.round(y0 + tileY() * s) - 2, 5, 5); }
      if (s < 1) {
        // region names over the land
        // each name centred on its land; a name that would touch one already drawn moves a little, or is left out
        const used = [];
        const hit = (a2) => used.some((b2) => a2[0] < b2[2] && a2[2] > b2[0] && a2[1] < b2[3] && a2[3] > b2[1]);
        for (const r of Object.values(REGIONS)) {
          if (r[4] > S.chapter) continue;
          const nm = L(r[0], r[1]), w = textW(nm), cx = x0 + r[2] * s, cy = y0 + r[3] * s;
          for (const [dx, dy] of [[0, 0], [0, -12], [0, 12], [-w / 2 - 4, 0], [w / 2 + 4, 0], [0, -22], [0, 22]]) {
            const box = [cx + dx - w / 2 - 1, cy + dy - 7, cx + dx + w / 2 + 1, cy + dy + 7];
            if (hit(box)) continue;
            used.push(box);
            ctx.fillStyle = 'rgba(10,8,8,0.45)'; ctx.fillRect(box[0], box[1] + 1, box[2] - box[0], 12);
            text(nm, cx + dx, cy + dy - 6, '#f0f0f0', { align: 'center' });
            break;
          }
        }
      }
    }
    pushRaw(w);
  });
}
