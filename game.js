'use strict';
// =====================================================================
//  BRAWL CLONE  –  Pure Canvas 2D  –  No external dependencies
// =====================================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ── Constants ─────────────────────────────────────────────────────────
const TILE       = 40;
const BULLET_SPD = 420;
const AMMO_REGEN = 1.6;   // seconds per ammo
const SUPER_MAX  = 100;

// ── Particle pool ─────────────────────────────────────────────────────
let particles = [];
function spawnParticles(x, y, color, count = 8, spd = 140) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = spd * (0.5 + Math.random());
        particles.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v, life: 0.5 + Math.random()*0.4, maxLife: 1, r: 3 + Math.random()*3, color });
    }
}

// ── Brawler Definitions ───────────────────────────────────────────────
const BRAWLERS = [
    {
        id: 'shelly', name: 'Shelly', emoji: '🔫', color: '#e67e22',
        classLabel: 'Tank', classColor: '#e74c3c',
        desc: 'Schrotflinte – trifft alles in Nahkampf',
        superDesc: 'Super: Riesige Explosion',
        hp: 140, speed: 175, ammoMax: 3,
        stars: [4, 2, 3],
        attack(src) {
            const spread = 0.55, pellets = 6, range = 200;
            for (let i = 0; i < pellets; i++) {
                const a = src.angle - spread/2 + (spread/(pellets-1))*i;
                spawnBullet(src, a, range, 22, '#f39c12', 7, false);
            }
        },
        super(src) {
            spawnExplosion(src.x + Math.cos(src.angle)*60, src.y + Math.sin(src.angle)*60, 90, 60, src, '#f39c12');
        },
    },
    {
        id: 'colt', name: 'Colt', emoji: '🎯', color: '#3498db',
        classLabel: 'Schütze', classColor: '#3498db',
        desc: 'Sechs schnelle, präzise Kugeln',
        superDesc: 'Super: 12-Kugeln-Salve',
        hp: 90, speed: 190, ammoMax: 6,
        stars: [3, 4, 4],
        attack(src) {
            const offsets = [-0.07, 0.07];
            offsets.forEach(o => spawnBullet(src, src.angle + o, 380, 18, '#74b9ff', 5, true));
        },
        super(src) {
            for (let i = 0; i < 12; i++) {
                setTimeout(() => {
                    if (!src.dead) spawnBullet(src, src.angle + (Math.random()-0.5)*0.12, 500, 20, '#0984e3', 5, true);
                }, i * 60);
            }
        },
    },
    {
        id: 'bull', name: 'Bull', emoji: '🐂', color: '#e74c3c',
        classLabel: 'Nahkämpfer', classColor: '#c0392b',
        desc: 'Mächtige Schrotflinte auf kurze Distanz',
        superDesc: 'Super: Berserker-Sturmangriff',
        hp: 180, speed: 165, ammoMax: 3,
        stars: [5, 1, 2],
        attack(src) {
            const spread = 0.8, pellets = 8;
            for (let i = 0; i < pellets; i++) {
                const a = src.angle - spread/2 + (spread/(pellets-1))*i;
                spawnBullet(src, a, 130, 28, '#e74c3c', 8, false);
            }
        },
        super(src) {
            src.dashing = true;
            src.dashTimer = 0.55;
            src.dashAngle = src.angle;
            src.dashSpeed = 520;
        },
    },
    {
        id: 'spike', name: 'Spike', emoji: '🌵', color: '#2ecc71',
        classLabel: 'Distanz', classColor: '#27ae60',
        desc: 'Wirft Stacheln, die beim Aufprall explodieren',
        superDesc: 'Super: Stachelfeld in der Mitte',
        hp: 80, speed: 180, ammoMax: 3,
        stars: [4, 3, 5],
        attack(src) {
            const b = spawnBullet(src, src.angle, 280, 20, '#2ecc71', 8, true);
            b.explodeOnHit = true;
            b.explodeColor = '#27ae60';
            b.explodeRadius = 50;
            b.explodeDmg = 30;
        },
        super(src) {
            const cx = W/2, cy = H/2;
            for (let i = 0; i < 12; i++) {
                const a = (Math.PI*2/12)*i;
                spawnBullet({ x: cx, y: cy, fromPlayer: true }, a, 160, 18, '#27ae60', 8, false);
            }
            spawnParticles(cx, cy, '#2ecc71', 20, 120);
        },
    },
    {
        id: 'brock', name: 'Brock', emoji: '🚀', color: '#9b59b6',
        classLabel: 'Artillerie', classColor: '#8e44ad',
        desc: 'Langsame aber mächtige Rakete',
        superDesc: 'Super: Raketen-Regen (5 Raketen)',
        hp: 95, speed: 185, ammoMax: 3,
        stars: [5, 2, 4],
        attack(src) {
            const b = spawnBullet(src, src.angle, 500, 40, '#9b59b6', 10, true);
            b.rocket = true;
        },
        super(src) {
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const tx = src.x + (Math.random()-0.5)*300;
                    const ty = src.y + (Math.random()-0.5)*300;
                    spawnExplosion(tx, ty, 70, 50, src, '#9b59b6');
                }, i * 200);
            }
        },
    },
    {
        id: 'piper', name: 'Piper', emoji: '☂️', color: '#fd79a8',
        classLabel: 'Sniper', classColor: '#e84393',
        desc: 'Mehr Schaden auf Distanz',
        superDesc: 'Super: Teleport + Granaten-Regen',
        hp: 75, speed: 195, ammoMax: 3,
        stars: [5, 3, 3],
        attack(src) {
            const b = spawnBullet(src, src.angle, 600, 0, '#fd79a8', 5, true);
            b.sniper = true;
        },
        super(src) {
            // Teleport away from enemies
            src.x = W - src.x;
            src.y = H - src.y;
            spawnParticles(src.x, src.y, '#fd79a8', 16, 160);
            for (let i = 0; i < 4; i++) {
                setTimeout(() => {
                    const tx = src.x + (Math.random()-0.5)*200;
                    const ty = src.y + (Math.random()-0.5)*200;
                    spawnExplosion(tx, ty, 55, 35, src, '#fd79a8');
                }, i * 150);
            }
        },
    },
];

// ── Map ───────────────────────────────────────────────────────────────
const MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,1,0,0,0,1,0,1,0,0,1,1,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,1,1,0,0,0,1,0,1,0,0,1,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

let walls = [];
function buildWalls() {
    walls = [];
    for (let r = 0; r < MAP.length; r++)
        for (let c = 0; c < MAP[r].length; c++)
            if (MAP[r][c]) walls.push({ x: c*TILE, y: r*TILE, w: TILE, h: TILE });
}
function isWall(x, y, r) {
    for (const w of walls)
        if (x-r < w.x+w.w && x+r > w.x && y-r < w.y+w.h && y+r > w.y) return true;
    return false;
}
function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }

// ── Game State ────────────────────────────────────────────────────────
let player, bullets, enemies, floatTexts, kills, wave, gameActive, selectedBrawlerIdx = 0;
let mouseX = W/2, mouseY = H/2;
let keys = {};
let lastTime = 0;

// ── Bullet helpers ────────────────────────────────────────────────────
function spawnBullet(src, angle, maxRange, dmg, color, radius, pierce) {
    const b = {
        x: src.x + Math.cos(angle)*(((src.size||24)/2)+6),
        y: src.y + Math.sin(angle)*(((src.size||24)/2)+6),
        vx: Math.cos(angle)*BULLET_SPD,
        vy: Math.sin(angle)*BULLET_SPD,
        angle, dmg, color, radius,
        fromPlayer: src.fromPlayer !== false,
        pierce, maxRange, traveled: 0,
        dead: false,
    };
    bullets.push(b);
    return b;
}

function spawnExplosion(x, y, radius, dmg, src, color) {
    spawnParticles(x, y, color, 18, 180);
    const targets = src.fromPlayer !== false ? enemies : [player];
    (Array.isArray(targets) ? targets : [targets]).forEach(t => {
        if (t && !t.dead && dist(x,y,t.x,t.y) < radius + (t.size||24)/2) {
            t.hp -= dmg;
            spawnFloatText(t.x, t.y - 20, `-${dmg}`, color);
            if (t.hp <= 0) killEntity(t);
        }
    });
    // visual ring
    bullets.push({ x, y, explodeRing: true, radius: 0, maxR: radius, life: 0.35, color, dead: false });
}

// ── Float texts ───────────────────────────────────────────────────────
function spawnFloatText(x, y, text, color) {
    floatTexts.push({ x, y, text, color, life: 1.2, vy: -40 });
}

// ── Enemy Archetypes ──────────────────────────────────────────────────
const ENEMY_TYPES = [
    {
        name: 'Scrappe', color: '#e74c3c', hp: 80, speed: 95, size: 22,
        attackRange: 220, attackCool: 1.6, dmg: 18,
        fire(e) {
            spawnBullet({ x:e.x,y:e.y,size:e.size,fromPlayer:false }, e.angle, 280, e.dmg, e.color, 6, false);
        }
    },
    {
        name: 'Blaster', color: '#9b59b6', hp: 65, speed: 85, size: 20,
        attackRange: 300, attackCool: 2.0, dmg: 14,
        fire(e) {
            for (let i=-1;i<=1;i++)
                spawnBullet({ x:e.x,y:e.y,size:e.size,fromPlayer:false }, e.angle+i*0.22, 320, e.dmg*0.7, e.color, 6, false);
        }
    },
    {
        name: 'Tanker', color: '#e67e22', hp: 160, speed: 70, size: 28,
        attackRange: 55, attackCool: 1.0, dmg: 28,
        fire(e) {
            // melee burst
            if (dist(e.x,e.y,player.x,player.y) < e.attackRange + e.size) {
                player.hp -= e.dmg;
                spawnParticles(player.x, player.y, '#e67e22', 6, 80);
                spawnFloatText(player.x, player.y-20, `-${e.dmg}`, '#e67e22');
                if (player.hp <= 0) { triggerGameOver(false); }
            }
        }
    },
    {
        name: 'Sniper', color: '#1abc9c', hp: 55, speed: 105, size: 18,
        attackRange: 420, attackCool: 2.4, dmg: 32,
        fire(e) {
            const b = spawnBullet({ x:e.x,y:e.y,size:e.size,fromPlayer:false }, e.angle, 500, e.dmg, e.color, 5, true);
            b.sniper = true;
        }
    },
];

function spawnWave(waveNum) {
    const count = 4 + waveNum * 2;
    const spawnZones = [
        {x:2,y:2},{x:15,y:2},{x:2,y:10},{x:15,y:10},{x:9,y:2},{x:9,y:10},{x:2,y:6},{x:15,y:6}
    ];
    enemies = [];
    for (let i = 0; i < count; i++) {
        const sp = spawnZones[i % spawnZones.length];
        const type = ENEMY_TYPES[Math.floor(Math.random() * Math.min(ENEMY_TYPES.length, 1 + waveNum))];
        const hpScale = 1 + (waveNum - 1) * 0.25;
        enemies.push({
            x: sp.x * TILE + 10 + Math.random()*20,
            y: sp.y * TILE + 10 + Math.random()*20,
            hp: type.hp * hpScale,
            maxHp: type.hp * hpScale,
            speed: type.speed,
            size: type.size,
            color: type.color,
            attackRange: type.attackRange,
            attackCool: type.attackCool,
            attackTimer: Math.random() * type.attackCool,
            dmg: type.dmg,
            fire: type.fire.bind(null),
            angle: 0,
            dead: false,
            wobble: Math.random()*Math.PI*2,
        });
    }
}

function killEntity(e) {
    if (e.dead) return;
    e.dead = true;
    spawnParticles(e.x, e.y, e.color, 14, 160);
    if (e !== player) {
        kills++;
        player.super = Math.min(SUPER_MAX, player.super + 22);
    }
}

// ── Brawler Select UI ─────────────────────────────────────────────────
function showSelect() {
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('selectScreen').classList.remove('hidden');
    document.getElementById('gameCanvas').style.display = 'none';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('overlay').classList.add('hidden');
    renderBrawlerGrid();
}

function renderBrawlerGrid() {
    const grid = document.getElementById('brawlerGrid');
    grid.innerHTML = '';
    BRAWLERS.forEach((b, i) => {
        const card = document.createElement('div');
        card.className = 'brawler-card' + (i === selectedBrawlerIdx ? ' selected' : '');
        const stars = b.stars.map(s => `<div style="display:flex;gap:2px">${Array.from({length:5},(_,k)=>`<div class="stat-bar${k<s?' filled':''}"></div>`).join('')}</div>`).join('');
        card.innerHTML = `
            <div class="brawler-icon" style="background:${b.color}33;border:2px solid ${b.color}">${b.emoji}</div>
            <div class="brawler-class" style="background:${b.classColor}22;color:${b.classColor}">${b.classLabel}</div>
            <h3>${b.name}</h3>
            <div class="brawler-desc">${b.desc}</div>
            <div style="font-size:10px;color:${b.color};margin-top:4px">${b.superDesc}</div>
            <div class="stat-row">${stars}</div>`;
        card.onclick = () => { selectedBrawlerIdx = i; renderBrawlerGrid(); };
        grid.appendChild(card);
    });
}

// ── Game Init ─────────────────────────────────────────────────────────
function startGame() {
    document.getElementById('selectScreen').classList.add('hidden');
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('gameCanvas').style.display = 'block';
    document.getElementById('hud').classList.remove('hidden');

    buildWalls();
    bullets = [];
    floatTexts = [];
    particles = [];
    kills = 0;
    wave = 1;
    gameActive = true;

    const def = BRAWLERS[selectedBrawlerIdx];
    player = {
        x: W/2, y: H/2,
        hp: def.hp, maxHp: def.hp,
        ammo: def.ammoMax, ammoMax: def.ammoMax,
        ammoTimer: 0,
        super: 0,
        speed: def.speed,
        size: 26,
        angle: 0,
        color: def.color,
        attackCooldown: 0,
        def,
        dead: false,
        dashing: false, dashTimer: 0,
    };

    spawnWave(wave);
    updateHUD();
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

// ── Main Loop ─────────────────────────────────────────────────────────
function loop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (gameActive) {
        update(dt);
        draw();
        requestAnimationFrame(loop);
    }
}

function update(dt) {
    // --- Player movement ---
    let dx = 0, dy = 0;
    if (keys['w']||keys['arrowup'])    dy -= 1;
    if (keys['s']||keys['arrowdown'])  dy += 1;
    if (keys['a']||keys['arrowleft'])  dx -= 1;
    if (keys['d']||keys['arrowright']) dx += 1;
    const mv = Math.hypot(dx, dy) || 1;
    dx /= mv; dy /= mv;

    let spd = player.speed;
    if (player.dashing) {
        player.dashTimer -= dt;
        if (player.dashTimer <= 0) { player.dashing = false; }
        else {
            dx = Math.cos(player.dashAngle);
            dy = Math.sin(player.dashAngle);
            spd = player.dashSpeed;
        }
    }

    const nx = player.x + dx * spd * dt;
    const ny = player.y + dy * spd * dt;
    if (!isWall(nx, player.y, player.size/2 - 2)) player.x = clamp(nx, player.size/2, W - player.size/2);
    if (!isWall(player.x, ny, player.size/2 - 2)) player.y = clamp(ny, player.size/2, H - player.size/2);

    const rect = canvas.getBoundingClientRect();
    player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    if (player.attackCooldown > 0) player.attackCooldown -= dt;

    // Ammo regen
    if (player.ammo < player.ammoMax) {
        player.ammoTimer += dt;
        if (player.ammoTimer >= AMMO_REGEN) { player.ammo++; player.ammoTimer = 0; }
    }

    // --- Bullets ---
    bullets = bullets.filter(b => {
        if (b.dead) return false;
        if (b.explodeRing) {
            b.radius += (b.maxR / 0.35) * dt;
            b.life -= dt;
            return b.life > 0;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.traveled += Math.hypot(b.vx, b.vy) * dt;

        if (b.traveled > b.maxRange) return false;
        if (isWall(b.x, b.y, b.radius)) {
            if (b.explodeOnHit) spawnExplosion(b.x, b.y, b.explodeRadius, b.explodeDmg, {fromPlayer:b.fromPlayer}, b.explodeColor);
            spawnParticles(b.x, b.y, b.color, 4, 60);
            return false;
        }

        if (b.fromPlayer) {
            let hit = false;
            for (const e of enemies) {
                if (e.dead) continue;
                if (dist(b.x, b.y, e.x, e.y) < e.size/2 + b.radius) {
                    let dmg = b.dmg;
                    if (b.sniper) dmg = b.dmg * (1 + b.traveled / 300);
                    e.hp -= dmg;
                    spawnFloatText(e.x, e.y - 24, `-${Math.round(dmg)}`, b.color);
                    player.super = Math.min(SUPER_MAX, player.super + 8);
                    spawnParticles(b.x, b.y, b.color, 5, 80);
                    if (e.hp <= 0) killEntity(e);
                    if (b.explodeOnHit) { spawnExplosion(b.x, b.y, b.explodeRadius, b.explodeDmg, {fromPlayer:true}, b.explodeColor); return false; }
                    if (!b.pierce) { hit = true; break; }
                }
            }
            if (hit) return false;
        } else {
            if (!player.dead && dist(b.x, b.y, player.x, player.y) < player.size/2 + b.radius) {
                let dmg = b.dmg;
                if (b.sniper) dmg = b.dmg * (1 + b.traveled / 300);
                player.hp -= dmg;
                spawnParticles(b.x, b.y, b.color, 5, 80);
                spawnFloatText(player.x, player.y - 24, `-${Math.round(dmg)}`, '#e74c3c');
                if (player.hp <= 0 && !player.dead) triggerGameOver(false);
                return false;
            }
        }
        return true;
    });

    // --- Enemies AI ---
    for (const e of enemies) {
        if (e.dead) continue;
        e.wobble += dt * 1.8;
        if (!player.dead) {
            const pdx = player.x - e.x, pdy = player.y - e.y;
            const pdist = Math.hypot(pdx, pdy);
            e.angle = Math.atan2(pdy, pdx);

            const keepDist = e.attackRange * 0.75;
            if (pdist > keepDist) {
                const s = e.speed * dt;
                const ex = e.x + (pdx/pdist)*s;
                const ey = e.y + (pdy/pdist)*s;
                if (!isWall(ex, e.y, e.size/2-2)) e.x = clamp(ex, e.size/2, W-e.size/2);
                if (!isWall(e.x, ey, e.size/2-2)) e.y = clamp(ey, e.size/2, H-e.size/2);
            }

            e.attackTimer -= dt;
            if (e.attackTimer <= 0 && pdist < e.attackRange + e.size) {
                e.attackTimer = e.attackCool;
                e.fire(e);
            }
        }
    }

    enemies = enemies.filter(e => !e.dead);

    // --- Float texts ---
    for (const f of floatTexts) { f.y += f.vy * dt; f.life -= dt; }
    floatTexts = floatTexts.filter(f => f.life > 0);

    // --- Particles ---
    for (const p of particles) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.92; p.vy *= 0.92;
        p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);

    // --- Wave clear? ---
    if (enemies.length === 0 && gameActive) {
        wave++;
        if (wave > 5) { triggerGameOver(true); return; }
        player.hp = Math.min(player.maxHp, player.hp + 40);
        player.ammo = player.ammoMax;
        spawnParticles(player.x, player.y, '#f7c948', 20, 200);
        spawnWave(wave);
    }

    updateHUD();
}

// ── Draw ──────────────────────────────────────────────────────────────
function draw() {
    ctx.clearRect(0,0,W,H);

    // Floor
    for (let r = 0; r < MAP.length; r++) {
        for (let c = 0; c < MAP[r].length; c++) {
            if (MAP[r][c] === 0) {
                ctx.fillStyle = (r+c)%2===0 ? '#3a7a32' : '#306828';
                ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
            }
        }
    }

    // Walls
    for (const w of walls) {
        ctx.fillStyle = '#7a6040';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = '#9a7a50';
        ctx.fillRect(w.x+2, w.y+2, w.w-4, 8);
        ctx.fillStyle = '#5a4428';
        ctx.fillRect(w.x, w.y+w.h-5, w.w, 5);
    }

    // Explosion rings
    for (const b of bullets) {
        if (!b.explodeRing) continue;
        ctx.save();
        ctx.globalAlpha = b.life / 0.35 * 0.5;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
    }

    // Particles
    for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (p.life/p.maxLife), 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }

    // Bullets
    for (const b of bullets) {
        if (b.explodeRing) continue;
        ctx.save();
        ctx.shadowBlur = b.rocket ? 16 : 8;
        ctx.shadowColor = b.color;
        ctx.fillStyle = b.color;
        const r = b.rocket ? b.radius * 1.3 : b.radius;
        if (b.rocket) {
            ctx.translate(b.x, b.y);
            ctx.rotate(b.angle);
            ctx.beginPath();
            ctx.ellipse(0, 0, r, r*0.5, 0, 0, Math.PI*2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(b.x, b.y, r, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }

    // Enemies
    for (const e of enemies) drawChar(ctx, e, false);

    // Player
    drawChar(ctx, player, true);

    // Float texts
    for (const f of floatTexts) {
        ctx.save();
        ctx.globalAlpha = f.life / 1.2;
        ctx.fillStyle = f.color;
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
    }

    // Wave announcement (brief)
    if (enemies.length > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(247,201,72,0.18)';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Welle ${wave} · ${enemies.length} Gegner`, W - 10, 20);
        ctx.restore();
    }
}

function drawChar(ctx, e, isPlayer) {
    const { x, y, size, color, angle } = e;
    const r = size/2;

    ctx.save();
    ctx.translate(x, y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(2, r*0.85, r*0.7, r*0.28, 0, 0, Math.PI*2);
    ctx.fill();

    // Body glow
    ctx.shadowBlur = isPlayer ? 14 : 0;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Outline
    ctx.strokeStyle = isPlayer ? '#fff' : 'rgba(0,0,0,0.35)';
    ctx.lineWidth = isPlayer ? 2 : 1.5;
    ctx.stroke();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.arc(-r*0.27, -r*0.27, r*0.45, 0, Math.PI*2);
    ctx.fill();

    // Eyes
    const ea = [angle - 0.38, angle + 0.38];
    const ed = r * 0.4;
    ctx.fillStyle = '#fff';
    ea.forEach(a => { ctx.beginPath(); ctx.arc(Math.cos(a)*ed, Math.sin(a)*ed, r*0.22, 0, Math.PI*2); ctx.fill(); });
    ctx.fillStyle = '#111';
    ea.forEach(a => {
        const px = Math.cos(a)*ed + Math.cos(angle)*r*0.1;
        const py = Math.sin(a)*ed + Math.sin(angle)*r*0.1;
        ctx.beginPath(); ctx.arc(px, py, r*0.1, 0, Math.PI*2); ctx.fill();
    });

    // Gun
    ctx.strokeStyle = isPlayer ? '#ddd' : '#aaa';
    ctx.lineWidth = isPlayer ? 5 : 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle)*r*0.5, Math.sin(angle)*r*0.5);
    ctx.lineTo(Math.cos(angle)*(r+12), Math.sin(angle)*(r+12));
    ctx.stroke();

    ctx.restore();

    // HP bar
    const bw = size * 1.5, bh = 5;
    const bx = x - bw/2, by = y - r - 14;
    ctx.fillStyle = '#222';
    roundRect(ctx, bx, by, bw, bh, 3);
    ctx.fill();
    const ratio = Math.max(0, e.hp / (e.maxHp || e.hp));
    ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
    if (ratio > 0) { roundRect(ctx, bx, by, bw*ratio, bh, 3); ctx.fill(); }

    // Player name tag
    if (isPlayer) {
        ctx.save();
        ctx.font = 'bold 11px Arial';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(player.def.name, x, by - 3);
        ctx.restore();
    }
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
}

// ── HUD ───────────────────────────────────────────────────────────────
function updateHUD() {
    document.getElementById('hp-fill').style.width    = Math.max(0, player.hp/player.maxHp*100)+'%';
    document.getElementById('ammo-fill').style.width  = (player.ammo/player.ammoMax*100)+'%';
    document.getElementById('super-fill').style.width = (player.super/SUPER_MAX*100)+'%';
    document.getElementById('hud-kills').textContent  = `Kills: ${kills}`;
    document.getElementById('hud-wave').textContent   = `Welle ${wave}/5`;
    document.getElementById('super-btn-hint').style.color = player.super >= SUPER_MAX ? '#f7c948' : '#555';
}

// ── Game Over ─────────────────────────────────────────────────────────
function triggerGameOver(won) {
    gameActive = false;
    const overlay = document.getElementById('overlay');
    document.getElementById('overlay-title').textContent = won ? '🏆 SIEG!' : '💀 GAME OVER';
    document.getElementById('overlay-sub').textContent   = won ? 'Du hast alle 5 Wellen überstanden!' : 'Du wurdest besiegt...';
    document.getElementById('overlay-score').textContent = `Kills: ${kills}  ·  Welle ${wave}`;
    overlay.classList.remove('hidden');
}

// ── Input ─────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (!gameActive) return;

    // Attack on space
    if (e.key === ' ') { e.preventDefault(); fireAttack(); }

    // Super on E
    if (e.key.toLowerCase() === 'e') {
        if (player.super >= SUPER_MAX) {
            player.super = 0;
            player.def.super(player);
        }
    }
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', e => {
    if (!gameActive || e.button !== 0) return;
    fireAttack();
});

function fireAttack() {
    if (player.dead || player.attackCooldown > 0 || player.ammo <= 0) return;
    player.ammo--;
    player.ammoTimer = 0;
    player.attackCooldown = 0.18;
    player.def.attack(player);
}
