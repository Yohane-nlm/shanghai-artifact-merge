const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { boot, ROOT } = require("./harness.cjs");
const FRAME = 1000 / 60 - 0.000001;
const results = [];

function test(name, run) {
  run();
  results.push(name);
  console.log(`PASS ${name}`);
}

function contained(body) {
  assert(Number.isFinite(body.x) && Number.isFinite(body.y));
  assert(body.x >= 17 + body.r - 1.51);
  assert(body.x <= 403 - body.r + 1.51);
  assert(body.y >= body.r - 1.51);
  assert(body.y + body.r <= 593.51);
}

test("本地资源完整，浏览器代码保持生产接口", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for (const [, file] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (!/^(data:|https?:)/.test(file)) assert(fs.existsSync(path.join(ROOT, file)));
  }
  const code = fs.readFileSync(path.join(ROOT, "src/game.js"), "utf8");
  assert(!/__gameQA|qaEnabled|expansionEvents|\?qa=/.test(code));
  assert.equal(
    fs.readdirSync(path.join(ROOT, "assets")).filter((f) => f.endsWith(".png")).length,
    9,
  );
});

test("鼠标按下投放，松开不重复；知识提示保持游戏进行", () => {
  const b = boot({ saved: {} });
  const event = {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    clientX: 210,
    preventDefault() {},
  };
  b.elements.get("game").events.get("pointerdown")(event);
  b.elements.get("game").events.get("pointerup")(event);
  assert.equal(b.game.read().drops, 1);
  b.game.advance(1000);
  assert(!b.game.read().paused);
  assert(!b.elements.get("unlock-notice").hidden);
  b.elements.get("unlock-open").events.get("click")();
  assert(b.game.read().paused);
  b.game.close();
});

test("触屏拖动瞄准，松手后投放", () => {
  const b = boot();
  const event = { button: 0, pointerId: 2, pointerType: "touch", clientX: 80, preventDefault() {} };
  b.elements.get("game").events.get("pointerdown")(event);
  assert.equal(b.game.read().drops, 0);
  b.elements.get("game").events.get("pointermove")({ ...event, clientX: 300 });
  b.elements.get("game").events.get("pointerup")({ ...event, clientX: 300 });
  assert.equal(b.game.read().bodies[0].x, 300);
  assert(!b.game.drop());
  b.game.advance(350);
  assert(b.game.drop());
});

test("连续合成、得分与最高等级清除", () => {
  const b = boot();
  b.game.spawn(0, 155, 450);
  b.game.spawn(0, 185, 450);
  b.game.spawn(1, 165, 385);
  b.game.advance(1500);
  assert.equal(b.game.read().score, 35);
  assert.equal(b.game.read().pieces, 1);
  b.game.reset();
  b.game.spawn(8, 120, 480);
  b.game.spawn(8, 270, 480);
  b.game.advance(1200);
  assert.equal(b.game.read().score, 1400);
  assert.equal(b.game.read().pieces, 0);
});

test("暂停、恢复与重开", () => {
  const b = boot();
  b.game.drop();
  b.game.advance(500);
  b.game.pause();
  const time = b.game.read().simTime;
  b.game.advance(1000);
  assert.equal(b.game.read().simTime, time);
  b.game.close();
  b.game.advance(500);
  assert(b.game.read().simTime > time);
  b.game.reset();
  assert.equal(b.game.read().score, 0);
  assert.equal(b.game.read().pieces, 0);
  assert.equal(b.game.read().unlocked.length, 9);
});

test("合成接触局部性与父物体动量", () => {
  const b = boot();
  const c = b.game.spawn(4, 180, 300);
  const far = b.game.spawn(0, 365, 300);
  b.game.expand(c);
  b.game.advance(FRAME);
  assert.equal(b.game.read().bodies.find((p) => p.id === far).vx, 0);
  b.game.reset();
  const a = b.game.spawn(0, 185, 420);
  const d = b.game.spawn(0, 215, 420);
  b.game.velocity(a, 16, 10);
  b.game.velocity(d, 16, 10);
  b.game.advance(FRAME);
  const child = b.game.read().bodies[0];
  assert.equal(child.r, 27);
  assert(child.vx > 15 && child.vx < 17);
  assert(child.vy > 8);
});

test("上边界约束与满线判定", () => {
  const b = boot();
  const id = b.game.spawn(0, 210, 220);
  b.game.age(id, 5000);
  b.game.velocity(id, 0, -30);
  for (let i = 0; i < 180; i++) {
    b.game.advance(FRAME);
    b.game.read().bodies.forEach(contained);
    assert(!b.game.read().gameOver);
  }
  b.game.reset();
  b.game.overflow();
  b.game.advance(4000);
  assert(b.game.read().gameOver);
});

test("减少动态效果与 WebMCP 输入校验", () => {
  const b = boot({ reduced: true });
  const c = b.game.spawn(4, 180, 350);
  b.game.spawn(1, 247, 350);
  b.game.expand(c);
  b.game.advance(50);
  for (const p of b.game.read().bodies) {
    assert.equal(p.shape.pop, 1);
    assert.equal(p.shape.q, 0);
  }
  assert.equal(b.game.read().effects.shake, 0);
  b.game.reset();
  assert.deepEqual([...b.tools.keys()], ["read_museum_game", "drop_museum_artifact"]);
  const drop = b.tools.get("drop_museum_artifact").execute;
  assert.throws(() => drop({ x: 2 }));
  assert(drop({ x: 0.5 }).dropped);
  assert(!drop({ x: 0.5 }).dropped);
});

test("三组确定性快投保持边界与数值稳定", () => {
  for (const seed of [1, 42, 12345]) {
    const b = boot({ seed });
    for (let i = 0; i < 140 && !b.game.read().gameOver; i++) {
      b.tools.get("drop_museum_artifact").execute({ x: (((i * 7 + seed) % 11) + 0.5) / 11 });
      for (let f = 0; f < 21; f++) {
        b.game.advance(FRAME);
        b.game.read().bodies.forEach(contained);
        if (b.game.read().gameOver) break;
      }
    }
  }
});

console.log(`\n${results.length} checks passed`);
