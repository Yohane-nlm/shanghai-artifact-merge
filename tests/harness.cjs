const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

                                                                    
                                                             
const TEST_ACCESS = `
window.__testGame = {
  read: () => ({
    ...readout(), simTime, overTimer,
    bodies: pieces.map(p => ({
      tier: p.game.tier, id: p.id,
      x: p.position.x, y: p.position.y,
      vx: p.velocity.x, vy: p.velocity.y,
      speed: p.speed, r: R[p.game.tier],
      shape: visualShape(p)
    })),
    effects: { particles: particles.length, rings: rings.length, shake }
  }),
  drop, reset, close: closeDialog, pause: openPause, gallery: openGallery,
  advance(ms) {
    for (let t = 0; t < ms; t += 1000 / 60) {
      if (paused || over) break;
      step(1000 / 60);
    }
    draw(performance.now(), 16);
  },
  spawn(tier, x, y) { return makePiece(tier, x, y, true).id; },
  velocity(id, x, y) {
    const p = pieces.find(p => p.id === id);
    if (p) { Matter.Sleeping.set(p, false); Body.setVelocity(p, { x, y }); }
  },
  age(id, elapsed) {
    const p = pieces.find(p => p.id === id);
    if (p) p.game.born = simTime - elapsed;
  },
  expand(id) {
    const p = pieces.find(p => p.id === id);
    if (p) p.game.expansionSteps = FEEL.expansionSubsteps;
  },
  overflow() {
    const p = makePiece(0, 210, 100);
    Body.setStatic(p, true);
    p.game.born = -5000;
  }
};
`;

function boot({
  seed = 1,
  reduced = false,
  saved = { unlocked: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
} = {}) {
  const elements = new Map();
  const tools = new Map();
  const listeners = new Map();
  const context2d = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    {
      get: (target, key) => target[key] ?? (() => {}),
      set: (target, key, value) => ((target[key] = value), true),
    },
  );

  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {
        id,
        textContent: "",
        innerHTML: "",
        src: "",
        open: false,
        hidden: true,
        width: 420,
        height: 610,
        style: {},
        dataset: {},
        events: new Map(),
        classList: {
          add: (name) => classes.add(name),
          remove: (name) => classes.delete(name),
          toggle: (name, enabled) => (enabled ? classes.add(name) : classes.delete(name)),
        },
        setAttribute() {},
        focus() {},
        setPointerCapture() {},
        addEventListener(name, callback) {
          this.events.set(name, callback);
        },
        getContext: () => context2d,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 420, height: 610 }),
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
        querySelector: () => ({ focus() {} }),
      });
    }
    return elements.get(id);
  }

  let localData = JSON.stringify(saved);
  let randomState = seed >>> 0;
  const math = Object.create(Math);
  math.random = () => {
    randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const sandbox = {
    console,
    Math: math,
    Set,
    Map,
    Array,
    Object,
    Number,
    String,
    JSON,
    URLSearchParams,
    AbortController,
    Promise,
    Date,
    performance: { now: () => 0 },
    matchMedia: () => ({ matches: reduced }),
    localStorage: {
      getItem: () => localData,
      setItem: (_key, value) => {
        localData = value;
      },
    },
    location: { search: "" },
    devicePixelRatio: 1,
    setTimeout: () => 0,
    clearTimeout() {},
    requestAnimationFrame() {},
    Image: class {
      complete = true;
      naturalWidth = 256;
      naturalHeight = 256;
    },
    document: {
      hidden: false,
      getElementById: element,
      addEventListener: (name, callback) => listeners.set(name, callback),
      modelContext: { registerTool: (tool) => tools.set(tool.name, tool) },
    },
    addEventListener() {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ["vendor/matter.min.js", "src/artifacts.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), sandbox, { filename: file });
  }
  const code = fs.readFileSync(path.join(ROOT, "src/game.js"), "utf8");
  const end = code.lastIndexOf("})();");
  if (end < 0) throw new Error("Game wrapper was not found");
  vm.runInContext(code.slice(0, end) + TEST_ACCESS + code.slice(end), sandbox, {
    filename: "src/game.js",
  });
  return { game: sandbox.__testGame, elements, tools, sandbox };
}

module.exports = { boot, ROOT };
