/* ==================== Otzarot o Tzarot scoring engine ==================== */
/* Pure scoring logic, shared by the UI (index.html) and the test suite.
   Rules source: official rulebook + FAQ at shafirgames.com/ourgames/otzarot */

const FACES = {
  gold:    {emoji:'🪙', label:'זהב'},
  diamond: {emoji:'💎', label:'יהלום'},
  monkey:  {emoji:'🐒', label:'קוף'},
  parrot:  {emoji:'🦜', label:'תוכי'},
  sword:   {emoji:'⚔️', label:'חרב'},
  skull:   {emoji:'💀', label:'גולגולת'},
};
const FACE_KEYS = Object.keys(FACES);

const CARDS = {
  none:    {emoji:'🎲', name:'ללא קלף', desc:'משחק רגיל ללא קלף גורל.'},
  gold:    {emoji:'🪙', name:'מטבע זהב', desc:'מתחילים עם מטבע זהב אחד — שווה 100 נקודות ועוזר לסדרה.'},
  diamond: {emoji:'💎', name:'יהלום', desc:'מתחילים עם יהלום אחד — שווה 100 נקודות ועוזר לסדרה.'},
  naval:   {emoji:'⚔️', name:'קרב ימי', desc:'השיגו את מספר החרבות הדרוש לניצחון וקבלו בונוס. כישלון = הפסד נקודות.'},
  captain: {emoji:'🏴‍☠️', name:'קפטניט', desc:'כל הנקודות בתור זה מוכפלות. באי המתים: מינוס 200 ליריב על כל גולגולת.'},
  monkey:  {emoji:'🐒', name:'מאנקי ביזנס', desc:'קופים ותוכים נספרים ביחד כסדרה אחת.'},
  skull:   {emoji:'💀', name:'גולגולת', desc:'מתחילים עם מספר גולגלות מהקלף.'},
  wizard:  {emoji:'🧙‍♂️', name:'קוסמת', desc:'מחייה גולגולת אחת — היא לא נספרת לפסילה.'},
  chest:   {emoji:'🧰', name:'תיבת האוצר', desc:'בפסילה — הקוביות המוגנות עדיין נספרות לזכותכם.'},
  storm:   {emoji:'🌪️', name:'סופה', desc:'רק יהלומים ומטבעות מזכים — 200 נקודות כל אחד.'},
  truce:   {emoji:'🤝', name:'שביתת נשק', desc:'סיום התור עם חרבות = מינוס 1,000 נקודות על כל חרב.'},
};

const SET_TABLE = {3:100, 4:200, 5:500, 6:1000, 7:2000, 8:4000};

const zero = () => ({gold:0, diamond:0, monkey:0, parrot:0, sword:0, skull:0});
const sum = o => FACE_KEYS.reduce((a,k)=>a+(o[k]||0),0);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const fmt = n => n.toLocaleString('en-US');
const setVal = n => n<=2 ? 0 : (SET_TABLE[Math.min(n,8)]||4000);

/* How many physical dice produce points (for the +500 full chest bonus).
   navalWin (FAQ): in a won naval battle every sword counts, even without a set. */
function contributingDice(c, cardId, navalWin){
  if(cardId==='storm') return c.gold + c.diamond;
  let n = c.gold + c.diamond;
  if(cardId==='monkey'){ if(c.monkey+c.parrot>=3) n += c.monkey+c.parrot; }
  else{ if(c.monkey>=3) n+=c.monkey; if(c.parrot>=3) n+=c.parrot; }
  if(navalWin || c.sword>=3) n+=c.sword;
  return n;
}

function basePoints(calc, cardId, lines){
  const setLine = (n,label) => {
    if(n>=3){ const v=setVal(n); lines.push(`${label} ×${n} → ${v}`); return v; }
    return 0;
  };
  let pts = 0;
  if(cardId==='storm'){
    const u = (calc.gold+calc.diamond)*200;
    if(u) lines.push(`🌪️ זהב+יהלומים ×200: ${u}`);
    pts += u + setLine(calc.gold,'🪙') + setLine(calc.diamond,'💎');
  }else{
    const u = (calc.gold+calc.diamond)*100;
    if(u) lines.push(`🪙💎 ערך נקוב: ${u}`);
    pts += u + setLine(calc.gold,'🪙') + setLine(calc.diamond,'💎');
    if(cardId==='monkey') pts += setLine(calc.monkey+calc.parrot,'🐒🦜 ביחד');
    else{ pts += setLine(calc.monkey,'🐒'); pts += setLine(calc.parrot,'🦜'); }
    pts += setLine(calc.sword,'⚔️');
  }
  return pts;
}

/* Compute the result of one turn. Entry shape:
   { cardId, counts:{gold..skull}, protected:{...}, naval:{req,bonus,pen},
     skullStart, isle, override:{on,value} } */
function computeEntry(e){
  const cardId = e.cardId;
  const counts = e.counts;
  const calc = {...counts};
  if(cardId==='gold') calc.gold += 1;
  if(cardId==='diamond') calc.diamond += 1;

  let skullStart = cardId==='skull' ? e.skullStart : 0;
  let skulls = calc.skull + skullStart;
  if(cardId==='wizard') skulls = Math.max(0, skulls-1);
  /* Treasure chest: protected skulls do not count toward the bust */
  if(cardId==='chest') skulls = Math.max(0, skulls - (e.protected.skull||0));

  const lines = [];

  /* FAQ: gold/diamond card + 8 physical dice of that kind = instant win */
  if((cardId==='gold' && counts.gold===8) || (cardId==='diamond' && counts.diamond===8)){
    lines.push(`👑 8 ${FACES[cardId].label} בקוביות + קלף ${CARDS[cardId].name}`);
    lines.push('הממציא קבע: ניצחון מיידי!');
    return {type:'instant-win', score:0, lines};
  }

  /* Isle of the dead — not allowed during a naval battle (rulebook) */
  if(e.isle && cardId !== 'naval'){
    const skullVal = cardId==='captain' ? 200 : 100;
    const deduction = skulls * skullVal;
    let ownPenalty = 0;
    lines.push(`🏝️ אי המתים — ${skulls} גולגלות שנצברו`);
    lines.push(`כל יריב מפסיד ${fmt(deduction)} נקודות${cardId==='captain' ? ' (קפטניט ×2)' : ''}`);
    /* FAQ: truce penalty still applies on the isle of the dead */
    if(cardId==='truce' && calc.sword > 0){
      ownPenalty = 1000 * calc.sword;
      lines.push(`🤝 שביתת נשק באי המתים: השחקן מפסיד ${fmt(ownPenalty)} נקודות`);
    }
    return {type:'isle', score:0, ownPenalty, skulls, skullVal, deduction, lines};
  }

  lines.push(`💀 גולגלות: ${skulls}/3`);

  if(skulls >= 3){
    if(cardId==='chest' && sum(e.protected) > 0){
      const p = e.protected;
      let pts = basePoints(p, cardId, lines);
      if(contributingDice(p, cardId) === 8){ pts += 500; lines.push('🧰 תיבה מלאה +500'); }
      if(cardId==='captain'){ pts *= 2; lines.push('🏴‍☠️ קפטניט: x2'); }
      lines.push('🧰 תיבת האוצר הצילה את התור!');
      return {type:'chest-save', bust:true, score:pts, lines};
    }
    /* FAQ: busted during a naval battle = the mission failed and the
       penalty points are deducted */
    if(cardId==='naval'){
      lines.push('💀 פסילה! 3+ גולגלות — לא עמדתם במשימה');
      lines.push(`⚔️ יורדות לכם נקודות הקנס → ${fmt(-e.naval.pen)}`);
      return {type:'naval-lose', bust:true, score:-e.naval.pen, lines};
    }
    lines.push('💀 פסילה! 3+ גולגלות — ללא נקודות');
    return {type:'bust', score:0, bust:true, lines};
  }

  let pts = basePoints(calc, cardId, lines);
  let navalWin = false;

  if(cardId==='truce' && calc.sword > 0){
    const pen = 1000*calc.sword;
    lines.push(`🤝 שביתת נשק הופרה: ${calc.sword} חרב${calc.sword>1?'ות':''} → ${fmt(-pen)}`);
    return {type:'truce', score:-pen, lines};
  }

  if(cardId==='naval'){
    if(calc.sword >= e.naval.req){
      navalWin = true;
      pts += e.naval.bonus;
      lines.push(`⚔️ ניצחון בקרב ימי +${fmt(e.naval.bonus)}`);
    }else{
      lines.push(`⚔️ הפסד בקרב ימי (${calc.sword}/${e.naval.req} חרבות) → ${fmt(-e.naval.pen)}`);
      return {type:'naval-lose', score:-e.naval.pen, lines};
    }
  }

  /* Full chest: all 8 physical dice produce points (fate-card extras do NOT
     count — FAQ: "7 dice + gold card = no full chest") */
  const contrib = contributingDice(counts, cardId, navalWin);
  if(contrib === 8){ pts += 500; lines.push('🧰 תיבה מלאה +500'); }

  if(cardId==='captain' && pts !== 0){ pts *= 2; lines.push('🏴‍☠️ קפטניט: x2'); }

  return {type:'ok', score:pts, lines};
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { FACES, FACE_KEYS, CARDS, SET_TABLE, zero, sum, clamp, fmt, setVal, contributingDice, basePoints, computeEntry };
}
