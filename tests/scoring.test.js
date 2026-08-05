'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../scoring.js');
const { computeEntry, setVal, contributingDice } = S;

const c = (o = {}) => ({ gold:0, diamond:0, monkey:0, parrot:0, sword:0, skull:0, ...o });
const entry = (o = {}) => {
  const base = { cardId:'none', counts:c(), protected:c(), naval:{req:4,bonus:500,pen:250}, skullStart:1, isle:false, override:{on:false,value:0} };
  return { ...base, ...o, counts:c(o.counts), protected:c(o.protected) };
};

/* ==================== setVal unit tests ==================== */
describe('setVal (set score table)', () => {
  const cases = { 0:0, 1:0, 2:0, 3:100, 4:200, 5:500, 6:1000, 7:2000, 8:4000, 9:4000, 12:4000 };
  for (const [n, exp] of Object.entries(cases)) {
    test(`${n} identical objects = ${exp}`, () => assert.equal(setVal(Number(n)), exp));
  }
});

/* ==================== contributingDice (full chest calc) ==================== */
describe('contributingDice', () => {
  test('8 monkeys contribute all 8', () => assert.equal(contributingDice(c({monkey:8}), 'none'), 8));
  test('3 monkeys + 3 parrots + 2 gold = 8', () => assert.equal(contributingDice(c({monkey:3,parrot:3,gold:2}), 'none'), 8));
  test('2 swords never contribute without a set', () => assert.equal(contributingDice(c({monkey:3,parrot:3,sword:2}), 'none'), 6));
  test('single gold always contributes', () => assert.equal(contributingDice(c({gold:1,monkey:3,parrot:3}), 'none'), 7));
  test('storm: only gold+diamond', () => assert.equal(contributingDice(c({gold:3,diamond:3,monkey:2}), 'storm'), 6));
  test('naval win: all swords count (FAQ: 2 swords + bonus)', () => assert.equal(contributingDice(c({sword:2,gold:6}), 'naval', true), 8));
  test('naval not won: swords need a set', () => assert.equal(contributingDice(c({sword:2,gold:6}), 'naval', false), 6));
});

/* ==================== basic sets, no card ==================== */
describe('sets without a fate card', () => {
  test('3 identical = 100', () => assert.equal(computeEntry(entry({counts:{monkey:3}})).score, 100));
  test('4 identical = 200', () => assert.equal(computeEntry(entry({counts:{monkey:4}})).score, 200));
  test('5 identical = 500', () => assert.equal(computeEntry(entry({counts:{monkey:5}})).score, 500));
  test('6 identical = 1000', () => assert.equal(computeEntry(entry({counts:{monkey:6}})).score, 1000));
  test('7 identical = 2000', () => assert.equal(computeEntry(entry({counts:{monkey:7}})).score, 2000));
  test('8 identical = 4000 + full chest 500 = 4500', () => {
    const r = computeEntry(entry({counts:{monkey:8}}));
    assert.equal(r.score, 4500);
    assert.ok(r.lines.some(l => l.includes('4000')), 'breakdown shows the set value');
    assert.ok(r.lines.some(l => l.includes('תיבה מלאה')), 'breakdown shows full chest bonus');
  });
  test('2 identical = 0', () => assert.equal(computeEntry(entry({counts:{monkey:2}})).score, 0));
  test('nothing scores = 0', () => assert.equal(computeEntry(entry()).score, 0));
  test('official example: 3 parrots + 4 monkeys + gold = 900', () =>
    assert.equal(computeEntry(entry({counts:{parrot:3,monkey:4,gold:1}})).score, 900));
  test('3 monkeys + 3 parrots + 2 gold = 900 (full chest)', () =>
    assert.equal(computeEntry(entry({counts:{monkey:3,parrot:3,gold:2}})).score, 900));
  test('3 monkeys + 3 parrots + 2 swords = 200 (no full chest)', () =>
    assert.equal(computeEntry(entry({counts:{monkey:3,parrot:3,sword:2}})).score, 200));
  test('4 monkeys + 4 parrots = 900', () =>
    assert.equal(computeEntry(entry({counts:{monkey:4,parrot:4}})).score, 900));
  test('4 monkeys + 3 parrots + 1 gold = 900', () =>
    assert.equal(computeEntry(entry({counts:{monkey:4,parrot:3,gold:1}})).score, 900));
  test('scattered dice: 3m+2p+2s+1g = 200', () =>
    assert.equal(computeEntry(entry({counts:{monkey:3,parrot:2,sword:2,gold:1}})).score, 200));
});

/* ==================== gold & diamond ==================== */
describe('gold and diamond value', () => {
  test('official example: 4 gold = 400 (value) + 200 (set) = 600', () =>
    assert.equal(computeEntry(entry({counts:{gold:4}})).score, 600));
  test('2 gold + 1 diamond = 300 (no set)', () =>
    assert.equal(computeEntry(entry({counts:{gold:2,diamond:1}})).score, 300));
  test('1 gold + 1 diamond + 2 monkeys = 200', () =>
    assert.equal(computeEntry(entry({counts:{gold:1,diamond:1,monkey:2}})).score, 200));
  test('8 gold = 800 + 4000 (set) + 500 (full chest) = 5300', () =>
    assert.equal(computeEntry(entry({counts:{gold:8}})).score, 5300));
  test('6 gold + 1 diamond + 1 monkey = 700 + 1000 = 1700', () =>
    assert.equal(computeEntry(entry({counts:{gold:6,diamond:1,monkey:1}})).score, 1700));
});

/* ==================== bust ==================== */
describe('bust (3+ skulls)', () => {
  test('3 skulls = bust, 0 points', () => {
    const r = computeEntry(entry({counts:{skull:3}}));
    assert.equal(r.score, 0);
    assert.equal(r.type, 'bust');
  });
  test('3 skulls + a set = still bust, 0', () =>
    assert.equal(computeEntry(entry({counts:{skull:3,monkey:3}})).score, 0));
  test('4 skulls (isle off) = bust, 0', () =>
    assert.equal(computeEntry(entry({counts:{skull:4}})).score, 0));
  test('skull card (start 1) + 2 rolled = bust, 0', () =>
    assert.equal(computeEntry(entry({cardId:'skull', counts:{skull:2,monkey:3}})).score, 0));
  test('skull card (start 3) + 0 rolled = bust, 0', () =>
    assert.equal(computeEntry(entry({cardId:'skull', skullStart:3, counts:{monkey:3}})).score, 0));
  test('2 skulls = not a bust', () =>
    assert.equal(computeEntry(entry({counts:{skull:2,monkey:3}})).score, 100));
});

/* ==================== wizard ==================== */
describe('wizard (revives one skull)', () => {
  test('3 skulls saved by wizard = no bust, set scores', () =>
    assert.equal(computeEntry(entry({cardId:'wizard', counts:{skull:3,monkey:3}})).score, 100));
  test('4 skulls, wizard saves only 1 = still bust, 0', () =>
    assert.equal(computeEntry(entry({cardId:'wizard', counts:{skull:4,monkey:4}})).score, 0));
  test('wizard + no skulls changes nothing', () =>
    assert.equal(computeEntry(entry({cardId:'wizard', counts:{monkey:3}})).score, 100));
});

/* ==================== full chest bonus ==================== */
describe('full chest (+500 when all 8 dice score)', () => {
  test('8 gold = 5300 includes full chest', () =>
    assert.equal(computeEntry(entry({counts:{gold:8}})).score, 5300));
  test('gold card: 7 scoring dice + card gold = NO full chest (FAQ: "לא")', () =>
    assert.equal(computeEntry(entry({cardId:'gold', counts:{monkey:3,parrot:3,gold:1}})).score, 400));
  test('diamond card: 7 scoring dice + card diamond = NO full chest', () =>
    assert.equal(computeEntry(entry({cardId:'diamond', counts:{monkey:3,parrot:3,diamond:1}})).score, 400));
});

/* ==================== gold / diamond fate cards ==================== */
describe('gold / diamond fate cards', () => {
  test('gold card + 3 gold + 5 monkeys = 1600', () =>
    assert.equal(computeEntry(entry({cardId:'gold', counts:{gold:3,monkey:5}})).score, 1600));
  test('gold card + 7 gold + 1 monkey = 4800 (single monkey scores nothing, so no full chest — FAQ: 7 scoring dice + card = no bonus)', () =>
    assert.equal(computeEntry(entry({cardId:'gold', counts:{gold:7,monkey:1}})).score, 4800));
  test('gold card + 8 monkeys = 4000 + 500 + 100 = 4600', () =>
    assert.equal(computeEntry(entry({cardId:'gold', counts:{monkey:8}})).score, 4600));
  test('diamond card + 4 diamonds + 4 monkeys = 1700', () =>
    assert.equal(computeEntry(entry({cardId:'diamond', counts:{diamond:4,monkey:4}})).score, 1700));
});

/* ==================== instant win ==================== */
describe('instant win (gold/diamond card + 8 physical dice of that kind)', () => {
  test('gold card + 8 gold dice = instant win', () => {
    const r = computeEntry(entry({cardId:'gold', counts:{gold:8}}));
    assert.equal(r.type, 'instant-win');
    assert.ok(r.lines.some(l => l.includes('ניצחון מיידי')));
  });
  test('diamond card + 8 diamond dice = instant win', () => {
    const r = computeEntry(entry({cardId:'diamond', counts:{diamond:8}}));
    assert.equal(r.type, 'instant-win');
  });
  test('gold card + 7 gold dice = NOT instant win (needs 8 physical)', () => {
    assert.notEqual(computeEntry(entry({cardId:'gold', counts:{gold:7,monkey:1}})).type, 'instant-win');
  });
});

/* ==================== naval battle ==================== */
describe('naval battle', () => {
  const naval = (o) => entry({ cardId:'naval', naval:{req:4,bonus:500,pen:250}, ...o });
  test('win: 5 swords + 3 monkeys = sets 600 + full chest 500 + bonus 500 = 1600', () =>
    assert.equal(computeEntry(naval({counts:{sword:5,monkey:3}})).score, 1600));
  test('win: 4 swords + 4 monkeys = 1400', () =>
    assert.equal(computeEntry(naval({counts:{sword:4,monkey:4}})).score, 1400));
  test('win: 8 swords = 4000 + 500 + 500 = 5000', () =>
    assert.equal(computeEntry(naval({counts:{sword:8}})).score, 5000));
  test('lose: 3 swords (req 4) = -250 penalty', () => {
    const r = computeEntry(naval({counts:{sword:3,monkey:3}}));
    assert.equal(r.type, 'naval-lose');
    assert.equal(r.score, -250);
  });
  test('lose: 2 swords + 6 gold = -250 (gold points lost)', () =>
    assert.equal(computeEntry(naval({counts:{sword:2,gold:6}})).score, -250));
  test('FAQ: bust (3 skulls) during naval battle = penalty deducted', () => {
    const r = computeEntry(naval({counts:{sword:5,skull:3}}));
    assert.equal(r.type, 'naval-lose');
    assert.equal(r.score, -250);
  });
  test('FAQ: req 2 win, 2 swords + 6 gold = bonus + gold + full chest = 2600', () =>
    assert.equal(computeEntry(entry({cardId:'naval', naval:{req:2,bonus:500,pen:250}, counts:{sword:2,gold:6}})).score, 2600));
  test('FAQ: req 2 win, 2 swords + 3 monkeys + 3 parrots = 1200', () =>
    assert.equal(computeEntry(entry({cardId:'naval', naval:{req:2,bonus:500,pen:250}, counts:{sword:2,monkey:3,parrot:3}})).score, 1200));
  test('naval battle: isle of the dead not allowed (rules)', () => {
    const r = computeEntry(entry({cardId:'naval', isle:true, counts:{skull:5}}));
    assert.notEqual(r.type, 'isle');
    assert.equal(r.score, -250);
  });
});

/* ==================== captain ==================== */
describe('captain (double all points)', () => {
  test('8 monkeys = (4000+500)*2 = 9000', () =>
    assert.equal(computeEntry(entry({cardId:'captain', counts:{monkey:8}})).score, 9000));
  test('3 monkeys + 3 parrots + 2 gold = (900)*2 = 1800', () =>
    assert.equal(computeEntry(entry({cardId:'captain', counts:{monkey:3,parrot:3,gold:2}})).score, 1800));
  test('3 monkeys = 200', () =>
    assert.equal(computeEntry(entry({cardId:'captain', counts:{monkey:3}})).score, 200));
  test('bust is still 0 (nothing to double)', () =>
    assert.equal(computeEntry(entry({cardId:'captain', counts:{skull:3}})).score, 0));
});

/* ==================== monkey business ==================== */
describe('monkey business (monkeys+parrots counted together)', () => {
  test('3 parrots + 2 monkeys + 2 gold = 500 (merged set of 5) + 200 = 700', () =>
    assert.equal(computeEntry(entry({cardId:'monkey', counts:{parrot:3,monkey:2,gold:2}})).score, 700));
  test('4 parrots + 4 monkeys = merged 8 = 4000 + 500 = 4500', () =>
    assert.equal(computeEntry(entry({cardId:'monkey', counts:{parrot:4,monkey:4}})).score, 4500));
  test('2 parrots + 2 monkeys + 4 gold = merged set of 4 (200) + gold 600 + full chest 500 = 1300', () =>
    assert.equal(computeEntry(entry({cardId:'monkey', counts:{parrot:2,monkey:2,gold:4}})).score, 1300));
  test('2 parrots + 1 monkey + 3 swords = 100 + 100 = 200', () =>
    assert.equal(computeEntry(entry({cardId:'monkey', counts:{parrot:2,monkey:1,sword:3}})).score, 200));
});

/* ==================== storm ==================== */
describe('storm (only gold & diamond, x200)', () => {
  test('3 gold + 2 diamond = 1000 + 100 (gold set) = 1100', () =>
    assert.equal(computeEntry(entry({cardId:'storm', counts:{gold:3,diamond:2}})).score, 1100));
  test('5 gold = 1000 + 500 = 1500', () =>
    assert.equal(computeEntry(entry({cardId:'storm', counts:{gold:5}})).score, 1500));
  test('8 gold = 1600 + 4000 + 500 = 6100', () =>
    assert.equal(computeEntry(entry({cardId:'storm', counts:{gold:8}})).score, 6100));
  test('4 gold + 4 diamond = 1600 + 200 + 200 + 500 = 2500', () =>
    assert.equal(computeEntry(entry({cardId:'storm', counts:{gold:4,diamond:4}})).score, 2500));
  test('monkeys give nothing in a storm', () =>
    assert.equal(computeEntry(entry({cardId:'storm', counts:{monkey:3,sword:3,parrot:2}})).score, 0));
});

/* ==================== truce ==================== */
describe('truce (no swords at end)', () => {
  test('2 swords + 3 monkeys = -2000', () => {
    const r = computeEntry(entry({cardId:'truce', counts:{sword:2,monkey:3}}));
    assert.equal(r.type, 'truce');
    assert.equal(r.score, -2000);
  });
  test('1 sword = -1000', () => assert.equal(computeEntry(entry({cardId:'truce', counts:{sword:1}})).score, -1000));
  test('8 swords = -8000', () => assert.equal(computeEntry(entry({cardId:'truce', counts:{sword:8}})).score, -8000));
  test('no swords = normal scoring', () => assert.equal(computeEntry(entry({cardId:'truce', counts:{monkey:3}})).score, 100));
});

/* ==================== treasure chest ==================== */
describe('treasure chest (protects dice on bust)', () => {
  test('bust with 3 gold protected = 400', () =>
    assert.equal(computeEntry(entry({cardId:'chest', counts:{skull:3,gold:3}, protected:{gold:3}})).score, 400));
  test('bust with 3 monkeys protected = 100', () =>
    assert.equal(computeEntry(entry({cardId:'chest', counts:{skull:3,monkey:3}, protected:{monkey:3}})).score, 100));
  test('bust with nothing protected = 0', () => {
    const r = computeEntry(entry({cardId:'chest', counts:{skull:3,monkey:3}}));
    assert.equal(r.score, 0);
    assert.equal(r.type, 'bust');
  });
  test('bust with 4 monkeys + 4 parrots protected = 200+200+500 = 900', () =>
    assert.equal(computeEntry(entry({cardId:'chest', counts:{skull:3,monkey:4,parrot:4}, protected:{monkey:4,parrot:4}})).score, 900));
  test('protected skulls prevent the bust: 3 skulls in chest + 3 monkeys + 2 gold = 300', () =>
    assert.equal(computeEntry(entry({cardId:'chest', counts:{skull:3,monkey:3,gold:2}, protected:{skull:3}})).score, 300));
  test('no bust: chest changes nothing', () =>
    assert.equal(computeEntry(entry({cardId:'chest', counts:{monkey:4}})).score, 200));
});

/* ==================== isle of the dead ==================== */
describe('isle of the dead (4+ skulls on first roll)', () => {
  test('5 skulls: each opponent loses 500', () => {
    const r = computeEntry(entry({isle:true, counts:{skull:5}}));
    assert.equal(r.type, 'isle');
    assert.equal(r.deduction, 500);
    assert.equal(r.skullVal, 100);
  });
  test('4 skulls: each opponent loses 400', () =>
    assert.equal(computeEntry(entry({isle:true, counts:{skull:4}})).deduction, 400));
  test('captain in isle: 200 per skull = 1000', () => {
    const r = computeEntry(entry({cardId:'captain', isle:true, counts:{skull:5}}));
    assert.equal(r.deduction, 1000);
    assert.equal(r.skullVal, 200);
  });
  test('FAQ: truce still applies in isle (own -2000 for 2 swords)', () => {
    const r = computeEntry(entry({cardId:'truce', isle:true, counts:{skull:5,sword:2}}));
    assert.equal(r.deduction, 500);
    assert.equal(r.ownPenalty, 2000);
  });
  test('skull card start adds to isle skulls: 1 card + 3 rolled = 4 skulls', () =>
    assert.equal(computeEntry(entry({cardId:'skull', skullStart:1, isle:true, counts:{skull:3}})).deduction, 400));
});
