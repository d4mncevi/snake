/* Retro Snake — final version
   - static neon grid background
   - options work (difficulty & wrap)
   - bg music starts on Start (user interaction)
   - chomp sound plays on eat
   - growth = 1 per food
   - red Game Over animation + Restart/Menu
*/

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

const menu = document.getElementById('menu');
const startBtn = document.getElementById('startBtn');
const optionsBtn = document.getElementById('optionsBtn');
const exitBtn = document.getElementById('exitBtn');
const optionsPanel = document.getElementById('optionsPanel');
const difficultySel = document.getElementById('difficulty');
const modeSel = document.getElementById('mode');
const btnMute = document.getElementById('btnMute');
const bgMusic = document.getElementById('bgMusic');
const eatSound = document.getElementById('eatSound');
const hudScore = document.getElementById('score');
const hudLen = document.getElementById('len');
const hudSpd = document.getElementById('spd');
const touchControls = document.getElementById('touchControls');
const dirButtons = document.querySelectorAll('[data-dir]');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScore = document.getElementById('finalScore');
const btnRestart = document.getElementById('btnRestart');
const btnBackMenu = document.getElementById('btnBackMenu');

let cols = 24;               // grid cells (square)
let cell = 20;               // px cell (calculated on resize)
let rows = cols;

let snake = [];
let dir = { x: 0, y: 0 };
let pending = null;
let food = { x: 0, y: 0 };
let score = 0;
let speedMs = 120;
let growth = 1;              // always 1
let wrap = true;

let running = false;
let loopId = null;
let muted = false;
let lastDifficulty = 'normal';
let lastMode = 'wrap';

/* ---------- Responsive canvas & grid ---------- */
function resizeCanvas() {
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  // portrait preference: leave space for HUD & menu => use min of vw*0.95 and vh*0.68
  const size = Math.floor(Math.min(vw * 0.95, vh * 0.68));
  // choose cell so cols * cell fits size
  cell = Math.max(10, Math.floor(size / cols));
  const final = cols * cell;
  canvas.width = final;
  canvas.height = final;
  draw(); // redraw background/grid
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* Draw neon grid background + current state */
function drawGridBackground() {
  // subtle dark fill
  ctx.fillStyle = '#001200';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // static neon grid lines
  ctx.strokeStyle = 'rgba(124,252,0,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= cols; i++) {
    const x = i * cell + 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    const y = j * cell + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
}

function draw() {
  drawGridBackground();

  // draw food
  ctx.fillStyle = '#ff5c5c';
  ctx.fillRect(food.x * cell + 2, food.y * cell + 2, cell - 4, cell - 4);

  // draw snake
  for (let i = 0; i < snake.length; i++) {
    ctx.fillStyle = i === 0 ? '#a8ff6b' : '#6bff3a';
    ctx.fillRect(snake[i].x * cell + 1, snake[i].y * cell + 1, cell - 2, cell - 2);
  }
}

/* ---------- Game init & placement ---------- */
function initGame() {
  snake = [];
  const startX = Math.floor(cols / 2);
  const startY = Math.floor(rows / 2);
  snake.push({ x: startX, y: startY });
  dir = { x: 0, y: 0 }; pending = null;
  placeFood();
  score = 0;
  updateHUD();
  draw();
}

function placeFood() {
  let tries = 0;
  do {
    food.x = Math.floor(Math.random() * cols);
    food.y = Math.floor(Math.random() * rows);
    tries++;
    if (tries > 2000) break;
  } while (snake.some(s => s.x === food.x && s.y === food.y));
}

/* ---------- HUD ---------- */
function updateHUD() {
  hudScore.textContent = score;
  hudLen.textContent = snake.length;
  hudSpd.textContent = (1000 / speedMs).toFixed(2) + ' Hz';
}

/* ---------- Input Handling ---------- */
window.addEventListener('keydown', (e) => {
  // prevent page scroll when playing
  if (running && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();

  if (!running) return;
  if (['ArrowUp','w','W'].includes(e.key)) setPending({ x: 0, y: -1 });
  if (['ArrowDown','s','S'].includes(e.key)) setPending({ x: 0, y: 1 });
  if (['ArrowLeft','a','A'].includes(e.key)) setPending({ x: -1, y: 0 });
  if (['ArrowRight','d','D'].includes(e.key)) setPending({ x: 1, y: 0 });
  if (e.key === ' ') togglePause();
});

function setPending(p) {
  // disallow immediate reverse
  if (dir.x === -p.x && dir.y === -p.y) return;
  pending = p;
  // if not running, start play (user initiated)
  if (!running) startPlay();
}

/* touch controls */
function adaptTouchControls() {
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  const small = window.innerWidth < 900;
  if (isTouch || small) {
    touchControls.classList.remove('hidden');
    touchControls.setAttribute('aria-hidden','false');
  } else {
    touchControls.classList.add('hidden');
    touchControls.setAttribute('aria-hidden','true');
  }
}
window.addEventListener('resize', adaptTouchControls);
adaptTouchControls();

dirButtons.forEach(b => {
  b.addEventListener('touchstart', (ev) => { ev.preventDefault(); handleDir(b.dataset.dir); }, {passive:false});
  b.addEventListener('mousedown', () => handleDir(b.dataset.dir));
});
function handleDir(d) {
  if (d === 'up') setPending({ x: 0, y: -1 });
  if (d === 'down') setPending({ x: 0, y: 1 });
  if (d === 'left') setPending({ x: -1, y: 0 });
  if (d === 'right') setPending({ x: 1, y: 0 });
}

/* ---------- Game step ---------- */
function step() {
  // apply pending direction
  if (pending && !(pending.x === -dir.x && pending.y === -dir.y)) {
    dir = pending; pending = null;
  }
  if (dir.x === 0 && dir.y === 0) return; // standing still until input

  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  if (wrap) {
    head.x = (head.x + cols) % cols;
    head.y = (head.y + rows) % rows;
  } else {
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) return gameOver();
  }

  // self-collision
  if (snake.some((s, i) => i > 0 && s.x === head.x && s.y === head.y)) return gameOver();

  snake.unshift(head);

  // eat?
  if (head.x === food.x && head.y === food.y) {
    score += 1 * 1; // score increments by 1 for each food
    // play eat sound (even if bg music muted)
    eatSound.currentTime = 0; eatSound.play().catch(()=>{});
    placeFood();
    // gentle speed increase
    speedMs = Math.max(40, Math.round(speedMs * 0.97));
    restartLoop();
  } else {
    snake.pop(); // grow only by 1 (we unshifted the head)
  }

  updateHUD();
  draw();
}

/* ---------- Loop control ---------- */
function restartLoop() {
  if (loopId) clearInterval(loopId);
  loopId = setInterval(step, speedMs);
}
function stopLoop() { if (loopId) { clearInterval(loopId); loopId = null; } }

/* ---------- Menu & Play controls ---------- */
startBtn.addEventListener('click', () => {
  // store chosen options
  lastDifficulty = difficultySel.value;
  lastMode = modeSel.value;
  startPlay();
});
optionsBtn.addEventListener('click', () => optionsPanel.classList.toggle('hidden'));
exitBtn.addEventListener('click', () => {
  // simple behavior - return to menu (or you can close)
  menu.classList.remove('hidden');
  optionsPanel.classList.add('hidden');
});

btnMute.addEventListener('click', () => {
  muted = !muted;
  btnMute.textContent = muted ? '🔇' : '🔊';
  bgMusic.muted = muted;
});

/* Start the actual playing state (hide menu, init, start loop) */
function startPlay() {
  menu.classList.add('hidden');
  optionsPanel.classList.add('hidden');
  gameOverScreen.classList.add('hidden');

  // apply options
  const diff = lastDifficulty || difficultySel.value;
  const mode = lastMode || modeSel.value;
  wrap = (mode === 'wrap');

  if (diff === 'easy') speedMs = 220;
  else if (diff === 'normal') speedMs = 120;
  else speedMs = 70;

  // ensure growth fixed to 1
  growth = 1;

  running = true;
  initGame();
  restartLoop();

  // play music now that user interacted
  if (!muted) {
    bgMusic.currentTime = 0;
    bgMusic.volume = 0.28;
    bgMusic.play().catch(()=>{ /* autoplay sometimes blocked, but this is user-initiated click */ });
  }
}

/* Pause toggle */
function togglePause() {
  if (!running) return;
  if (loopId) { stopLoop(); bgMusic.pause(); }
  else { restartLoop(); if (!muted) bgMusic.play().catch(()=>{}); }
}

/* Stop & reset */
function stopPlay() {
  running = false;
  stopLoop();
  bgMusic.pause();
  initGame();
  menu.classList.remove('hidden');
}

/* ---------- Game Over animation & UI ---------- */
function gameOver() {
  running = false;
  stopLoop();
  bgMusic.pause();

  // flash red a few times
  let flash = 0;
  const flashInterval = setInterval(() => {
    drawGridBackground();
    ctx.fillStyle = (flash % 2 === 0) ? 'rgba(255,0,0,0.6)' : 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flash++;
    if (flash > 6) {
      clearInterval(flashInterval);
      showGameOverScreen();
    }
  }, 120);
}

function showGameOverScreen() {
  finalScore.textContent = 'Score: ' + score;
  gameOverScreen.classList.remove('hidden');
}

/* Buttons on Game Over */
btnRestart.addEventListener('click', () => {
  gameOverScreen.classList.add('hidden');
  // restart with same options
  startPlay();
});
btnBackMenu.addEventListener('click', () => {
  gameOverScreen.classList.add('hidden');
  menu.classList.remove('hidden');
  stopPlay();
});

/* ---------- Init ---------- */
initGame();
adaptTouchControls();
resizeCanvas();
canvas.addEventListener('touchstart', (e)=> e.preventDefault(), {passive:false});
