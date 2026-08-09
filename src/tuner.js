// Live movement tuning. Drag the sliders until it feels right, hit Copy, and
// paste the result over the P block in player.js.
import { P } from './player.js';

const STORE = 'stickman-tuning';

// [key, min, max, step, group]
const SPECS = [
  ['MAX_RUN', 100, 700, 5, 'run'],
  ['ACCEL', 200, 4000, 25, 'run'],
  ['FRICTION', 200, 4000, 25, 'run'],
  ['AIR_ACCEL', 100, 3000, 25, 'run'],
  ['AIR_DRAG', 0, 1200, 10, 'run'],

  ['JUMP_V', 300, 1200, 5, 'jump'],
  ['GRAVITY', 800, 4500, 25, 'jump'],
  ['FALL_MULT', 1, 3.5, 0.05, 'jump'],
  ['APEX_VY', 0, 350, 5, 'jump'],
  ['APEX_MULT', 0.1, 1, 0.02, 'jump'],
  ['JUMP_CUT', 0.05, 1, 0.05, 'jump'],
  ['MAX_FALL', 400, 3000, 25, 'jump'],
  ['COYOTE', 0, 0.3, 0.01, 'jump'],
  ['BUFFER', 0, 0.3, 0.01, 'jump'],

  ['WALL_JUMP_VY', 300, 1300, 10, 'walls'],
  ['WALL_JUMP_VX', 0, 700, 10, 'walls'],
  ['WALL_LOCK', 0, 0.4, 0.01, 'walls'],
  ['SLIDE_SPEED', 0, 700, 10, 'walls'],
  ['CLIMB_TIME', 0.1, 1.2, 0.02, 'walls'],
];

const GROUPS = { run: 'Running', jump: 'Jumping', walls: 'Walls & ledges' };
const DEFAULTS = Object.fromEntries(SPECS.map(([k]) => [k, P[k]]));

export function buildTuner(panel, toggle) {
  const rows = new Map();

  for (const group of Object.keys(GROUPS)) {
    const h = document.createElement('h4');
    h.textContent = GROUPS[group];
    panel.append(h);

    for (const [key, min, max, step] of SPECS.filter((s) => s[4] === group)) {
      const row = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = key.toLowerCase().replace(/_/g, ' ');
      const value = document.createElement('b');
      const input = document.createElement('input');
      input.type = 'range';
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = P[key];
      value.textContent = fmt(P[key]);

      input.addEventListener('input', () => {
        P[key] = parseFloat(input.value);
        value.textContent = fmt(P[key]);
        save();
      });

      row.append(name, value, input);
      panel.append(row);
      rows.set(key, { input, value });
    }
  }

  const actions = document.createElement('div');
  actions.className = 'tuner-actions';

  const copy = button('Copy as code', async () => {
    const body = SPECS.map(([k]) => `  ${k}: ${fmt(P[k])},`).join('\n');
    const text = `// paste over the matching lines in src/player.js\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy as code'), 1200);
    } catch {
      console.log(text);
      copy.textContent = 'Logged to console';
      setTimeout(() => (copy.textContent = 'Copy as code'), 1600);
    }
  });

  const reset = button('Reset', () => {
    for (const [key, spec] of rows) {
      P[key] = DEFAULTS[key];
      spec.input.value = DEFAULTS[key];
      spec.value.textContent = fmt(DEFAULTS[key]);
    }
    localStorage.removeItem(STORE);
  });

  actions.append(copy, reset);
  panel.append(actions);

  const note = document.createElement('p');
  note.className = 'tuner-note';
  note.textContent = 'The levels are built around the default numbers — turn the jump down far enough and some gaps stop being crossable.';
  panel.append(note);

  // restore anything saved from a previous session
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    for (const [key, v] of Object.entries(saved)) {
      if (!rows.has(key)) continue;
      P[key] = v;
      rows.get(key).input.value = v;
      rows.get(key).value.textContent = fmt(v);
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

  function save() {
    const out = {};
    for (const [key] of rows) out[key] = P[key];
    localStorage.setItem(STORE, JSON.stringify(out));
  }
}

function button(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

const fmt = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
