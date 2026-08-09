// Seven knobs that between them cover the whole feel of the movement. Each one
// drives several of the raw constants in P, so the constants stay consistent
// with each other — e.g. asking for a taller jump also strengthens the wall kick
// and the terminal fall speed, which is what you would have done by hand.
//
// Drag until it feels right, hit Copy, paste the result over the P block.
import { P } from './player.js';

const STORE = 'stickman-tuning-v2';

const round = (v, places) => {
  const f = 10 ** places;
  return Math.round(v * f) / f;
};
const fmt = (v) => String(round(v, 2));

const KNOBS = [
  {
    key: 'topSpeed',
    label: 'top speed',
    min: 140, max: 620, step: 5,
    hint: 'how fast he ends up running',
  },
  {
    key: 'windup',
    label: 'wind-up',
    min: 0.02, max: 0.7, step: 0.01, unit: 's',
    hint: 'how long to reach that speed, and to shed it again',
  },
  {
    key: 'jumpHeight',
    label: 'jump height',
    min: 40, max: 240, step: 1,
    hint: 'how high a full jump goes',
  },
  {
    key: 'riseTime',
    label: 'rise time',
    min: 0.15, max: 0.6, step: 0.005, unit: 's',
    hint: 'how long it takes to get there — lower is snappier',
  },
  {
    key: 'fallWeight',
    label: 'fall weight',
    min: 1, max: 3.2, step: 0.05, unit: '×',
    hint: 'how much heavier the way down is than the way up',
  },
  {
    key: 'apexHang',
    label: 'apex hang',
    min: 0, max: 1, step: 0.02,
    hint: 'how long he floats at the top of a jump',
  },
  {
    key: 'wallKick',
    label: 'wall kick',
    min: 0, max: 520, step: 10,
    hint: 'how far a wall jump throws you off — small enough and you can climb one wall',
  },
];

/** Read the seven knobs back out of the raw constants. */
function settingsFromP() {
  return {
    topSpeed: P.MAX_RUN,
    windup: round(P.MAX_RUN / P.ACCEL, 2),
    jumpHeight: Math.round((P.JUMP_V * P.JUMP_V) / (2 * P.GRAVITY)),
    riseTime: round(P.JUMP_V / P.GRAVITY, 3),
    fallWeight: P.FALL_MULT,
    apexHang: round(0.5 + (0.42 - P.APEX_MULT) / 0.8, 2),
    wallKick: P.WALL_JUMP_VX,
  };
}

/** ...and push them back in. */
function applyToP(s) {
  P.MAX_RUN = s.topSpeed;
  P.ACCEL = s.topSpeed / s.windup;
  P.FRICTION = P.ACCEL * 1.3;
  P.AIR_ACCEL = P.ACCEL * 0.74;
  P.AIR_DRAG = P.ACCEL * 0.17;

  P.GRAVITY = (2 * s.jumpHeight) / (s.riseTime * s.riseTime);
  P.JUMP_V = (2 * s.jumpHeight) / s.riseTime;
  P.FALL_MULT = s.fallWeight;
  P.MAX_FALL = P.GRAVITY * 0.65;

  P.APEX_VY = Math.max(0, 110 + (s.apexHang - 0.5) * 180);
  P.APEX_MULT = Math.min(1, Math.max(0.08, 0.42 + (0.5 - s.apexHang) * 0.8));

  P.WALL_JUMP_VX = s.wallKick;
  P.WALL_JUMP_VY = P.JUMP_V * 1.14;
}

const DEFAULTS = settingsFromP();
const RAW = { ...P }; // reset puts back exactly what the code says, not a round-trip

export function buildTuner(panel, toggle) {
  const settings = { ...DEFAULTS };
  const rows = new Map();

  for (const knob of KNOBS) {
    const row = document.createElement('label');
    const name = document.createElement('span');
    name.textContent = knob.label;
    const value = document.createElement('b');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = knob.min;
    input.max = knob.max;
    input.step = knob.step;
    const hint = document.createElement('small');
    hint.textContent = knob.hint;

    const show = () => {
      input.value = settings[knob.key];
      value.textContent = fmt(settings[knob.key]) + (knob.unit || '');
    };
    input.addEventListener('input', () => {
      settings[knob.key] = parseFloat(input.value);
      value.textContent = fmt(settings[knob.key]) + (knob.unit || '');
      applyToP(settings);
      localStorage.setItem(STORE, JSON.stringify(settings));
    });

    row.append(name, value, input, hint);
    panel.append(row);
    rows.set(knob.key, show);
    show();
  }

  const refresh = () => rows.forEach((show) => show());

  const copy = button('Copy as code', async () => {
    const lines = [
      'MAX_RUN', 'ACCEL', 'FRICTION', 'AIR_ACCEL', 'AIR_DRAG',
      'JUMP_V', 'GRAVITY', 'FALL_MULT', 'MAX_FALL', 'APEX_VY', 'APEX_MULT',
      'WALL_JUMP_VX', 'WALL_JUMP_VY',
    ].map((k) => `  ${k}: ${fmt(P[k])},`);
    const text = `// paste over the matching lines in src/player.js\n${lines.join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      flash(copy, 'Copied');
    } catch {
      console.log(text);
      flash(copy, 'Logged to console');
    }
  });

  const reset = button('Reset', () => {
    Object.assign(settings, DEFAULTS);
    Object.assign(P, RAW);
    refresh();
    localStorage.removeItem(STORE);
  });

  const actions = document.createElement('div');
  actions.className = 'tuner-actions';
  actions.append(copy, reset);
  panel.append(actions);

  const note = document.createElement('p');
  note.className = 'tuner-note';
  note.textContent =
    'The levels are built around the defaults. Shrink the jump or the top speed much and some gaps stop being crossable.';
  panel.append(note);

  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) {
      for (const knob of KNOBS) {
        if (typeof saved[knob.key] === 'number') settings[knob.key] = saved[knob.key];
      }
      applyToP(settings);
      refresh();
    }
  } catch {
    /* ignore a corrupt blob */
  }

  const setOpen = (open) => {
    panel.classList.toggle('hidden', !open);
    toggle.textContent = open ? 'close tuning' : 'tuning';
  };
  setOpen(false);
  toggle.addEventListener('click', () => setOpen(panel.classList.contains('hidden')));
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyT' && !e.repeat) setOpen(panel.classList.contains('hidden'));
  });
}

function button(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function flash(el, text) {
  const was = 'Copy as code';
  el.textContent = text;
  setTimeout(() => (el.textContent = was), 1400);
}
