const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// --- Config ---
const TILE = 40;
const MAP_COLS = W / TILE;
const MAP_ROWS = H / TILE;
const PLAYER_SPEED = 180;
const BULLET_SPEED = 400;
const ENEMY_SPEED = 90;
const MAX_HP = 100;
const MAX_AMMO = 3;
const AMMO_REGEN_TIME = 1.8;
const BULLET_DAMAGE = 34;
const ENEMY_DAMAGE = 20;
const ENEMY_ATTACK_RANGE = 38;
const ENEMY_ATTACK_COOLDOWN = 1.2;

// --- State ---
let player, bullets, enemies, walls, kills, gameOver, gameStarted;
let mouseX = 0, mouseY = 0;
let keys = {};
let lastTime = 0;
let ammoRegenTimer = 0;

// --- Map: 0=floor, 1=wall ---
const MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

function buildWalls() {
    const w = [];
    for (let r = 0; r < MAP.length; r++) {
        for (let c = 0; c < MAP[r].length; c++) {
            if (MAP[r][c] === 1) {
                w.push({ x: c * TILE, y: r * TILE, w: TILE, h: TILE });
            }
        }
    }
    return w;
}

function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function isWallAt(x, y, size) {
    const half = size / 2;
    for (const w of walls) {
        if (rectOverlap(x - half, y - half, size, size, w.x, w.y, w.w, w.h)) return true;
    }
    return false;
}

function spawnEnemies(count) {
    const spawnPoints = [
        { x: 2.5, y: 2.5 }, { x: 15.5, y: 2.5 },
        { x: 2.5, y: 10.5 }, { x: 15.5, y: 10.5 },
        { x: 9, y: 5.5 }, { x: 9, y: 9.5 },
    ];
    const enemies = [];
    for (let i = 0; i < count; i++) {
        const sp = spawnPoints[i % spawnPoints.length];
        enemies.push({
            x: sp.x * TILE + (Math.random() - 0.5) * 20,
            y: sp.y * TILE + (Math.random() - 0.5) * 20,
            hp: MAX_HP,
            size: 22,
            color: pickEnemyColor(i),
            angle: 0,
            attackTimer: Math.random() * ENEMY_ATTACK_COOLDOWN,
            wobble: Math.random() * Math.PI * 2,
            type: i % 3,
            dead: false,
        });
    }
    return enemies;
}

function pickEnemyColor(i) {
    const colors = ['#e74c3c', '#9b59b6', '#e67e22', '#1abc9c', '#e84393', '#c0392b'];
    return colors[i % colors.length];
}

function startGame() {
    document.getElementById('overlay').style.display = 'none';
    walls = buildWalls();
    player = {
        x: W / 2, y: H / 2,
        hp: MAX_HP, ammo: MAX_AMMO,
        size: 26, angle: 0,
        color: '#3498db',
        shootCooldown: 0,
    };
    bullets = [];
    enemies = spawnEnemies(6);
    kills = 0;
    gameOver = false;
    gameStarted = true;
    ammoRegenTimer = 0;
    updateHUD();
    requestAnimationFrame(loop);
}

function loop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!gameOver) {
        update(dt);
        draw();
        requestAnimationFrame(loop);
    }
}

function update(dt) {
    // --- Player move ---
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup'])    dy -= 1;
    if (keys['s'] || keys['arrowdown'])  dy += 1;
    if (keys['a'] || keys['arrowleft'])  dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    dx = dx / len * PLAYER_SPEED * dt;
    dy = dy / len * PLAYER_SPEED * dt;

    const nx = player.x + dx;
    const ny = player.y + dy;
    if (!isWallAt(nx, player.y, player.size - 4)) player.x = nx;
    if (!isWallAt(player.x, ny, player.size - 4)) player.y = ny;

    // Face mouse
    const rect = canvas.getBoundingClientRect();
    player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);

    // Ammo regen
    if (player.ammo < MAX_AMMO) {
        ammoRegenTimer += dt;
        if (ammoRegenTimer >= AMMO_REGEN_TIME) {
            player.ammo++;
            ammoRegenTimer = 0;
        }
    }
    if (player.shootCooldown > 0) player.shootCooldown -= dt;

    // --- Bullets ---
    bullets = bullets.filter(b => {
        b.x += Math.cos(b.angle) * BULLET_SPEED * dt;
        b.y += Math.sin(b.angle) * BULLET_SPEED * dt;
        b.life -= dt;
        if (b.life <= 0) return false;
        if (isWallAt(b.x, b.y, 8)) return false;

        if (b.fromPlayer) {
            for (const e of enemies) {
                if (e.dead) continue;
                if (dist(b.x, b.y, e.x, e.y) < e.size / 2 + 5) {
                    e.hp -= BULLET_DAMAGE;
                    if (e.hp <= 0) { e.dead = true; kills++; }
                    return false;
                }
            }
        } else {
            if (dist(b.x, b.y, player.x, player.y) < player.size / 2 + 5) {
                player.hp -= BULLET_DAMAGE * 0.5;
                updateHUD();
                if (player.hp <= 0) triggerGameOver(false);
                return false;
            }
        }
        return true;
    });

    // --- Enemies AI ---
    for (const e of enemies) {
        if (e.dead) continue;
        e.wobble += dt * 2;
        const pdx = player.x - e.x;
        const pdy = player.y - e.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        e.angle = Math.atan2(pdy, pdx);

        // Move toward player but keep distance for ranged types
        const keepDist = e.type === 0 ? 50 : (e.type === 1 ? 160 : 100);
        if (pdist > keepDist + 10) {
            const spd = ENEMY_SPEED * dt;
            const ex = e.x + (pdx / pdist) * spd;
            const ey = e.y + (pdy / pdist) * spd;
            if (!isWallAt(ex, e.y, e.size - 4)) e.x = ex;
            if (!isWallAt(e.x, ey, e.size - 4)) e.y = ey;
        }

        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
            e.attackTimer = ENEMY_ATTACK_COOLDOWN;
            if (e.type === 0 && pdist < ENEMY_ATTACK_RANGE + e.size) {
                // Melee
                player.hp -= ENEMY_DAMAGE;
                updateHUD();
                if (player.hp <= 0) triggerGameOver(false);
            } else if (e.type !== 0 && pdist < 300) {
                // Ranged
                const spread = (Math.random() - 0.5) * 0.25;
                bullets.push({ x: e.x, y: e.y, angle: e.angle + spread, life: 1.2, fromPlayer: false, color: e.color });
                if (e.type === 2) {
                    bullets.push({ x: e.x, y: e.y, angle: e.angle + spread + 0.2, life: 1.2, fromPlayer: false, color: e.color });
                    bullets.push({ x: e.x, y: e.y, angle: e.angle + spread - 0.2, life: 1.2, fromPlayer: false, color: e.color });
                }
            }
        }
    }

    enemies = enemies.filter(e => !e.dead);
    document.getElementById('kills').textContent = `Kills: ${kills}`;

    if (enemies.length === 0) {
        triggerGameOver(true);
    }

    updateHUD();
}

function shoot() {
    if (player.ammo <= 0 || player.shootCooldown > 0) return;
    player.ammo--;
    player.shootCooldown = 0.15;
    ammoRegenTimer = 0;
    bullets.push({
        x: player.x + Math.cos(player.angle) * (player.size / 2 + 5),
        y: player.y + Math.sin(player.angle) * (player.size / 2 + 5),
        angle: player.angle,
        life: 1.4,
        fromPlayer: true,
        color: '#74b9ff'
    });
}

function draw() {
    ctx.clearRect(0, 0, W, H);

    // Floor
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, W, H);

    // Floor tiles
    for (let r = 0; r < MAP.length; r++) {
        for (let c = 0; c < MAP[r].length; c++) {
            if (MAP[r][c] === 0) {
                ctx.fillStyle = (r + c) % 2 === 0 ? '#3a7a32' : '#2d5a27';
                ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
            }
        }
    }

    // Walls
    for (const w of walls) {
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = '#A0926E';
        ctx.fillRect(w.x + 2, w.y + 2, w.w - 4, 6);
        ctx.fillStyle = '#6B5B45';
        ctx.fillRect(w.x, w.y + w.h - 4, w.w, 4);
    }

    // Bullets
    for (const b of bullets) {
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = b.color;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Enemies
    for (const e of enemies) {
        drawCharacter(ctx, e.x, e.y, e.size, e.color, e.angle, e.hp, MAX_HP, false);
    }

    // Player
    drawCharacter(ctx, player.x, player.y, player.size, player.color, player.angle, player.hp, MAX_HP, true);
}

function drawCharacter(ctx, x, y, size, color, angle, hp, maxHp, isPlayer) {
    ctx.save();
    ctx.translate(x, y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, size * 0.35, size * 0.4, size * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const r = size / 2;
    ctx.fillStyle = color;
    ctx.shadowBlur = isPlayer ? 12 : 6;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.25, r * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeDist = r * 0.35;
    const eyeAngle1 = angle - 0.4;
    const eyeAngle2 = angle + 0.4;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(Math.cos(eyeAngle1) * eyeDist, Math.sin(eyeAngle1) * eyeDist, r * 0.22, 0, Math.PI * 2);
    ctx.arc(Math.cos(eyeAngle2) * eyeDist, Math.sin(eyeAngle2) * eyeDist, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    const pupilOff = r * 0.1;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(Math.cos(eyeAngle1) * eyeDist + Math.cos(angle) * pupilOff, Math.sin(eyeAngle1) * eyeDist + Math.sin(angle) * pupilOff, r * 0.1, 0, Math.PI * 2);
    ctx.arc(Math.cos(eyeAngle2) * eyeDist + Math.cos(angle) * pupilOff, Math.sin(eyeAngle2) * eyeDist + Math.sin(angle) * pupilOff, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Gun barrel
    ctx.strokeStyle = isPlayer ? '#aad4f5' : '#ccc';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * r * 0.6, Math.sin(angle) * r * 0.6);
    ctx.lineTo(Math.cos(angle) * (r + 10), Math.sin(angle) * (r + 10));
    ctx.stroke();

    ctx.restore();

    // HP bar
    const barW = size * 1.4;
    const barH = 5;
    const bx = x - barW / 2;
    const by = y - size / 2 - 12;
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, barH, 3);
    ctx.fill();
    const hpRatio = Math.max(0, hp / maxHp);
    const hpColor = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(bx, by, barW * hpRatio, barH, 3);
    ctx.fill();
}

function triggerGameOver(won) {
    gameOver = true;
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `
        <h1>${won ? '🏆 SIEG!' : '💀 GAME OVER'}</h1>
        <p>${won ? 'Du hast alle Gegner besiegt!' : 'Du wurdest besiegt!'}</p>
        <p style="color:#f39c12; font-size:20px; margin-bottom:20px;">Kills: ${kills}</p>
        <button onclick="startGame()">NOCHMAL</button>
    `;
    overlay.style.display = 'flex';
}

function updateHUD() {
    document.getElementById('hp-fill').style.width = Math.max(0, player.hp / MAX_HP * 100) + '%';
    document.getElementById('ammo-fill').style.width = (player.ammo / MAX_AMMO * 100) + '%';
}

function dist(ax, ay, bx, by) {
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

// --- Input ---
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});
canvas.addEventListener('mousedown', e => {
    if (gameStarted && !gameOver && e.button === 0) shoot();
});
