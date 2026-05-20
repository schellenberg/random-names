/* -- Data -------------------------------------------------------------- */
const BUILTIN_DEFAULT_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Edward',
  'Fiona', 'George', 'Hannah', 'Ivan', 'Julia',
  'Kevin', 'Laura', 'Michael', 'Nancy', 'Oliver',
  'Patricia', 'Quinn', 'Rachel', 'Samuel', 'Tina'
];

const LS_KEY = 'rnp_default_names';

function getDefaultNames() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [...BUILTIN_DEFAULT_NAMES];
}

function saveAsDefault() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(names));
    const btn = document.getElementById('btn-save-default');
    btn.textContent = '✔  Saved!';
    setTimeout(() => { btn.textContent = '★  Save as default'; }, 1800);
  } catch (e) {}
}

const SLICE_COLORS = [
  '#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7',
  '#DDA0DD','#FF8C94','#A8E6CF','#FFD3A5','#FD9853',
  '#C3A6FF','#85E3FF','#B9FBC0','#FFBE0B','#FB5607',
  '#8338EC','#3A86FF','#FF006E','#06D6A0','#118AB2'
];

/* Returns an array of hex colors of length n with no two adjacent colors
   the same (including the wrap-around from last slice back to first).     */
function getSliceColors(n) {
  if (n === 0) return [];
  const c = SLICE_COLORS.length;
  const result = [];
  for (let i = 0; i < n; i++) {
    let idx = i % c;
    if (i > 0 && idx === result[i - 1]) idx = (idx + 1) % c;
    result.push(idx);
  }
  // Fix circular adjacency: last slice must differ from first
  if (n > 2 && result[n - 1] === result[0]) {
    let idx = (result[n - 1] + 1) % c;
    if (idx === result[n - 2]) idx = (idx + 1) % c;
    result[n - 1] = idx;
  }
  return result.map(i => SLICE_COLORS[i]);
}

/* -- Shared state (used by both p5 and plain JS) ----------------------- */
let names          = getDefaultNames();
let wheelAngle     = 0;
let spinVelocity   = 0;
let isSpinning     = false;
let lastWinnerIdx  = -1;

/* -- p5 sketch (instance mode keeps globals clean) --------------------- */
new p5(function (p) {

  let canvasSize;
  let lastTickSlice = -1;

  function calcSize() {
    const area = document.querySelector('.wheel-area');
    const availW = area.clientWidth  - 40;
    const availH = area.clientHeight - 90;  // leave room for spin button
    return Math.max(300, Math.min(availW, availH, 900));
  }

  p.setup = function () {
    canvasSize = calcSize();
    const cnv = p.createCanvas(canvasSize, canvasSize);
    cnv.parent('wheel-container');
    p.angleMode(p.RADIANS);
    p.noLoop();
    p.redraw();
  };

  window._p5Resize = function () {
    canvasSize = calcSize();
    p.resizeCanvas(canvasSize, canvasSize);
    p.redraw();
  };

  p.draw = function () {
    if (isSpinning) {
      spinVelocity *= 0.987;
      wheelAngle   += spinVelocity;

      // Tick sound each time a new slice passes the pointer
      if (names.length > 0) {
        const tickSliceCount = names.length === 1 ? 2 : names.length;
        const sa = p.TWO_PI / tickSliceCount;
        const la = ((3 * p.HALF_PI - wheelAngle) % p.TWO_PI + p.TWO_PI) % p.TWO_PI;
        const cs = Math.floor(la / sa);
        if (cs !== lastTickSlice) { lastTickSlice = cs; playTick(spinVelocity); }
      }

      if (spinVelocity < 0.0008) {
        isSpinning   = false;
        spinVelocity = 0;
        lastTickSlice = -1;
        p.noLoop();
        pickWinner();
      }
    }
    renderFrame();
  };

  /* -- Drawing helpers ----------------------------------------------- */

  function renderFrame() {
    p.background(15, 15, 26);
    if (names.length > 0) {
      drawWheel();
      drawPointer();
      drawHub();
    }
  }

  function drawWheel() {
    const cx = p.width / 2, cy = p.height / 2;
    const r  = p.width * 0.43;
    const n  = names.length;
    const sliceAngle = p.TWO_PI / n;
    const sliceColors = getSliceColors(n);

    // Subtle rim glow
    p.noFill();
    p.stroke(255, 255, 255, 25);
    p.strokeWeight(8);
    p.circle(cx, cy, r * 2 + 10);

    p.push();
    p.translate(cx, cy);
    p.rotate(wheelAngle);

    for (let i = 0; i < n; i++) {
      const startA = i * sliceAngle - p.HALF_PI;
      const endA   = startA + sliceAngle;

      // Slice fill
      p.fill(sliceColors[i]);
      p.stroke(15, 15, 26);
      p.strokeWeight(1.5);
      p.arc(0, 0, r * 2, r * 2, startA, endA, p.PIE);

      // Label - flip 180 deg so text reads correctly at the 9-o'clock pointer
      p.push();
      p.rotate(startA + sliceAngle / 2);
      p.rotate(p.PI);   // flip: text now reads left->right when slice is on the left

      const scaleFactor = p.constrain(p.width / 600, 0.45, 1);
      const fontSize = p.constrain(p.map(n, 4, 28, 44, 18) * scaleFactor, 11, 48);
      p.textSize(fontSize);
      p.textStyle(p.BOLD);
      p.textAlign(p.LEFT, p.CENTER);

      const maxChars = Math.round(p.map(n, 4, 28, 18, 7) * scaleFactor);
      let label = names[i].length > maxChars
        ? names[i].slice(0, maxChars - 1) + '…'
        : names[i];

      // In the flipped frame -x points outward, so negative tx puts text near outer edge
      const tx = -r * 0.92;

      // Shadow for readability (avoids stroke artifacts on bold glyphs)
      p.drawingContext.shadowColor = 'rgba(0,0,0,0.85)';
      p.drawingContext.shadowBlur  = 6;
      p.noStroke();
      p.fill(255);
      p.text(label, tx, 0);
      p.drawingContext.shadowColor = 'transparent';
      p.drawingContext.shadowBlur  = 0;

      p.pop();
    }

    p.pop();
  }

  function drawPointer() {
    const cx  = p.width / 2, cy = p.height / 2;
    const r   = p.width * 0.43;
    const tipX  = cx - r + 5;                   // tip touches left edge of wheel
    const baseX = tipX - p.width * 0.075;       // base extends to the LEFT (outside wheel)
    const hw    = p.width * 0.027;

    // Shadow
    p.noStroke();
    p.fill(0, 0, 0, 90);
    p.beginShape();
    p.vertex(tipX + 3,  cy);
    p.vertex(baseX + 3, cy - hw);
    p.vertex(baseX + 3, cy + hw);
    p.endShape(p.CLOSE);

    // Arrow
    p.fill(255, 215, 0);
    p.stroke(160, 110, 0);
    p.strokeWeight(1.5);
    p.beginShape();
    p.vertex(tipX,   cy);
    p.vertex(baseX,  cy - hw);
    p.vertex(baseX,  cy + hw);
    p.endShape(p.CLOSE);
  }

  function drawHub() {
    const cx = p.width / 2, cy = p.height / 2;
    const d  = p.width * 0.088;

    p.noStroke();
    p.fill(0, 0, 0, 110);
    p.circle(cx + 2, cy + 3, d + 4);

    p.fill(235);
    p.stroke(180);
    p.strokeWeight(2);
    p.circle(cx, cy, d);

    p.fill(140);
    p.noStroke();
    p.circle(cx, cy, d * 0.28);
  }

  /* -- Winner detection ----------------------------------------------- */
  function pickWinner() {
    const n          = names.length;
    const sliceAngle = p.TWO_PI / n;
    // Pointer is at angle PI (left side, 9 o'clock) in world space.
    // Slices start at -HALF_PI in wheel-local space.
    // Pointer local angle = PI - wheelAngle + HALF_PI = 3*HALF_PI - wheelAngle
    const localAngle = ((3 * p.HALF_PI - wheelAngle) % p.TWO_PI + p.TWO_PI) % p.TWO_PI;
    lastWinnerIdx    = Math.floor(localAngle / sliceAngle);
    showWinner(names[lastWinnerIdx]);
  }

  /* -- Expose triggers to outer JS ------------------------------------ */
  window._p5Redraw = ()  => p.redraw();
  window._p5Loop   = ()  => p.loop();

  // Click the canvas -> spin (same as the SPIN button)
  p.mousePressed = function () {
    const anyModalOpen =
      document.getElementById('import-overlay').classList.contains('active') ||
      document.getElementById('winner-overlay').classList.contains('active');
    if (anyModalOpen) return;
    const cx = p.width / 2, cy = p.height / 2;
    const r  = p.width * 0.43;
    if (p.dist(p.mouseX, p.mouseY, cx, cy) <= r) {
      document.getElementById('spin-btn').click();
    }
  };

}); // end p5 instance

/* -- UI logic ----------------------------------------------------------- */

function showWinner(name) {
  document.getElementById('winner-name-display').textContent = name;
  const left = names.length - 1;
  document.getElementById('remaining-info').textContent =
    left > 0 ? `${left} name${left !== 1 ? 's' : ''} remaining if removed`
             : 'This is the last name on the wheel!';
  const removeBtn = document.getElementById('btn-remove');
  const keepBtn = document.getElementById('btn-keep');
  const isFinalChoice = names.length === 1;
  removeBtn.style.display = isFinalChoice ? 'none' : '';
  keepBtn.textContent = isFinalChoice ? 'Return to Edit Mode' : 'Keep & Spin Again';
  document.querySelector('.modal-actions').classList.toggle('single-action', isFinalChoice);
  document.getElementById('winner-overlay').classList.add('active');
  document.getElementById('spin-btn').disabled = false;
  playCheer();
}

function closeModal() {
  document.getElementById('winner-overlay').classList.remove('active');
  window._p5Redraw && window._p5Redraw();
}

function setFocusMode(enabled) {
  document.body.classList.toggle('focus-mode', enabled);
  setTimeout(() => window._p5Resize && window._p5Resize(), 50);
}

function returnToEditMode() {
  names = getDefaultNames();
  syncUI();
  closeModal();
  setFocusMode(false);
}

function syncUI() {
  document.getElementById('name-list').value = names.join('\n');
  updateCount();
  updateEmptyState();
  window._p5Redraw && window._p5Redraw();
}

function updateCount() {
  const n = names.length;
  document.getElementById('name-count').textContent =
    `${n} name${n !== 1 ? 's' : ''}`;
}

function updateEmptyState() {
  const empty = names.length === 0;
  document.getElementById('empty-msg').style.display  = empty ? 'block' : 'none';
  document.getElementById('spin-btn').disabled        = empty || isSpinning;
}

/* -- Sound system (Web Audio API synthesis) ---------------------------- */
let audioCtx  = null;
let soundEnabled = true;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTick(velocity) {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  const t   = ctx.currentTime;
  const dur = 0.035;

  // Short noise burst shaped by a bandpass - pitch rises with speed
  const bufSize = Math.ceil(ctx.sampleRate * dur);
  const buf  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 600 + velocity * 3000;
  bp.Q.value = 6;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

  src.connect(bp); bp.connect(gain); gain.connect(ctx.destination);
  src.start(t); src.stop(t + dur);
}

function playCheer() {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  const t   = ctx.currentTime;

  // Ascending fanfare arpeggio
  [261.63, 329.63, 392.00, 523.25, 659.25, 783.99].forEach((freq, i) => {
    const delay = i * 0.075;
    [1, 1.005].forEach(detune => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq * detune;
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.22, t + delay + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.55);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + delay); osc.stop(t + delay + 0.6);
    });
  });

  // Crowd-noise burst underneath
  const nbuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.9), ctx.sampleRate);
  const nd   = nbuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const ns  = ctx.createBufferSource();  ns.buffer = nbuf;
  const nbp = ctx.createBiquadFilter();  nbp.type = 'bandpass'; nbp.frequency.value = 1400; nbp.Q.value = 0.4;
  const ng  = ctx.createGain();
  ng.gain.setValueAtTime(0.12, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  ns.connect(nbp); nbp.connect(ng); ng.connect(ctx.destination);
  ns.start(t);
}

document.getElementById('sound-btn').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('sound-btn');
  btn.textContent = soundEnabled ? '🔊 Sound On' : '🔇 Sound Off';
  btn.classList.toggle('muted', !soundEnabled);
});

/* -- Focus / fullscreen mode ------------------------------------------- */
document.getElementById('focus-btn').addEventListener('click', () => {
  setFocusMode(true);
});
document.getElementById('exit-focus-btn').addEventListener('click', () => {
  setFocusMode(false);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('focus-mode')) {
    e.preventDefault();
    document.getElementById('exit-focus-btn').click();
  }
});

/* -- Spin --------------------------------------------------------------- */
document.getElementById('spin-btn').addEventListener('click', () => {
  if (isSpinning || names.length === 0) return;
  // Auto-enter focus mode when spinning
  if (!document.body.classList.contains('focus-mode')) {
    document.body.classList.add('focus-mode');
    setTimeout(() => {
      window._p5Resize && window._p5Resize();
      triggerSpin();
    }, 80);
    return;
  }
  triggerSpin();
});

function triggerSpin() {
  spinVelocity = 0.32 + Math.random() * 0.22;
  isSpinning   = true;
  document.getElementById('spin-btn').disabled = true;
  window._p5Loop();
}

/* -- Modal actions ------------------------------------------------------ */
document.getElementById('btn-remove').addEventListener('click', () => {
  if (lastWinnerIdx >= 0 && lastWinnerIdx < names.length) {
    names.splice(lastWinnerIdx, 1);
    syncUI();
  }
  closeModal();
});

document.getElementById('btn-keep').addEventListener('click', () => {
  if (names.length === 1) {
    returnToEditMode();
    return;
  }
  closeModal();
});

/* -- Name list textarea ------------------------------------------------- */
document.getElementById('name-list').addEventListener('input', (e) => {
  names = e.target.value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  updateCount();
  updateEmptyState();
  window._p5Redraw && window._p5Redraw();
});

document.getElementById('btn-reset').addEventListener('click', () => {
  names = getDefaultNames();
  syncUI();
});

document.getElementById('btn-save-default').addEventListener('click', saveAsDefault);

document.getElementById('btn-clear').addEventListener('click', () => {
  names = [];
  syncUI();
});

document.getElementById('btn-import').addEventListener('click', openImportModal);

/* -- Edsby CSV import --------------------------------------------------- */

function openImportModal() {
  document.getElementById('import-error').textContent = '';
  document.getElementById('import-overlay').classList.add('active');
}
function closeImportModal() {
  document.getElementById('import-overlay').classList.remove('active');
  document.getElementById('csv-file-input').value = '';
}

document.getElementById('import-cancel').addEventListener('click', closeImportModal);

// Click drop-zone -> open file picker
document.getElementById('drop-zone').addEventListener('click', () => {
  document.getElementById('csv-file-input').click();
});

document.getElementById('csv-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleCSVFile(file);
});

// Drag-drop onto the import modal drop-zone
const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleCSVFile(file);
});

// Drag-drop anywhere on the main page
const wheelArea = document.querySelector('.wheel-area');
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (!document.getElementById('import-overlay').classList.contains('active'))
    wheelArea.classList.add('drag-active');
});
document.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget || e.relatedTarget === document.documentElement)
    wheelArea.classList.remove('drag-active');
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  wheelArea.classList.remove('drag-active');
  if (document.getElementById('import-overlay').classList.contains('active')) return;
  const file = e.dataTransfer.files[0];
  if (file) handleCSVFile(file);
});

function handleCSVFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
    showImportError('Please provide a .csv file.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const parsed = parseEdsbyCSV(e.target.result);
    if (parsed.error) { showImportError(parsed.error); return; }
    names = parsed.names;
    saveAsDefault();
    syncUI();
    closeImportModal();
  };
  reader.readAsText(file);
}

function parseEdsbyCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { error: 'File appears to be empty.' };

  function parseRow(line) {
    const cols = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  }

  const header = parseRow(lines[0]).map(h => h.toLowerCase());
  const nameIdx  = header.indexOf('name');
  const lastIdx  = header.indexOf('lastname');
  const firstIdx = header.indexOf('firstname');

  if (nameIdx === -1 && (lastIdx === -1 || firstIdx === -1))
    return { error: 'Could not find required columns. Expected "Name" or "FirstName"+"LastName". Is this an Edsby export?' };

  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    let displayName;

    if (nameIdx !== -1) {
      // Name column present: format is "LastName, FirstName"
      const raw = (cols[nameIdx] || '').trim();
      const commaIdx = raw.indexOf(',');
      if (commaIdx === -1) {
        // Fallback: no comma, use as-is
        displayName = raw;
      } else {
        const last  = raw.slice(0, commaIdx).trim();
        const first = raw.slice(commaIdx + 1).trim();
        if (!first && !last) continue;
        displayName = first + ' ' + last.charAt(0).toUpperCase();
      }
    } else {
      // No Name column - use FirstName + LastName initial
      const first = (cols[firstIdx] || '').trim();
      const last  = (cols[lastIdx]  || '').trim();
      if (!first && !last) continue;
      displayName = first + ' ' + last.charAt(0).toUpperCase();
    }

    if (displayName) result.push(displayName);
  }

  if (result.length === 0) return { error: 'No student rows found in the file.' };
  return { names: result };
}

function showImportError(msg) {
  document.getElementById('import-error').textContent = msg;
  // Make sure the import modal is open so the error is visible
  document.getElementById('import-overlay').classList.add('active');
}

/* -- Resize ------------------------------------------------------------- */
window.addEventListener('resize', () => {
  window._p5Resize && window._p5Resize();
});

/* -- Init --------------------------------------------------------------- */
syncUI();
