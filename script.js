/* Retro Snake — final version + local leaderboard */

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

const leaderboardScreen = document.getElementById('leaderboardScreen');
const leaderboardList = document.getElementById('leaderboardList');
const btnBackFromLeaderboard = document.getElementById('btnBackFromLeaderboard');
const leaderboardBtn = document.getElementById('leaderboardBtn');

const LEADERBOARD_KEY = 'snakeHighScores';
const MAX_ENTRIES = 5;

let cols = 24;               
let cell = 20;               
let rows = cols;

let snake = [];
let dir = { x: 0, y: 0 };
let pending = null;
let food = { x: 0, y: 0 };
let score = 0;
let speedMs = 120;
let growth = 1;              
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
  const size = Math.floor(Math.min(vw * 0.95, vh * 0.68));
  cell = Math.max(10, Math.floor(size / cols));
  const final = cols * cell;
  canvas.width = final;
  canvas.height = final;
  draw();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* Draw neon grid background + current state */
function drawGridBackground() {
  ctx.fillStyle = '#001200';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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
  ctx.fillStyle = '#ff5c5c';
  ctx.fillRect(food.x * cell + 2, food.y * cell + 2, cell - 4, cell - 4);

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
  if (running && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  if (!running) return;
  if (['ArrowUp','w','W'].includes(e.key)) setPending({ x: 0, y: -1 });
  if (['ArrowDown','s','S'].includes(e.key)) setPending({ x: 0, y: 1 });
  if (['ArrowLeft','a','A'].includes(e.key)) setPending({ x: -1, y: 0 });
  if (['ArrowRight','d','D'].includes(e.key)) setPending({ x: 1, y: 0 });
  if (e.key === ' ') togglePause();
});

function setPending(p) {
  if (dir.x === -p.x && dir.y === -p.y) return;
  pending = p;
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
  if (pending && !(pending.x === -dir.x && pending.y === -dir.y)) {
    dir = pending; pending = null;
  }
  if (dir.x === 0 && dir.y === 0) return;

  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  if (wrap) {
    head.x = (head.x + cols) % cols;
    head.y = (head.y + rows) % rows;
  } else {
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) return gameOver();
  }

  if (snake.some((s, i) => i > 0 && s.x === head.x && s.y === head.y)) return gameOver();

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 1;
    eatSound.currentTime = 0; eatSound.play().catch(()=>{});
    placeFood();
    speedMs = Math.max(40, Math.round(speedMs * 0.97));
    restartLoop();
  } else {
    snake.pop();
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
  lastDifficulty = difficultySel.value;
  lastMode = modeSel.value;
  startPlay();
});
optionsBtn.addEventListener('click', () => optionsPanel.classList.toggle('hidden'));
exitBtn.addEventListener('click', () => {
  menu.classList.remove('hidden');
  optionsPanel.classList.add('hidden');
});

btnMute.addEventListener('click', () => {
  muted = !muted;
  btnMute.textContent = muted ? '🔇' : '🔊';
  bgMusic.muted = muted;
});

leaderboardBtn.addEventListener('click', () => {
  menu.classList.add('hidden');
  showLeaderboard();
});

btnBackFromLeaderboard.addEventListener('click', () => {
  leaderboardScreen.classList.add('hidden');
  menu.classList.remove('hidden');
});

function startPlay() {
  menu.classList.add('hidden');
  optionsPanel.classList.add('hidden');
  gameOverScreen.classList.add('hidden');

  const diff = lastDifficulty || difficultySel.value;
  const mode = lastMode || modeSel.value;
  wrap = (mode === 'wrap');

  if (diff === 'easy') speedMs = 220;
  else if (diff === 'normal') speedMs = 120;
  else speedMs = 70;

  growth = 1;

  running = true;
  initGame();
  restartLoop();

  if (!muted) {
    bgMusic.currentTime = 0;
    bgMusic.volume = 0.28;
    bgMusic.play().catch(()=>{});
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

/* ---------- Leaderboard ---------- */
function loadLeaderboard() {
  const data = localStorage.getItem(LEADERBOARD_KEY);
  return data ? JSON.parse(data) : [];
}

function saveLeaderboard(entries) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}
function addScore(name, score) {
  const entries = loadLeaderboard();
  const existing = entries.find(e => e.name === name);

  if (existing) {
    // update only if new score is higher
    if (score > existing.score) {
      existing.score = score;
    }
  } else {
    entries.push({ name, score });
  }

  // sort descending by score
  entries.sort((a, b) => b.score - a.score);

  // keep top MAX_ENTRIES
  const topEntries = entries.slice(0, MAX_ENTRIES);
  saveLeaderboard(topEntries);
}

function showLeaderboard() {
  leaderboardList.innerHTML = '';
  const entries = loadLeaderboard();
  if (entries.length === 0) {
    leaderboardList.innerHTML = '<li>No scores yet.</li>';
  } else {
    entries.forEach((e, i) => {
      const li = document.createElement('li');
      li.textContent = `${i + 1}. ${e.name} - ${e.score}`;
      leaderboardList.appendChild(li);
    });
  }
  leaderboardScreen.classList.remove('hidden');
}

/* ---------- Game Over ---------- */
function gameOver() {
  running = false;
  stopLoop();
  bgMusic.pause();

  let flash = 0;
  const flashInterval = setInterval(() => {
    drawGridBackground();
    ctx.fillStyle = (flash % 2 === 0) ? 'rgba(255,0,0,0.6)' : 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flash++;
    if (flash > 6) {
      clearInterval(flashInterval);
      finalScore.textContent = 'Score: ' + score;
      gameOverScreen.classList.remove('hidden');

      setTimeout(() => {
        const playerName = prompt("Game Over! Enter your name:", "Player");
        if (playerName) addScore(playerName, score);
        showLeaderboard();
      }, 600);
    }
  }, 120);
}

/* Buttons on Game Over */
btnRestart.addEventListener('click', () => {
  gameOverScreen.classList.add('hidden');
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
