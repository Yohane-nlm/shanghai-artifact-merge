                 
"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    A = window.ARTIFACTS;
  if (!window.Matter || !Array.isArray(A) || A.length !== 9) {
    $("first-hint").textContent = "载入未完成，请刷新页面再试";
    return;
  }
  const { Engine, Bodies, Body, Composite, Events } = Matter;
  const W = 420,
    H = 610,
    LEFT = 17,
    RIGHT = 403,
    FLOOR = 592,
    DANGER = 111,
    R = [21, 27, 33, 40, 48, 57, 66, 76, 88];
                          
  const FEEL = Object.freeze({
    physicsSubsteps: 3,
    gravity: 2.25,
    restitution: 0.4,
    wallRestitution: 0.45,
    floorRestitution: 0.42,
    friction: 0.045,
    frictionStatic: 0.16,
    frictionAir: 0.0018,
    density: 0.0015,
    dropVelocity: 2.1,
    dropCooldown: 340,
    impactDuration: 440,
    mergeKick: 1.2,
    expansionPasses: 6,
    expansionSubsteps: 3,
    expansionSpeedCap: 30,
    mergePop: 1.28,
    mergePopMs: 220,
  });
  const P = [10, 25, 50, 90, 160, 280, 480, 800, 1400],
    COLORS = [
      "#d7e8c4",
      "#6fa796",
      "#d0b486",
      "#709c91",
      "#adc8dd",
      "#e6bdc0",
      "#97ae88",
      "#c8b778",
      "#c9a45e",
    ];
                           
  const SPRITE_FIT = [
    { cx: 132.5, cy: 138.5, k: 0.009445722095639722 },
    { cx: 124.0, cy: 124.0, k: 0.008932886340692902 },
    { cx: 126.0, cy: 142.5, k: 0.008598130841121496 },
    { cx: 106.0, cy: 126.5, k: 0.007785085722871178 },
    { cx: 126.5, cy: 134.0, k: 0.009633507853403141 },
    { cx: 127.5, cy: 128.5, k: 0.008720379146919432 },
    { cx: 128.0, cy: 124.0, k: 0.008363636363636365 },
    { cx: 127.0, cy: 127.5, k: 0.008748994068011526 },
    { cx: 135.5, cy: 126.5, k: 0.0070669230414576725 },
  ];
  const canvas = $("game"),
    ctx = canvas.getContext("2d", { alpha: false }),
    modal = $("modal");
  const engine = Engine.create({
    enableSleeping: true,
    positionIterations: 8,
    velocityIterations: 8,
    constraintIterations: 3,
  });
  engine.gravity.y = FEEL.gravity;
  const walls = [
    Bodies.rectangle(LEFT - 30, H / 2, 60, H * 3, {
      isStatic: true,
      friction: 0.045,
      restitution: FEEL.wallRestitution,
    }),
    Bodies.rectangle(RIGHT + 30, H / 2, 60, H * 3, {
      isStatic: true,
      friction: 0.045,
      restitution: FEEL.wallRestitution,
    }),
    Bodies.rectangle(W / 2, FLOOR + 30, W + 120, 60, {
      isStatic: true,
      friction: 0.08,
      restitution: FEEL.floorRestitution,
    }),
    Bodies.rectangle(W / 2, -30, W + 120, 60, {
      isStatic: true,
      friction: 0.045,
      restitution: FEEL.wallRestitution,
    }),
  ];
  Composite.add(engine.world, walls);
  const images = A.map((a) => {
    const i = new Image();
    i.src = "assets/" + a.id + ".png";
    return i;
  });
  let storageOK = true,
    saved = {};
  try {
    saved = JSON.parse(localStorage.getItem("shanghai-museum-merge-v1") || "{}") || {};
  } catch (e) {
    storageOK = false;
  }
  let best = Number.isFinite(saved.best) ? Math.max(0, saved.best) : 0;
  let unlocked = new Set(
    Array.isArray(saved.unlocked)
      ? saved.unlocked.filter((n) => Number.isInteger(n) && n >= 0 && n < 9)
      : [0],
  );
  unlocked.add(0);
  let sound = false,
    audio = null,
    score = 0,
    current = 0,
    next = 0,
    drops = 0,
    aim = W / 2,
    simTime = 0,
    lastDrop = -9999,
    paused = false,
    over = false,
    modalKind = "",
    returnToGallery = false;
  let pieces = [],
    particles = [],
    rings = [],
    floatTexts = [],
    mergeQueue = [],
    pendingCards = [],
    lastMerge = -9999,
    combo = 0,
    shake = 0,
    shakeAge = 999,
    overTimer = 0,
    danger = false,
    first = true,
    won = false,
    pointerId = null;
  let latest = Math.max(...unlocked),
    lastFrame = performance.now(),
    accumulator = 0,
    toastTimer,
    lastImpactTone = -9999,
    unlockTimer,
    lastUnlockNotice = -9999,
    noticeTier = 0,
    lastMergeTone = -9999,
    pendingMergeTone = -1;
  let expansionSolve = null;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const readout = () => ({
    score,
    best,
    drops,
    current: A[current].name,
    next: A[next].name,
    pieces: pieces.length,
    paused,
    gameOver: over,
    unlocked: [...unlocked].map((i) => A[i].name),
  });
  function save() {
    try {
      localStorage.setItem(
        "shanghai-museum-merge-v1",
        JSON.stringify({ best, unlocked: [...unlocked] }),
      );
    } catch (e) {
      storageOK = false;
    }
  }
  function announce(text) {
    $("announcer").textContent = text;
  }
  function toast(text) {
    clearTimeout(toastTimer);
    $("toast").textContent = text;
    $("toast").classList.add("show");
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2300);
  }
  function showUnlock(i) {
    noticeTier = i;
    lastUnlockNotice = simTime;
    $("unlock-image").src = images[i].src;
    $("unlock-title").textContent = "新珍藏 · " + A[i].name;
    $("unlock-fact").textContent = A[i].fact;
    $("unlock-notice").hidden = false;
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => {
      $("unlock-notice").hidden = true;
    }, 4400);
    announce("点亮新珍藏：" + A[i].name + "。" + A[i].fact);
  }
  function esc(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }
  function initAudio() {
    if (!sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") void audio.resume();
    } catch (e) {
      sound = false;
      updateSound();
    }
  }
  function chime(tier = 0, drop = false) {
    if (!sound || !audio) return;
    try {
      const now = audio.currentTime,
        tones = drop ? [330] : [523.25, 659.25, 783.99];
      tones.forEach((hz, n) => {
        const o = audio.createOscillator(),
          g = audio.createGain();
        o.type = drop ? "sine" : "triangle";
        o.frequency.value = hz * Math.pow(2, tier / 18);
        g.gain.setValueAtTime(0.0001, now + n * 0.045);
        g.gain.exponentialRampToValueAtTime(drop ? 0.045 : 0.055, now + n * 0.045 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + n * 0.045 + (drop ? 0.12 : 0.38));
        o.connect(g);
        g.connect(audio.destination);
        o.start(now + n * 0.045);
        o.stop(now + n * 0.045 + 0.42);
      });
    } catch (e) {}
  }
  function updateSound() {
    $("sound-btn").setAttribute("aria-pressed", String(sound));
    $("sound-btn").setAttribute(
      "aria-label",
      sound ? "关闭音效与触感反馈" : "开启音效与触感反馈（设备支持时）",
    );
    $("sound-label").textContent = sound ? "音效" : "静音";
    $("sound-btn").setAttribute(
      "title",
      sound ? "关闭音效与触感反馈" : "开启音效与触感反馈（设备支持时）",
    );
  }
  function updateUI() {
    $("score").textContent = score;
    $("best").textContent = best;
    $("next-image").src = images[next].src;
    $("next-image").alt = A[next].name;
    $("next-name").textContent = A[next].shortName || A[next].name;
    const count = unlocked.size;
    ["collection-count", "panel-count"].forEach((id) => ($(id).textContent = count + " / 9"));
    $("gallery-count").textContent = count + "/9";
    $("progression").innerHTML = A.map(
      (a, i) =>
        `<button class="artifact-step ${unlocked.has(i) ? "" : "locked"}" data-tier="${i}" aria-label="${unlocked.has(i) ? esc(a.name) : "第" + (i + 1) + "件，尚未解锁"}"><span class="step-icon"><img src="${images[i].src}" alt=""><span class="step-no">${i + 1}</span></span><span class="step-label">${unlocked.has(i) ? esc(a.shortName || a.name) : "待点亮"}</span></button>`,
    ).join("");
    $("latest-image").src = images[latest].src;
    $("latest-name").textContent = A[latest].name;
    $("latest-era").textContent = A[latest].era;
    $("latest-fact").textContent = A[latest].fact;
  }
  function pick() {
    const r = Math.random();
    return r < 0.42 ? 0 : r < 0.76 ? 1 : r < 0.94 ? 2 : 3;
  }
  function makePiece(tier, x, y, merged = false) {
    const r = R[tier];
    const b = Bodies.circle(Math.max(LEFT + r, Math.min(RIGHT - r, x)), Math.min(FLOOR - r, y), r, {
      restitution: FEEL.restitution,
      friction: FEEL.friction,
      frictionStatic: FEEL.frictionStatic,
      frictionAir: FEEL.frictionAir,
      density: FEEL.density,
      sleepThreshold: 60,
      label: "artifact",
    });
    b.game = {
      tier,
      born: simTime,
      mergedAt: merged ? simTime : -9999,
      removed: false,
      impactAt: -9999,
      impactStrength: 0,
      impactNx: 0,
      impactNy: 1,
      expansionSteps: 0,
    };
    pieces.push(b);
    Composite.add(engine.world, b);
    return b;
  }
  function drop() {
    if (paused || over || modal.open || simTime - lastDrop < FEEL.dropCooldown) return false;
    initAudio();
    if (!unlocked.has(current)) {
      unlocked.add(current);
      latest = current;
      pendingCards.push(current);
      save();
    } else if (first && !saved.unlocked) {
      pendingCards.push(0);
    }
    const b = makePiece(current, aim, 49);
    Body.setVelocity(b, { x: 0, y: FEEL.dropVelocity });
    lastDrop = simTime;
    drops++;
    first = false;
    $("first-hint").classList.add("hidden");
    current = next;
    next = drops === 1 ? 0 : drops === 2 ? 1 : pick();
    aim = Math.max(LEFT + R[current], Math.min(RIGHT - R[current], aim));
    chime(0, true);
    updateUI();
    announce(`投放第 ${drops} 件，下一件${A[current].name}`);
    return true;
  }
  function impact(body, other, speed, normal) {
    if (!body.game || body.game.removed || speed < 1.5 || simTime - body.game.impactAt < 85) return;
    const dx = other.position.x - body.position.x,
      dy = other.position.y - body.position.y,
      sign = dx * normal.x + dy * normal.y >= 0 ? 1 : -1;
    body.game.impactAt = simTime;
    body.game.impactStrength = Math.min(0.26, 0.035 + speed * 0.011);
    body.game.impactNx = normal.x * sign;
    body.game.impactNy = normal.y * sign;
  }
  function impactSound(speed) {
    if (!sound || !audio || speed < 4 || simTime - lastImpactTone < 100) return;
    lastImpactTone = simTime;
    try {
      const t = audio.currentTime,
        o = audio.createOscillator(),
        g = audio.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(240 + Math.min(speed, 20) * 12, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.13);
      g.gain.setValueAtTime(0.025, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g);
      g.connect(audio.destination);
      o.start(t);
      o.stop(t + 0.17);
    } catch (e) {}
  }
  function collision(e) {
    for (const pair of e.pairs) {
      const a = pair.bodyA,
        b = pair.bodyB;
      if (e.name === "collisionStart") {
        const n = pair.collision.normal,
          va = Body.getVelocity(a),
          vb = Body.getVelocity(b),
          speed = Math.abs((va.x - vb.x) * n.x + (va.y - vb.y) * n.y);
        impact(a, b, speed, n);
        impact(b, a, speed, n);
        impactSound(speed);
      }
      if (a.game && b.game && !a.game.removed && !b.game.removed && a.game.tier === b.game.tier) {
        const va = Body.getVelocity(a),
          vb = Body.getVelocity(b);
        a.game.removed = true;
        b.game.removed = true;
        mergeQueue.push([a, b, { x: va.x, y: va.y }, { x: vb.x, y: vb.y }]);
      }
    }
  }
  Events.on(engine, "collisionStart", collision);
  Events.on(engine, "collisionActive", collision);
                                     
                           
  function prepareExpansion(event) {
    expansionSolve = null;
    const roots = pieces.filter((p) => !p.game.removed && p.game.expansionSteps > 0);
    if (!roots.length) return;
    for (const p of roots) p.game.expansionSteps--;
    const nodes = pieces
      .filter((p) => !p.game.removed && !p.isStatic)
      .map((p) => ({
        p,
        x: p.position.x,
        y: p.position.y,
        x0: p.position.x,
        y0: p.position.y,
        r: R[p.game.tier],
        im: p.inverseMass,
        pre: Body.getVelocity(p),
      }));
    const active = new Set(roots.map((p) => p.id)),
      touched = new Set(),
      pairs = new Map(),
      walls = [];
    const clip = (n) => {
      const check = (penetration, nx, ny) => {
        if (penetration <= 0) return;
        n.x += nx * penetration;
        n.y += ny * penetration;
        walls.push({ n, nx, ny });
      };
      check(LEFT + n.r - n.x, 1, 0);
      check(n.x + n.r - RIGHT, -1, 0);
      check(n.y + n.r - FLOOR, 0, -1);
      check(n.r - n.y, 0, 1);
    };
    for (let pass = 0; pass < FEEL.expansionPasses; pass++) {
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i],
            b = nodes[j];
          if ((!active.has(a.p.id) && !active.has(b.p.id)) || a.p.game.tier === b.p.game.tier)
            continue;
          let dx = b.x - a.x,
            dy = b.y - a.y,
            d = Math.hypot(dx, dy),
            overlap = a.r + b.r - d;
          if (overlap <= 0.05) continue;
          if (d < 0.001) {
            dx = 1;
            dy = 0;
            d = 1;
          }
          const nx = dx / d,
            ny = dy / d,
            amount = Math.min(overlap - 0.05, 4) * 0.9,
            weight = a.im / (a.im + b.im);
          active.add(a.p.id);
          active.add(b.p.id);
          touched.add(a.p.id);
          touched.add(b.p.id);
          const key = a.p.id + ":" + b.p.id;
          if (!pairs.has(key)) pairs.set(key, { a, b, nx, ny });
          a.x -= nx * amount * weight;
          a.y -= ny * amount * weight;
          b.x += nx * amount * (1 - weight);
          b.y += ny * amount * (1 - weight);
        }
      for (const n of nodes) if (active.has(n.p.id)) clip(n);
    }
    if (!touched.size) return;                     
    const participants = nodes.filter((n) => touched.has(n.p.id));
    for (const n of participants) {
      Matter.Sleeping.set(n.p, false);
      Body.setPosition(n.p, { x: n.x, y: n.y });
    }
    expansionSolve = {
      nodes: participants,
      pairs: [...pairs.values()],
      walls: walls.filter((w) => touched.has(w.n.p.id)),
      factor: 1000 / 60 / event.delta,
    };
  }
  function finishExpansion() {
    if (!expansionSolve) return;
    const solve = expansionSolve;
    expansionSolve = null;
    for (const n of solve.nodes) {
      n.vx = (n.pre.x + (n.x - n.x0) * solve.factor) * 0.955;
      n.vy = n.pre.y + (n.y - n.y0) * solve.factor;
    }
                               
    for (const c of solve.pairs) {
      const a = c.a,
        b = c.b,
        approach = (a.pre.x - b.pre.x) * c.nx + (a.pre.y - b.pre.y) * c.ny;
      if (approach <= 55 / 60) continue;
      const separation = (b.vx - a.vx) * c.nx + (b.vy - a.vy) * c.ny,
        extra = FEEL.restitution * approach - separation;
      if (extra > 0) {
        const wa = a.im / (a.im + b.im);
        a.vx -= c.nx * extra * wa;
        a.vy -= c.ny * extra * wa;
        b.vx += c.nx * extra * (1 - wa);
        b.vy += c.ny * extra * (1 - wa);
      }
    }
    for (const c of solve.walls) {
      const n = c.n,
        pre = n.pre.x * c.nx + n.pre.y * c.ny;
      if (pre >= -55 / 60) continue;
      const separating = n.vx * c.nx + n.vy * c.ny,
        extra = -pre * (c.ny < 0 ? FEEL.floorRestitution : FEEL.wallRestitution) - separating;
      if (extra > 0) {
        n.vx += c.nx * extra;
        n.vy += c.ny * extra;
      }
    }
    for (const n of solve.nodes) {
      if (n.p.game.removed) continue;
      const rawSpeed = Math.hypot(n.vx, n.vy),
        limit = FEEL.expansionSpeedCap;
      if (rawSpeed > limit) {
        n.vx *= limit / rawSpeed;
        n.vy *= limit / rawSpeed;
      }
                      
      Body.setVelocity(n.p, { x: n.vx, y: n.vy });
    }
  }
  Events.on(engine, "beforeSolve", prepareExpansion);
  Events.on(engine, "afterUpdate", finishExpansion);
  function mergeSound(tier) {
    if (!sound || !audio || simTime - lastMergeTone < 50) return;
    lastMergeTone = simTime;
    try {
      const t = audio.currentTime,
        base = 240 * Math.pow(1.1225, 2 * Math.min(tier, 8));
      const voice = (type, from, to, duration, volume) => {
        const o = audio.createOscillator(),
          g = audio.createGain();
        o.type = type;
        o.frequency.setValueAtTime(from, t);
        o.frequency.exponentialRampToValueAtTime(to, t + duration);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(volume, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        o.connect(g);
        g.connect(audio.destination);
        o.start(t);
        o.stop(t + duration + 0.015);
      };
      voice("sine", 95, 48, 0.095, 0.05);
      voice("sine", base, base * 1.7, 0.2, 0.085);
      voice("triangle", base * 2, base * 3, 0.12, 0.028);
      if (!reduced && typeof navigator !== "undefined" && typeof navigator.vibrate === "function")
        navigator.vibrate(Math.min(14, 6 + tier));
    } catch (e) {}
  }
  function visualShape(p) {
    if (reduced) return { sx: 1, sy: 1, nx: 0, ny: 1, q: 0, pop: 1 };
    const g = p.game,
      age = simTime - g.impactAt;
    const q =
      age >= 0 && age < FEEL.impactDuration
        ? g.impactStrength * Math.exp(-age / 130) * Math.cos(age / 60)
        : 0;
    const stretch =
      Math.min(0.075, Math.abs(p.velocity.y) * 0.004) * (age > FEEL.impactDuration ? 1 : 0);
    const mergeAge = simTime - g.mergedAt;
    const pop =
      mergeAge >= 0 && mergeAge < FEEL.mergePopMs
        ? 1 + (FEEL.mergePop - 1) * (1 - mergeAge / FEEL.mergePopMs)
        : 1;
    return { sx: 1 - stretch * 0.65, sy: 1 + stretch, nx: g.impactNx, ny: g.impactNy, q, pop };
  }
  function burst(x, y, tier, points) {
    const child = Math.min(tier + 1, 8),
      color = COLORS[child],
      count = reduced ? 5 : 12 + child * 2,
      maxSpeed = (140 + 22 * child) / 60;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2,
        speed = reduced ? 0.4 : maxSpeed * (0.25 + Math.random() * 0.75);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (reduced ? 0 : 70 / 60),
        life: 420 + Math.random() * 350,
        age: 0,
        color: i % 3 === 0 ? "#e2b846" : color,
        size: 2 + Math.random() * 3.5,
      });
    }
    if (particles.length > 420) particles.splice(0, particles.length - 420);
    rings.push({ x, y, r: R[child] * 0.55, age: 0, color });
    if (rings.length > 12) rings.shift();
    floatTexts.push({ x, y: y - 20, text: "+" + points, age: 0, combo: combo > 1 ? combo : 0 });
    if (floatTexts.length > 12) floatTexts.shift();
    if (!reduced) {
      shake = Math.max(shake, Math.min(3.6, 2.0 + child * 0.15 + Math.min(combo - 1, 3) * 0.2));
      shakeAge = 0;
    }
  }
  function processMerges() {
    const batch = mergeQueue.splice(0);
    for (const [a, b, preA, preB] of batch) {
      const tier = a.game.tier;
      const x = (a.position.x + b.position.x) / 2,
        y = (a.position.y + b.position.y) / 2;
      Composite.remove(engine.world, [a, b]);
      pieces = pieces.filter((p) => p !== a && p !== b);
      combo = simTime - lastMerge < 1050 ? combo + 1 : 1;
      lastMerge = simTime;
      const points = P[tier];
      score += points;
      best = Math.max(best, score);
      burst(x, y, tier, points);
      if (tier < 8) {
        const c = makePiece(tier + 1, x, y, true);
        c.game.expansionSteps = FEEL.expansionSubsteps;
        Body.setVelocity(c, {
          x: (preA.x + preB.x) * 0.5,
          y: (preA.y + preB.y) * 0.5 - FEEL.mergeKick,
        });
        if (!unlocked.has(tier + 1)) {
          unlocked.add(tier + 1);
          latest = tier + 1;
          pendingCards.push(tier + 1);
        }
      } else {
        won = true;
        toast("镇馆之宝相遇！腾出空间，再藏一局");
      }
      pendingMergeTone = Math.max(pendingMergeTone, tier + 1);
      announce(`合成成功，获得 ${points} 分${tier < 8 ? "，" + A[tier + 1].name + "登场" : ""}`);
    }
    if (batch.length) {
      updateUI();
      save();
    }
  }
  function contain(p) {
    const r = R[p.game.tier],
      x = p.position.x,
      y = p.position.y;
    let nx = x,
      ny = y,
      vx = p.velocity.x,
      vy = p.velocity.y;
                                      
    if (x < LEFT + r - 1.5) {
      nx = LEFT + r;
      if (vx < 0) vx = -vx * FEEL.wallRestitution;
    }
    if (x > RIGHT - r + 1.5) {
      nx = RIGHT - r;
      if (vx > 0) vx = -vx * FEEL.wallRestitution;
    }
    if (y < r - 1.5) {
      ny = r;
      if (vy < 0) vy = -vy * FEEL.wallRestitution;
    }
    if (y > FLOOR - r + 1.5) {
      ny = FLOOR - r;
      if (vy > 0) vy = vy > 1 ? -vy * FEEL.floorRestitution : 0;
    }
    if (nx !== x || ny !== y) {
      Body.setPosition(p, { x: nx, y: ny });
      Body.setVelocity(p, { x: vx, y: vy });
    }
  }
  function step(dt) {
    for (let sub = 0; sub < FEEL.physicsSubsteps; sub++) {
      simTime += dt / FEEL.physicsSubsteps;
      Engine.update(engine, dt / FEEL.physicsSubsteps);
      processMerges();
      for (const p of pieces) contain(p);
    }
    if (pendingMergeTone >= 0) {
      mergeSound(pendingMergeTone);
      pendingMergeTone = -1;
    }
    for (const p of pieces) {
      if (!Number.isFinite(p.position.x) || !Number.isFinite(p.position.y)) {
        finish();
        return;
      }
    }
    const atTop = pieces.some(
      (p) =>
        simTime - p.game.born > 1700 && p.position.y - R[p.game.tier] < DANGER && p.speed < 2.8,
    );
    overTimer = atTop ? overTimer + dt : Math.max(0, overTimer - dt * 2);
    danger = overTimer > 250;
    $("danger-label").classList.toggle("active", danger);
    if (overTimer > 2300) {
      finish();
      return;
    }
    if (pendingCards.length && simTime - lastMerge > 180 && simTime - lastUnlockNotice > 2600) {
      showUnlock(pendingCards.shift());
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
  function drawArtifact(tier, x, y, r, angle = 0, scale = 1, alpha = 1, shape = null) {
    ctx.save();
    if (shape) {
      ctx.translate(x + shape.nx * r * shape.q, y + shape.ny * r * shape.q);
      const direction = Math.atan2(shape.ny, shape.nx);
      ctx.rotate(direction);
      ctx.scale(1 - shape.q, 1 + 0.85 * shape.q);
      ctx.rotate(-direction);
      ctx.scale(shape.sx * shape.pop, shape.sy * shape.pop);
    } else ctx.translate(x, y);
    ctx.rotate(angle * 0.85);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "#253a282c";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r);
    g.addColorStop(0, "#fffbea");
    g.addColorStop(0.42, COLORS[tier]);
    g.addColorStop(1, COLORS[tier]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = tier === 8 ? "#b78936" : "#54765a55";
    ctx.lineWidth = tier === 8 ? 2 : 1.2;
    ctx.stroke();
    ctx.strokeStyle = "#fffef299";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r - 3, Math.PI * 1.03, Math.PI * 1.62);
    ctx.stroke();
    if (images[tier].complete && images[tier].naturalWidth) {
      const fit = SPRITE_FIT[tier],
        k = r * fit.k;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.997, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        images[tier],
        -fit.cx * k,
        -fit.cy * k,
        images[tier].naturalWidth * k,
        images[tier].naturalHeight * k,
      );
      ctx.restore();
    }
    ctx.restore();
  }
  function draw(now, dt) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(W * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#fbf4df";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake > 0 && !reduced) {
      const kick = shake * Math.exp(-shakeAge / 42);
      ctx.translate(Math.sin(shakeAge / 25) * kick * 0.2, -Math.cos(shakeAge / 22) * kick);
      shakeAge += dt;
      if (shakeAge >= 160) shake = 0;
    }
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#fcf7e7");
    bg.addColorStop(1, "#eee5c7");
    ctx.fillStyle = bg;
    roundRect(LEFT, DANGER + 7, RIGHT - LEFT, FLOOR - DANGER - 7, 8);
    ctx.fill();
    ctx.strokeStyle = "#d9cfac";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LEFT, DANGER + 8);
    ctx.lineTo(LEFT, FLOOR);
    ctx.lineTo(RIGHT, FLOOR);
    ctx.lineTo(RIGHT, DANGER + 8);
    ctx.stroke();
              
    ctx.strokeStyle = "#c7bea01b";
    ctx.lineWidth = 1;
    for (let x = 47; x < W; x += 47) {
      ctx.beginPath();
      ctx.moveTo(x, DANGER + 12);
      ctx.lineTo(x, FLOOR);
      ctx.stroke();
    }
    ctx.strokeStyle = danger ? "#bd6654" : "#b29d6a88";
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.moveTo(LEFT + 1, DANGER);
    ctx.lineTo(RIGHT - 1, DANGER);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = danger ? "#a54c3b" : "#a08f67";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    if (!danger) ctx.fillText("满线前，给珍藏留点空间", LEFT + 7, DANGER - 10);
    if (!over) {
      ctx.strokeStyle = "#b5a16b66";
      ctx.lineWidth = 1.3;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.moveTo(aim, 49 + R[current]);
      ctx.lineTo(aim, FLOOR - 8);
      ctx.stroke();
      ctx.setLineDash([]);
      const ready = simTime - lastDrop >= FEEL.dropCooldown;
      drawArtifact(
        current,
        aim,
        49,
        R[current],
        0,
        pointerId !== null && !reduced ? 0.96 : 1,
        ready ? 0.94 : 0.35,
      );
      ctx.fillStyle = "#a19563";
      ctx.beginPath();
      ctx.moveTo(aim - 4, 8);
      ctx.lineTo(aim + 4, 8);
      ctx.lineTo(aim, 13);
      ctx.fill();
    }
                   
    for (const r of rings) {
      if (reduced || r.age > 280) continue;
      const radius = r.r * 1.7 + r.age * 0.16,
        halo = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, radius);
      halo.addColorStop(0, "#f8dc8499");
      halo.addColorStop(1, "#f8dc8400");
      ctx.globalAlpha = Math.max(0, 1 - r.age / 280);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const p of pieces)
      drawArtifact(
        p.game.tier,
        p.position.x,
        p.position.y,
        R[p.game.tier],
        p.angle,
        1,
        1,
        visualShape(p),
      );
    for (const p of particles) {
      p.age += dt;
      p.x += (p.vx * dt) / 16.67;
      p.y += (p.vy * dt) / 16.67;
      p.vy += (0.07 * dt) / 16.67;
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.age * 0.008);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    particles = particles.filter((p) => p.age < p.life);
    ctx.globalAlpha = 1;
    for (const r of rings) {
      r.age += dt;
      const t = Math.min(1, r.age / 280),
        radius = reduced ? r.r * 1.5 : r.r + (r.r + 38) * (1 - Math.pow(1 - t, 3));
      ctx.globalAlpha = Math.max(0, (1 - t) * 0.9);
      ctx.strokeStyle = "#c9a047";
      ctx.lineWidth = 1 + 4 * (1 - t);
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    rings = rings.filter((r) => r.age < 280);
    ctx.globalAlpha = 1;
    for (const f of floatTexts) {
      f.age += dt;
      ctx.globalAlpha = Math.min(1, Math.max(0, (1000 - f.age) / 400));
      ctx.textAlign = "center";
      ctx.font = "bold 24px Georgia";
      ctx.strokeStyle = "#fff6d8";
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y - f.age * 0.06);
      ctx.fillStyle = "#90672f";
      ctx.fillText(f.text, f.x, f.y - f.age * 0.06);
      if (f.combo > 1) {
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "#bf6b3e";
        ctx.fillText("连合 ×" + f.combo, f.x, f.y - f.age * 0.06 + 19);
      }
    }
    floatTexts = floatTexts.filter((f) => f.age < 1000);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function frame(t) {
    const dt = Math.min(50, Math.max(0, t - lastFrame));
    lastFrame = t;
    if (!paused && !over && !document.hidden) {
      accumulator = Math.min(accumulator + dt, 100);
      while (accumulator >= 1000 / 60) {
        step(1000 / 60);
        accumulator -= 1000 / 60;
        if (paused || over) {
          accumulator = 0;
          break;
        }
      }
    } else accumulator = 0;
    draw(t, paused ? Math.min(dt, 17) : dt);
    requestAnimationFrame(frame);
  }
  function showDialog(html, kind) {
    $("unlock-notice").hidden = true;
    paused = true;
    modalKind = kind;
    $("modal-body").innerHTML = html;
    if (!modal.open) modal.showModal();
    setTimeout(() => {
      const el = modal.querySelector("[data-autofocus]") || modal.querySelector("button");
      if (el) el.focus();
    }, 0);
  }
  function closeDialog() {
    modal.close();
    modalKind = "";
    returnToGallery = false;
    if (!over) {
      paused = false;
      lastFrame = performance.now();
    }
  }
  function artifactContent(i, fresh) {
    const a = A[i];
    return `<div class="dialog-content"><button class="close-btn" data-action="close-card" aria-label="关闭藏品卡">×</button><div class="dialog-kicker">${fresh ? "珍藏已点亮 · " + String(i + 1).padStart(2, "0") : "上博珍藏 · " + String(i + 1).padStart(2, "0")}</div><h2 id="modal-title">${esc(a.name)}</h2><div class="artifact-hero"><img src="${images[i].src}" alt="${esc(a.name)}艺术化示意"></div><div class="fact-meta"><span>${esc(a.era)}</span><span>上海博物馆藏</span></div><p>${esc(a.fact)}</p>${a.note ? '<p class="record-caption">' + esc(a.note) + "</p>" : ""}<a class="source-link" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看上海博物馆资料 ↗</a><button class="primary-btn" data-action="close-card" data-autofocus>${returnToGallery ? "返回珍藏图鉴" : fresh ? "收好，继续合成" : "继续合成"}</button></div>`;
  }
  function openArtifact(i, fresh = false) {
    if (!unlocked.has(i)) {
      toast("合成到第 " + (i + 1) + " 件，即可点亮这件珍藏");
      return;
    }
    showDialog(artifactContent(i, fresh), "artifact");
  }
  function openGallery() {
    returnToGallery = false;
    showDialog(
      `<div class="dialog-content"><button class="close-btn" data-action="resume" aria-label="关闭图鉴">×</button><div class="dialog-kicker">每一次相遇，都多认识一件文物</div><h2 id="modal-title">珍藏图鉴 <small style="font:16px Georgia;color:#9d7e43">${unlocked.size} / 9</small></h2><div class="gallery-grid">${A.map((a, i) => `<button class="gallery-item ${unlocked.has(i) ? "" : "locked"}" data-gallery-tier="${i}" aria-label="${unlocked.has(i) ? esc(a.name) : "第" + (i + 1) + "件，尚未解锁"}"><img src="${images[i].src}" alt=""><b>${unlocked.has(i) ? esc(a.name) : "尚待相遇"}</b><small>${String(i + 1).padStart(2, "0")}</small></button>`).join("")}</div><p class="record-caption">合成顺序是游戏设定，不代表年代、演变或价值排序。图片为艺术化示意，细节以官方资料为准。</p><button class="primary-btn" data-action="resume" data-autofocus>${over ? "返回本局结算" : "继续合成"}</button></div>`,
      "gallery",
    );
  }
  function openPause() {
    if (over) return;
    showDialog(
      `<div class="dialog-content"><div class="dialog-kicker">珍藏在这里，等你回来</div><h2 id="modal-title">歇一小会儿</h2><p>本局得分 <b>${score}</b></p><button class="primary-btn" data-action="resume" data-autofocus>继续合成</button><button class="secondary-btn" data-action="ask-restart">重新开一局</button><div class="key-tips">拖动瞄准，松手投放<br>键盘：← → 瞄准 · 空格投放 · P 暂停<br>最高分与图鉴仅保存在本设备，不会云端同步${storageOK ? "" : "<br>当前浏览器不支持保存，关闭后进度会丢失"}</div></div>`,
      "pause",
    );
  }
  function askRestart() {
    showDialog(
      `<div class="dialog-content"><div class="dialog-kicker">换个摆法，再来一次</div><h2 id="modal-title">重新开一局？</h2><p>本局的摆放和分数会清空。<br>已点亮的图鉴与最高纪录会保留。</p><button class="primary-btn" data-action="restart">重新开始</button><button class="secondary-btn" data-action="resume" data-autofocus>继续这一局</button></div>`,
      "restart",
    );
  }
  function gameOverDialog() {
    showDialog(
      `<div class="dialog-content"><div class="dialog-kicker">这间小展柜，已经满满当当</div><h2 id="modal-title">今天的珍藏，收好了</h2><div class="record-score">${score}</div><p class="record-caption">本局得分 · 最高纪录 ${best}</p><p>已点亮 ${unlocked.size} / 9 件上博珍藏</p><button class="primary-btn" data-action="restart" data-autofocus>再开一间小展柜</button><button class="secondary-btn" data-action="gallery">看看珍藏图鉴</button><p class="record-caption">${won ? "你已经让镇馆之宝相遇！" : unlocked.size < 9 ? "下一次，向大克鼎再近一点" : "九件珍藏全部点亮，继续挑战更高分"}</p></div>`,
      "over",
    );
  }
  function finish() {
    over = true;
    paused = true;
    best = Math.max(score, best);
    save();
    updateUI();
    announce("展柜满了，本局结束，得分" + score);
    gameOverDialog();
  }
  function reset() {
    Composite.clear(engine.world, false);
    Engine.clear(engine);
    Composite.add(engine.world, walls);
    pieces = [];
    particles = [];
    rings = [];
    floatTexts = [];
    mergeQueue = [];
    pendingCards = [];
    score = 0;
    current = 0;
    next = 0;
    drops = 0;
    lastUnlockNotice = -9999;
    $("unlock-notice").hidden = true;
    aim = W / 2;
    simTime = 0;
    lastDrop = -9999;
    lastMerge = -9999;
    lastImpactTone = -9999;
    lastMergeTone = -9999;
    pendingMergeTone = -1;
    expansionSolve = null;
    shake = 0;
    shakeAge = 999;
    combo = 0;
    overTimer = 0;
    danger = false;
    over = false;
    won = false;
    paused = false;
    first = true;
    pointerId = null;
    modalKind = "";
    returnToGallery = false;
    accumulator = 0;
    lastFrame = performance.now();
    if (modal.open) modal.close();
    $("first-hint").classList.remove("hidden");
    $("danger-label").classList.remove("active");
    updateUI();
    canvas.focus({ preventScroll: true });
  }
  function pointerAim(e) {
    const b = canvas.getBoundingClientRect();
    aim = Math.max(
      LEFT + R[current],
      Math.min(RIGHT - R[current], ((e.clientX - b.left) / b.width) * W),
    );
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || paused || over) return;
    e.preventDefault();
    pointerId = e.pointerId;
    canvas.setPointerCapture(pointerId);
    pointerAim(e);
    initAudio();
    if (e.pointerType === "mouse") {
      pointerId = null;
      drop();
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (paused || over) return;
    if (e.pointerType === "mouse" || pointerId === e.pointerId) pointerAim(e);
  });
  canvas.addEventListener("pointerup", (e) => {
    if (pointerId !== e.pointerId) return;
    pointerAim(e);
    pointerId = null;
    drop();
  });
  canvas.addEventListener("pointercancel", () => {
    pointerId = null;
  });
  document.addEventListener("keydown", (e) => {
    if (modal.open) return;
    if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (e.key === "ArrowLeft") aim = Math.max(LEFT + R[current], aim - 15);
    if (e.key === "ArrowRight") aim = Math.min(RIGHT - R[current], aim + 15);
    if (e.key === " ") drop();
    if (e.key.toLowerCase() === "p" || e.key === "Escape") openPause();
    if (e.key.toLowerCase() === "r") askRestart();
  });
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    if (over) {
      if (modalKind !== "over") gameOverDialog();
      return;
    }
    if (modalKind === "artifact" && returnToGallery) openGallery();
    else closeDialog();
  });
  modal.addEventListener("click", (e) => {
    const g = e.target.closest("[data-gallery-tier]");
    if (g) {
      const i = Number(g.dataset.galleryTier);
      if (unlocked.has(i)) {
        returnToGallery = true;
        openArtifact(i);
      } else toast("继续合成，点亮第 " + (i + 1) + " 件珍藏");
      return;
    }
    const b = e.target.closest("[data-action]");
    if (!b) return;
    switch (b.dataset.action) {
      case "close-card":
        if (returnToGallery) openGallery();
        else if (over) gameOverDialog();
        else closeDialog();
        break;
      case "resume":
        if (over) gameOverDialog();
        else closeDialog();
        break;
      case "restart":
        reset();
        break;
      case "ask-restart":
        askRestart();
        break;
      case "gallery":
        openGallery();
        break;
    }
  });
  $("unlock-open").addEventListener("click", () => openArtifact(noticeTier));
  $("unlock-dismiss").addEventListener("click", () => {
    $("unlock-notice").hidden = true;
  });
  $("gallery-btn").addEventListener("click", openGallery);
  $("pause-btn").addEventListener("click", openPause);
  $("sound-btn").addEventListener("click", () => {
    sound = !sound;
    initAudio();
    updateSound();
    if (sound) chime(2);
  });
  $("latest-card").addEventListener("click", () => openArtifact(latest));
  $("progression").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tier]");
    if (b) openArtifact(Number(b.dataset.tier));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !paused && !over) openPause();
  });
                           
  if (document.modelContext?.registerTool) {
    const life = new AbortController();
    const register = (t) => {
      try {
        Promise.resolve(document.modelContext.registerTool(t, { signal: life.signal })).catch(
          () => {},
        );
      } catch (e) {}
    };
    register({
      name: "read_museum_game",
      title: "查看文物合成状态",
      description: "读取当前得分、待投放文物和图鉴解锁状态，不改变游戏。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: () => readout(),
    });
    register({
      name: "drop_museum_artifact",
      title: "投放文物",
      description: "在展柜横向比例 x（0 到 1）处投放当前文物；暂停或冷却时不投放。",
      inputSchema: {
        type: "object",
        properties: { x: { type: "number", minimum: 0, maximum: 1 } },
        required: ["x"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        if (
          !input ||
          typeof input.x !== "number" ||
          !Number.isFinite(input.x) ||
          input.x < 0 ||
          input.x > 1 ||
          Object.keys(input).some((k) => k !== "x")
        )
          throw new Error("x 必须是 0 到 1 的数字");
        aim = Math.max(LEFT + R[current], Math.min(RIGHT - R[current], input.x * W));
        return { dropped: drop(), ...readout() };
      },
    });
    addEventListener("pagehide", () => life.abort(), { once: true });
  }

  updateUI();
  updateSound();
  requestAnimationFrame(frame);
})();
