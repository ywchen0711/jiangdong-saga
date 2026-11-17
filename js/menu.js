// The army menu: generals and their order, equipment with a live paper-doll preview, tactics, formations
// with their diagrams, items, the generals' encyclopedia (武將錄), saving and settings. Also the full map.
import { ctx, W, H, text, textW, windowBox, bar, HAND, canvas } from './gfx.js?v=6';
import { input } from './input.js?v=6';
import { sfx, setMusic, music } from './audio.js?v=6';
import { UI, menu, say, ask, notice, wait, descBox, fit, panel, wrap, pushRaw, removeRaw } from './ui.js?v=6';
import { L, LANG, setLang } from './i18n.js?v=6';
import { GENERALS, GEN_LIST, genName, gearFor } from './generals.js?v=6';
import { ITEMS, TACTICS, FORMS, SKILLS, UNITS, SLOTS, SLOT_NAME, itemName, tacName, TAC_DESC, skillName, skillDesc, unitName, formName, expFor, BEATS, beatenBy, STATUS, RARITY, maxTroops } from './data.js?v=6';
import { icon, ICON_COL } from './icons.js?v=6';
import { S, member, stat, atkOf, defOf, troopsMax, tpMax, usableTactics, canEquip, give, take, have, healAll, formOk, condText, save, slotInfo, learnTactics, dismiss } from './state.js?v=6';
import { battleSheet, portrait, fieldSheet } from './doll.js?v=6';
import { equipMenu as equipMenu2, codex, itemDesc, drawTurning, drawPose } from './equipui.js?v=6';
import { drawItemIcon, warmIcons } from './itemicons.js?v=6';
export { itemDesc };
import { PLACES, REGIONS, WW, WH } from './world.js?v=6';
import { overviewMap } from './worldgfx.js?v=6';
import { F, tileX, tileY } from './field.js?v=6';

const gold = () => panel(() => { windowBox(W - 112, 4, 108, 34); text(L(`金 ${S.gold}`, `Gold ${S.gold}`), W - 104, 9, '#ffe080'); text(L(`策略 ${S.tp}/${tpMax()}`, `SP ${S.tp}/${tpMax()}`), W - 104, 22, '#a0e0ff'); });
const allIds = () => [...S.front, ...Object.keys(S.roster).filter((id) => !S.front.includes(id))];

export async function openMenu() {
  sfx('ok');
  const close = gold();
  let last = 0;
  for (;;) {
    const opts = [L('武將', 'Generals'), L('裝備', 'Equip'), L('策略', 'Tactics'), L('陣形', 'Formation'), L('道具', 'Items'), L('武將錄', 'Who\'s Who'), L('寶物錄', 'Treasures'), L('兵法', 'Art of War'), L('地圖', 'Map'), L('記錄', 'Save'), L('設定', 'Settings')];
    const dis = [false, false, false, false, false, false, false, false, F.mode !== 'world', !(F.mode === 'world' || S.flags.canSave), false];
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
    if (c === 7) await helpPage();
    if (c === 8) { close(); await fullMap(); return; }
    if (c === 9) await saveMenu();
    if (c === 10) await settings();
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
    let yy = y + 120;
    text(L('技能', 'Skills') + ': ' + (g.skills.map(skillName).join(L('、', ', ')) || '-'), x + 8, yy, '#ffd0a0'); yy += 14;
    const tl = m.tactics.map(tacName).join(L('、', ', ')) || '-';
    for (const ln of wrap(L('策略', 'Tactics') + ': ' + tl, w - 16).slice(0, 2)) { text(ln, x + 8, yy, '#a0e0ff'); yy += 14; }
    const eq = SLOTS.map((s) => (m.equip[s] ? itemName(m.equip[s]) : null)).filter(Boolean).join(L('、', ', '));
    for (const ln of wrap(L('裝備', 'Gear') + ': ' + (eq || '-'), w - 16).slice(0, 2)) { text(ln, x + 8, yy, '#e0e0e0'); yy += 14; }
  } else {
    const st = [[L('武力', 'STR'), g.str], [L('智力', 'INT'), g.int], [L('統率', 'LEAD'), g.lead], [L('速度', 'SPD'), g.spd]];
    st.forEach(([k, v], i) => { text(k, x + 90 + (i % 2) * 70, y + 40 + Math.floor(i / 2) * 14, '#c8c8d8'); text(String(v), x + 150 + (i % 2) * 70, y + 40 + Math.floor(i / 2) * 14, '#ffffff', { align: 'right' }); });
    let yy = y + 90;
    text(L('技能', 'Skills') + ': ' + (g.skills.map(skillName).join(L('、', ', ')) || '-'), x + 8, yy, '#ffd0a0'); yy += 14;
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
    if (t.escape) { if (F.mode !== 'world' && F.map && F.map.kind === 'cave') { S.tp -= t.cost; sfx('warp'); const { exitCave } = await import('./story.js?v=6'); await exitCave(); return; } sfx('buzz'); continue; }
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
  { t: ['首領戰', 'Leaders'], s: ['首領會在畫面上方預告大招，蓄力一回合才出手（頭旁有「!」）。對策一定存在：\n‧ 防禦：受到的大招傷害只剩35%。\n‧ 被盯上（準星）的人防禦，或讓會盾牆／護衛的武將防禦替他擋；挑撥也能把攻擊引到坦克身上。\n‧ 混亂、昏睡、困陣、封策能打斷蓄力；有些招式怕水、怕火、怕雨。\n首領兵力降到六成、三成時會改變戰法。偵察能看清首領的弱點與招式；出戰前也聽聽軍師怎麼說。', 'Leaders announce their big moves at the top of the screen and take a turn to charge them ("!" by the head). There is always an answer:\n- Defend: a big move does only 35%.\n- The marked general (crosshair) defends, or a Shield Wall or Guardian general defends and takes it; Provoke draws it onto a tank.\n- Confusion, sleep, traps and Seal Ploys break off a charge; some moves fear water, fire or rain.\nAt 60% and 30% troops a leader changes how it fights. Scout to learn its weak point and moves, and listen to your advisers before the battle.'] },
];
export async function helpPage(inBattle = false) {
  let pg = 0;
  return new Promise((res) => {
    const w = {
      update() {
        if (input.repeat('right') || input.repeat('down')) { pg = (pg + 1) % HELP.length; sfx('cursor'); }
        if (input.repeat('left') || input.repeat('up')) { pg = (pg + HELP.length - 1) % HELP.length; sfx('cursor'); }
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
        void inBattle;
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
      if (it.warp) { if (F.mode !== 'world') { sfx('buzz'); continue; } take(id); const { warpHome } = await import('./story.js?v=6'); await warpHome(); return; }
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
