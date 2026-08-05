'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadApp() {
  const el = () => ({
    innerHTML:'', hidden:false, className:'', textContent:'',
    classList:{ add(){}, remove(){} },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    after(){}, scrollIntoView(){},
    set open(v){}, get open(){ return true; },
  });
  global.document = {
    addEventListener(){},
    getElementById(){ return el(); },
    querySelector(){ return el(); },
    createElement(){ return el(); },
  };
  global.localStorage = { getItem(){return null;}, setItem(){}, removeItem(){} };
  global.confirm = () => true;

  const scoring = fs.readFileSync(path.join(ROOT,'scoring.js'),'utf8');
  const html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  return new Function(`${scoring}\n${inline}\nreturn {
    get state(){ return state; }, get entry(){ return entry; },
    saveTurn, undo, makePlayers, computeEntry, defaultEntry,
  };`)();
}

test('index.html + scoring.js load together without errors', () => {
  const app = loadApp();
  assert.ok(app);
  assert.equal(app.state.screen, 'setup');
  assert.equal(app.state.players.length, 2);
});

test('full turn flow: 8 monkeys saved = 4500 to player, history recorded', () => {
  const app = loadApp();
  app.makePlayers(2);
  app.state.screen = 'game';
  app.state.turnIdx = 0;
  app.entry.counts.monkey = 8;
  app.saveTurn();
  assert.equal(app.state.players[0].score, 4500);
  assert.equal(app.state.players[1].score, 0);
  assert.equal(app.state.history.length, 1);
  assert.equal(app.state.history[0].score, 4500);
  assert.equal(app.state.turnIdx, 1, 'turn advances to next player');
});

test('isle of the dead turn deducts from each opponent', () => {
  const app = loadApp();
  app.makePlayers(3);
  app.state.screen = 'game';
  app.state.players[0].score = 1000;
  app.state.players[1].score = 2000;
  app.state.players[2].score = 3000;
  app.entry.isle = true;
  app.entry.counts.skull = 5;
  app.saveTurn();
  assert.equal(app.state.players[0].score, 1000, 'acting player unchanged');
  assert.equal(app.state.players[1].score, 2000 - 500);
  assert.equal(app.state.players[2].score, 3000 - 500);
});

test('undo restores the previous state', () => {
  const app = loadApp();
  app.makePlayers(2);
  app.state.screen = 'game';
  app.entry.counts.gold = 4;
  app.saveTurn();
  assert.equal(app.state.players[0].score, 600);
  app.undo();
  assert.equal(app.state.players[0].score, 0);
  assert.equal(app.state.history.length, 0);
  assert.equal(app.state.turnIdx, 0);
});

test('crossing 8000 sets the finisher and last round', () => {
  const app = loadApp();
  app.makePlayers(2);
  app.state.screen = 'game';
  app.state.players[0].score = 7500;
  app.entry.counts.monkey = 8; /* +4500 = 12000 */
  app.saveTurn();
  assert.equal(app.state.players[0].score, 12000);
  assert.equal(app.state.finisher, app.state.players[0].id);
  assert.deepEqual(app.state.lastRoundPending, [app.state.players[1].id]);
  assert.equal(app.state.done, false);
});

test('instant win (gold card + 8 gold dice) ends the game immediately', () => {
  const app = loadApp();
  app.makePlayers(2);
  app.state.screen = 'game';
  app.entry.cardId = 'gold';
  app.entry.counts.gold = 8;
  app.saveTurn();
  assert.equal(app.state.immediateWinner, app.state.players[0].id);
  assert.equal(app.state.done, true);
});

test('finisher drops below 8000 by isle attack and rejoins the game', () => {
  const app = loadApp();
  app.makePlayers(2);
  app.state.screen = 'game';
  app.state.players[0].score = 8500;
  app.state.finisher = app.state.players[0].id;
  app.state.lastRoundPending = [app.state.players[1].id];
  app.state.turnIdx = 1;
  /* player 1 goes to the isle with 8 skulls: -800 from player 0 */
  app.entry.isle = true;
  app.entry.counts.skull = 8;
  app.saveTurn();
  assert.equal(app.state.players[0].score, 8500 - 800);
  assert.equal(app.state.finisher, null, 'finisher below 8000 rejoins the game');
  assert.equal(app.state.done, false);
});
