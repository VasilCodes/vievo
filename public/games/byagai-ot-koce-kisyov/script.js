const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const playerEl = document.getElementById('player');
const obstacleEl = document.getElementById('obstacle');
const gameOverScreen = document.getElementById('gameOverScreen');
const restartBtn = document.getElementById('restartBtn');

let score = 0;
let isJumping = false;
let playerY = 20; // от дъното на контейнера
let jumpVelocity = 0;
const gravity = 1.2;

let obstacleX = -100; // Ще се инициализира спрямо ширината на екрана
let obstacleSpeed = 8;
let gameActive = true;

let userCredits = 0;
let userXP = 0;
let userLevel = 1;
let currentUser = null;

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    db.collection('users').doc(user.uid).onSnapshot((doc) => {
      if (doc.exists) {
        const d = doc.data();
        userCredits = d.credits || 0;
        userXP = d.xp || 0;
        userLevel = d.level || 1;
        document.getElementById('creditsBadge').textContent = `💰 Кредити: ${userCredits}`;
        document.getElementById('xpBadge').textContent = `⚡ XP: ${userXP}`;
      }
    });
  } else {
    window.location.href = '/login/';
  }
});

function initGame() {
  score = 0;
  isJumping = false;
  playerY = 20;
  jumpVelocity = 0;
  obstacleX = canvas.parentElement.clientWidth;
  obstacleSpeed = 8;
  gameActive = true;
  
  playerEl.style.bottom = playerY + 'px';
  obstacleEl.style.left = obstacleX + 'px';
  
  gameOverScreen.style.opacity = '0';
  gameOverScreen.style.pointerEvents = 'none';
  
  document.getElementById('scoreBadge').textContent = 'Разстояние: 0м';
}

function jump() {
  if (!isJumping && gameActive) {
    isJumping = true;
    jumpVelocity = 18;
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    jump();
  }
});

canvas.parentElement.addEventListener('click', () => {
  jump();
});

restartBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  initGame();
});

async function awardRewards() {
  if (score < 50 || !currentUser) return;
  
  const creditsEarned = Math.floor(score / 50) * 2;
  const xpEarned = Math.floor(score / 50) * 10;
  
  const updatedXP = userXP + xpEarned;
  const updatedCredits = userCredits + creditsEarned;
  const updatedLevel = Math.floor(updatedXP / 100) + 1;
  
  const updates = { xp: updatedXP, credits: updatedCredits, level: updatedLevel };
  
  if (updatedLevel > userLevel) {
    updates.credits += (updatedLevel * 50); // Бонус при ниво
  }
  
  try {
    await db.collection('users').doc(currentUser.uid).update(updates);
    document.getElementById('gameRewardText').textContent = `Коце те настигна на ${score}м! Спечели: 💰 ${creditsEarned} и ⚡ ${xpEarned} XP!`;
  } catch (err) {
    console.error(err);
  }
}

function update() {
  if (!gameActive) return;
  
  // Обновяване на играча (Физика на скок)
  if (isJumping) {
    playerY += jumpVelocity;
    jumpVelocity -= gravity;
    if (playerY <= 20) {
      playerY = 20;
      isJumping = false;
      jumpVelocity = 0;
    }
    playerEl.style.bottom = playerY + 'px';
  }
  
  // Движение на препятствието
  obstacleX -= obstacleSpeed;
  if (obstacleX < -50) {
    obstacleX = canvas.parentElement.clientWidth;
    score += 10;
    document.getElementById('scoreBadge').textContent = `Разстояние: ${score}м`;
    
    // Плавно ускоряване
    if (obstacleSpeed < 18) obstacleSpeed += 0.5;
  }
  obstacleEl.style.left = obstacleX + 'px';
  
  // Колизия
  const playerRect = playerEl.getBoundingClientRect();
  const obstacleRect = obstacleEl.getBoundingClientRect();
  
  if (
    playerRect.right - 15 > obstacleRect.left &&
    playerRect.left + 15 < obstacleRect.right &&
    playerRect.bottom - 10 > obstacleRect.top
  ) {
    // Край на играта
    gameActive = false;
    document.getElementById('gameRewardText').textContent = `Коце те настигна на ${score}м!`;
    gameOverScreen.style.opacity = '1';
    gameOverScreen.style.pointerEvents = 'all';
    awardRewards();
  }
}

function draw() {
  ctx.fillStyle = '#0f101a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Рисуване на пътя и небето
  ctx.strokeStyle = '#2a2d4a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 20);
  ctx.lineTo(canvas.width, canvas.height - 20);
  ctx.stroke();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

initGame();
loop();
