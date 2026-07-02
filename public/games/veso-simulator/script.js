const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const target = document.getElementById('clickTarget');

let score = 0;
let userCredits = 0;
let userXP = 0;
let userLevel = 1;
let currentUser = null;

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

// Изчакваме логването на потребителя
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

function moveTarget() {
  const wrapper = canvas.parentElement;
  const maxX = wrapper.clientWidth - target.clientWidth;
  const maxY = wrapper.clientHeight - target.clientHeight;
  
  const randomX = Math.floor(Math.random() * maxX);
  const randomY = Math.floor(Math.random() * maxY);
  
  target.style.left = randomX + 'px';
  target.style.top = randomY + 'px';
}

target.addEventListener('click', async () => {
  score++;
  document.getElementById('scoreBadge').textContent = `Точки: ${score}`;
  
  // Добавяне на ефект на пулсация
  target.style.transform = 'scale(0.8)';
  setTimeout(() => { target.style.transform = 'scale(1)'; }, 100);
  
  moveTarget();

  // На всеки 10 точки се дават 1 кредит и 5 XP
  if (score % 10 === 0 && currentUser) {
    const updatedXP = userXP + 5;
    const updatedCredits = userCredits + 1;
    const updatedLevel = Math.floor(updatedXP / 100) + 1;
    
    const updates = { xp: updatedXP, credits: updatedCredits, level: updatedLevel };
    
    if (updatedLevel > userLevel) {
      updates.credits += (updatedLevel * 50); // Бонус при ниво
    }
    
    try {
      await db.collection('users').doc(currentUser.uid).update(updates);
    } catch(err) {
      console.error(err);
    }
  }
});

function draw() {
  ctx.fillStyle = '#0f1a0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Рисуване на матричен цифров фон
  ctx.fillStyle = 'rgba(76, 175, 80, 0.05)';
  ctx.font = '14px monospace';
  for (let i = 0; i < canvas.width; i += 20) {
    ctx.fillText(Math.floor(Math.random() * 2), i, Math.random() * canvas.height);
  }
}

setInterval(draw, 100);
moveTarget();
