console.log('Весо симулатор - в процес на разработка');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

function draw() {
  ctx.fillStyle = '#1a2e1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#4caf50';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🔧 В процес на разработка', canvas.width / 2, canvas.height / 2);
}

draw();
