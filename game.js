'use strict';
// =====================================================================
//  BRAWL CLONE  –  Pure Canvas 2D  –  3 Modes: Arena, BrawlBall, Showdown
// =====================================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ── Constants ─────────────────────────────────────────────────────────
const TILE       = 40;
const BULLET_SPD = 420;
const AMMO_REGEN = 1.6;
const SUPER_MAX  = 100;

// ── Mode state ────────────────────────────────────────────────────────
let currentMode = 'arena';
let selectedMode = 'arena';

// ── Particle pool ─────────────────────────────────────────────────────
let particles = [];
function spawnParticles(x, y, color, count, spd) {
    count = count || 8; spd = spd || 140;
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
                    if (src && !src.dead) spawnBullet(src, src.angle + (Math.random()-0.5)*0.12, 500, 20, '#0984e3', 5, true);
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
                spawnBullet({ x: cx, y: cy, fromPlayer: src.fromPlayer !== false, teamBlue: src.teamBlue }, a, 160, 18, '#27ae60', 8, false);
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

// ── Maps ──────────────────────────────────────────────────────────────
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

// BrawlBall: rows 4-8 have open left/right edges (goal openings)
const BB_MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// Showdown: more open with scattered clusters
const SHOWDOWN_MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
    [1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

let walls = [];
let activeMap = MAP;

function buildWalls(mapData) {
    walls = [];
    activeMap = mapData || MAP;
    for (let r = 0; r < activeMap.length; r++)
        for (let c = 0; c < activeMap[r].length; c++)
            if (activeMap[r][c]) walls.push({ x: c*TILE, y: r*TILE, w: TILE, h: TILE });
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
        teamBlue: src.teamBlue === true,
        ownerRef: src,
        pierce, maxRange, traveled: 0,
        dead: false,
    };
    bullets.push(b);
    return b;
}

function spawnExplosion(x, y, radius, dmg, src, color) {
    spawnParticles(x, y, color, 18, 180);
    let targets = [];
    if (currentMode === 'arena') {
        if (src.fromPlayer !== false) targets = enemies ? enemies.slice() : [];
        else targets = [player];
    } else if (currentMode === 'brawlball') {
        if (src.teamBlue) targets = bbRedTeam ? bbRedTeam.slice() : [];
        else targets = [player, ...(bbBlueAllies || [])];
    } else if (currentMode === 'showdown') {
        targets = sdEntities ? sdEntities.filter(e => e !== src && !e.dead) : [];
    }
    targets.forEach(t => {
        if (t && !t.dead && dist(x,y,t.x,t.y) < radius + (t.size||24)/2) {
            t.hp -= dmg;
            spawnFloatText(t.x, t.y - 20, `-${dmg}`, color);
            if (t.hp <= 0) killEntityGeneric(t);
        }
    });
    bullets.push({ x, y, explodeRing: true, radius: 0, maxR: radius, life: 0.35, color, dead: false });
}

// ── Float texts ───────────────────────────────────────────────────────
function spawnFloatText(x, y, text, color) {
    floatTexts.push({ x, y, text, color, life: 1.2, vy: -40 });
}

// ── Generic kill ──────────────────────────────────────────────────────
function killEntityGeneric(e) {
    if (e.dead) return;
    e.dead = true;
    spawnParticles(e.x, e.y, e.color || '#fff', 14, 160);
    if (e !== player) {
        kills++;
        if (player) player.super = Math.min(SUPER_MAX, player.super + 22);
    }
}

// ── Enemy Archetypes (Arena) ──────────────────────────────────────────
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
            if (player && !player.dead && dist(e.x,e.y,player.x,player.y) < e.attackRange + e.size) {
                player.hp -= e.dmg;
                spawnParticles(player.x, player.y, '#e67e22', 6, 80);
                spawnFloatText(player.x, player.y-20, `-${e.dmg}`, '#e67e22');
                if (player.hp <= 0) triggerGameOver(false);
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
            fire: type.fire,
            angle: 0,
            dead: false,
            wobble: Math.random()*Math.PI*2,
        });
    }
}

// ── BrawlBall ─────────────────────────────────────────────────────────
let ball = null;
let bbScore = { blue: 0, red: 0 };
let bbBlueAllies = [];
let bbRedTeam = [];
let bbResetTimer = 0;
let bbResetting = false;
const BB_GOAL_Y_MIN = 160, BB_GOAL_Y_MAX = 360;

function makeCharacter(def, x, y, isPlayerChar, teamBlue) {
    return {
        x, y,
        hp: def.hp, maxHp: def.hp,
        ammo: def.ammoMax, ammoMax: def.ammoMax,
        ammoTimer: 0,
        super: 0,
        speed: def.speed,
        size: 26,
        angle: 0,
        color: def.color,
        attackCooldown: 0,
        attackTimer: Math.random() * 1.5,
        def,
        dead: false,
        dashing: false, dashTimer: 0, dashAngle: 0, dashSpeed: 0,
        fromPlayer: isPlayerChar || (teamBlue === true),
        teamBlue: teamBlue !== false,
        isPlayer: !!isPlayerChar,
    };
}

function updateBBScore() {
    document.getElementById('bb-score').textContent = `🔵 ${bbScore.blue} – ${bbScore.red} 🔴`;
}

function bbGoal(team) {
    if (bbResetting) return;
    bbResetting = true;
    bbResetTimer = 1.5;
    if (team === 'blue') { bbScore.blue++; spawnParticles(W/2, H/2, '#3498db', 30, 220); }
    else { bbScore.red++; spawnParticles(W/2, H/2, '#e74c3c', 30, 220); }
    updateBBScore();
    spawnFloatText(W/2, H/2 - 40, team === 'blue' ? '🔵 TOR!' : '🔴 TOR!', team === 'blue' ? '#3498db' : '#e74c3c');
    if (bbScore.blue >= 2 || bbScore.red >= 2) {
        const won = bbScore.blue >= 2;
        setTimeout(() => triggerGameOver(won), 1200);
    }
}

function bbResetPositions() {
    ball.x = W/2; ball.y = H/2; ball.vx = 0; ball.vy = 0;
    player.x = W/2; player.y = H/2 + 40; player.hp = player.maxHp;
    if (bbBlueAllies[0]) { bbBlueAllies[0].x = W/4; bbBlueAllies[0].y = H/2 - 40; bbBlueAllies[0].hp = bbBlueAllies[0].maxHp; bbBlueAllies[0].dead = false; }
    if (bbBlueAllies[1]) { bbBlueAllies[1].x = W/4; bbBlueAllies[1].y = H/2 + 80; bbBlueAllies[1].hp = bbBlueAllies[1].maxHp; bbBlueAllies[1].dead = false; }
    for (let i = 0; i < bbRedTeam.length; i++) {
        bbRedTeam[i].x = W*0.75; bbRedTeam[i].y = H/4 + i*(H/4);
        bbRedTeam[i].hp = bbRedTeam[i].maxHp; bbRedTeam[i].dead = false;
    }
    bbResetting = false;
}

function initBrawlBall() {
    buildWalls(BB_MAP);
    bbScore = { blue: 0, red: 0 };
    bbBlueAllies = [];
    bbRedTeam = [];
    bbResetting = false;
    bbResetTimer = 0;
    ball = { x: W/2, y: H/2, vx: 0, vy: 0, radius: 13 };

    const def = BRAWLERS[selectedBrawlerIdx];
    player = makeCharacter(def, W/2, H/2 + 40, true, true);

    const allyDef = BRAWLERS[(selectedBrawlerIdx+1) % BRAWLERS.length];
    const ally1 = makeCharacter(allyDef, W/4, H/2 - 40, false, true);
    const ally2 = makeCharacter(allyDef, W/4, H/2 + 80, false, true);
    bbBlueAllies.push(ally1, ally2);

    const redDef = BRAWLERS[(selectedBrawlerIdx+2) % BRAWLERS.length];
    for (let i = 0; i < 3; i++) {
        const r = makeCharacter(redDef, W*0.75, H/4 + i*(H/4), false, false);
        r.color = '#e74c3c';
        bbRedTeam.push(r);
    }

    document.getElementById('bb-score').style.display = 'block';
    document.getElementById('sd-hud').style.display = 'none';
    updateBBScore();
}

function updateBBEntityAI(e, dt, goalX, goalY, isBlue) {
    if (e.dead) return;
    const allTeam = isBlue ? [player, ...bbBlueAllies] : bbRedTeam;
    let minD = Infinity, closestToBall = e;
    for (const m of allTeam) {
        if (!m.dead) {
            const d = dist(m.x, m.y, ball.x, ball.y);
            if (d < minD) { minD = d; closestToBall = m; }
        }
    }
    const iChaser = (closestToBall === e);
    const tx = iChaser ? ball.x : (isBlue ? W*0.35 : W*0.65);
    const ty = iChaser ? ball.y : H/2;
    const tdx = tx - e.x, tdy = ty - e.y, td = Math.hypot(tdx, tdy) || 1;
    const s = e.speed * dt;
    const nx = e.x + (tdx/td)*s, ny = e.y + (tdy/td)*s;
    if (!isWall(nx, e.y, e.size/2-2)) e.x = clamp(nx, e.size/2, W-e.size/2);
    if (!isWall(e.x, ny, e.size/2-2)) e.y = clamp(ny, e.size/2, H-e.size/2);
    e.angle = Math.atan2(ball.y - e.y, ball.x - e.x);
    const bd = dist(e.x, e.y, ball.x, ball.y);
    if (e.attackCooldown > 0) e.attackCooldown -= dt;
    if (iChaser && bd < 65 && e.attackCooldown <= 0 && e.ammo > 0) {
        e.angle = Math.atan2(goalY - e.y, goalX - e.x);
        e.ammo--; e.ammoTimer = 0; e.attackCooldown = 0.4;
        e.def.attack(e);
    }
    if (e.ammo < e.ammoMax) { e.ammoTimer += dt; if (e.ammoTimer >= AMMO_REGEN) { e.ammo++; e.ammoTimer = 0; } }
}

function updateBrawlBall(dt) {
    if (bbResetting) {
        bbResetTimer -= dt;
        if (bbResetTimer <= 0) bbResetPositions();
        updateParticlesAndTexts(dt);
        return;
    }

    movePlayer(dt);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vx *= Math.pow(0.978, dt * 60);
    ball.vy *= Math.pow(0.978, dt * 60);

    if (ball.y - ball.radius < 0) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy) * 0.8; }
    if (ball.y + ball.radius > H) { ball.y = H - ball.radius; ball.vy = -Math.abs(ball.vy) * 0.8; }

    const inGoalRange = (ball.y > BB_GOAL_Y_MIN && ball.y < BB_GOAL_Y_MAX);
    if (!inGoalRange) {
        if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx) * 0.8; }
        if (ball.x + ball.radius > W) { ball.x = W - ball.radius; ball.vx = -Math.abs(ball.vx) * 0.8; }
    }

    if (ball.x < -ball.radius) { bbGoal('red'); return; }
    if (ball.x > W + ball.radius) { bbGoal('blue'); return; }

    // Ball vs wall bounce
    if (isWall(ball.x, ball.y, ball.radius)) {
        ball.vx = -ball.vx * 0.7; ball.vy = -ball.vy * 0.7;
        ball.x += ball.vx * dt * 2; ball.y += ball.vy * dt * 2;
    }

    const allChars = [player, ...bbBlueAllies, ...bbRedTeam];
    for (const c of allChars) {
        if (c.dead) continue;
        const cdx = ball.x - c.x, cdy = ball.y - c.y;
        const cd = Math.hypot(cdx, cdy);
        const minDist = ball.radius + c.size/2;
        if (cd < minDist && cd > 0.1) {
            const nx = cdx/cd, ny = cdy/cd;
            ball.x = c.x + nx * minDist;
            ball.y = c.y + ny * minDist;
            const dot = ball.vx*nx + ball.vy*ny;
            if (dot < 0) { ball.vx -= 2*dot*nx; ball.vy -= 2*dot*ny; }
            const spd2 = Math.hypot(ball.vx, ball.vy);
            if (spd2 < 80) { ball.vx += nx*80; ball.vy += ny*80; }
        }
    }

    for (const ally of bbBlueAllies) updateBBEntityAI(ally, dt, W, H/2, true);
    for (const red of bbRedTeam) updateBBEntityAI(red, dt, 0, H/2, false);

    // Bullets vs ball
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (b.dead || b.explodeRing) continue;
        const ballDst = dist(b.x, b.y, ball.x, ball.y);
        if (ballDst < ball.radius + b.radius) {
            const ang = Math.atan2(ball.y - b.y, ball.x - b.x);
            ball.vx += Math.cos(ang) * 380;
            ball.vy += Math.sin(ang) * 380;
            spawnParticles(b.x, b.y, b.color, 4, 60);
            bullets.splice(i, 1);
        }
    }

    updateBulletsBrawlBall(dt, allChars);
    updateParticlesAndTexts(dt);

    if (player.hp <= 0 && !player.dead) { killEntityGeneric(player); triggerGameOver(false); return; }
    updateHUD();
}

function updateBulletsBrawlBall(dt, allChars) {
    bullets = bullets.filter(b => {
        if (b.dead) return false;
        if (b.explodeRing) { b.radius += (b.maxR/0.35)*dt; b.life -= dt; return b.life > 0; }
        b.x += b.vx*dt; b.y += b.vy*dt;
        b.traveled += Math.hypot(b.vx, b.vy)*dt;
        if (b.traveled > b.maxRange) return false;
        if (isWall(b.x, b.y, b.radius)) {
            if (b.explodeOnHit) spawnExplosion(b.x, b.y, b.explodeRadius, b.explodeDmg, {fromPlayer:b.fromPlayer,teamBlue:b.teamBlue}, b.explodeColor);
            spawnParticles(b.x, b.y, b.color, 4, 60);
            return false;
        }
        for (const c of allChars) {
            if (c.dead || c === b.ownerRef) continue;
            if (b.teamBlue && c.teamBlue) continue;
            if (!b.teamBlue && !c.teamBlue) continue;
            if (dist(b.x, b.y, c.x, c.y) < c.size/2 + b.radius) {
                let dmg = b.dmg; if (b.sniper) dmg = b.dmg*(1+b.traveled/300);
                c.hp -= dmg;
                spawnFloatText(c.x, c.y-24, `-${Math.round(dmg)}`, b.color);
                if (b.ownerRef === player) player.super = Math.min(SUPER_MAX, player.super+8);
                spawnParticles(b.x, b.y, b.color, 5, 80);
                if (c.hp <= 0) killEntityGeneric(c);
                if (b.explodeOnHit) { spawnExplosion(b.x, b.y, b.explodeRadius, b.explodeDmg, {fromPlayer:b.fromPlayer,teamBlue:b.teamBlue}, b.explodeColor); return false; }
                if (!b.pierce) return false;
            }
        }
        return true;
    });
}

function drawBrawlBall() {
    drawMap();
    drawGoals();

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(ball.x+3, ball.y+6, ball.radius*0.8, ball.radius*0.35, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = '#fff';
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();

    drawParticlesAndRings();
    drawBullets();
    for (const e of bbRedTeam) if (!e.dead) drawChar(ctx, e, false);
    for (const e of bbBlueAllies) if (!e.dead) drawChar(ctx, e, false);
    drawChar(ctx, player, true);
    drawFloatTexts();
}

function drawGoals() {
    ctx.save();
    ctx.fillStyle = 'rgba(231,76,60,0.25)';
    ctx.fillRect(0, BB_GOAL_Y_MIN, 16, BB_GOAL_Y_MAX - BB_GOAL_Y_MIN);
    ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 3;
    ctx.strokeRect(0, BB_GOAL_Y_MIN, 16, BB_GOAL_Y_MAX - BB_GOAL_Y_MIN);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(52,152,219,0.25)';
    ctx.fillRect(W-16, BB_GOAL_Y_MIN, 16, BB_GOAL_Y_MAX - BB_GOAL_Y_MIN);
    ctx.strokeStyle = '#3498db'; ctx.lineWidth = 3;
    ctx.strokeRect(W-16, BB_GOAL_Y_MIN, 16, BB_GOAL_Y_MAX - BB_GOAL_Y_MIN);
    ctx.restore();
}

// ── Showdown ──────────────────────────────────────────────────────────
let sdEntities = [];
let sdZoneRadius = 320;
let sdZoneTimer = 90;
const SD_ZONE_CX = W/2, SD_ZONE_CY = H/2;
let sdCrates = [];
const SD_CRATE_POSITIONS = [
    {x:80,y:80},{x:620,y:80},{x:80,y:440},{x:620,y:440},
    {x:200,y:200},{x:500,y:200},{x:200,y:360},{x:500,y:360},
];

function initShowdown() {
    buildWalls(SHOWDOWN_MAP);
    sdZoneRadius = 320; sdZoneTimer = 90;
    sdEntities = []; kills = 0;

    const def = BRAWLERS[selectedBrawlerIdx];
    player = makeCharacter(def, W/2, H/2, true, true);
    player.fromPlayer = true;
    sdEntities.push(player);

    const sdColors = ['#e74c3c','#3498db','#2ecc71','#9b59b6','#f39c12','#1abc9c','#e67e22','#fd79a8','#00b894'];
    for (let i = 0; i < 9; i++) {
        const bDef = BRAWLERS[i % BRAWLERS.length];
        const sp = SD_CRATE_POSITIONS[i % SD_CRATE_POSITIONS.length];
        const e = makeCharacter(bDef, sp.x + (Math.random()-0.5)*60, sp.y + (Math.random()-0.5)*60, false, false);
        e.color = sdColors[i % sdColors.length];
        e.fromPlayer = false; e.teamBlue = false;
        e.attackTimer = Math.random() * 2;
        sdEntities.push(e);
    }

    sdCrates = SD_CRATE_POSITIONS.map(p => ({ x: p.x, y: p.y, active: true, respawnTimer: 0 }));
    document.getElementById('bb-score').style.display = 'none';
    document.getElementById('sd-hud').style.display = 'block';
    updateSDHUD();
}

function updateSDHUD() {
    const alive = sdEntities.filter(e => !e.dead).length;
    document.getElementById('sd-alive').textContent = `Alive: ${alive}/10`;
    document.getElementById('sd-timer').textContent = `Zone: ${Math.ceil(sdZoneTimer)}s`;
}

function updateShowdown(dt) {
    if (!gameActive) return;
    movePlayer(dt);

    sdZoneTimer -= dt;
    if (sdZoneTimer < 0) sdZoneTimer = 0;
    sdZoneRadius = 320 * (sdZoneTimer / 90);

    const pDist = dist(player.x, player.y, SD_ZONE_CX, SD_ZONE_CY);
    if (pDist > sdZoneRadius && !player.dead) {
        player.hp -= 7 * dt;
        if (player.hp <= 0) { const pl = sdEntities.filter(e=>!e.dead).length + 1; triggerGameOver(false, pl); return; }
    }

    for (const c of sdCrates) {
        if (!c.active) { c.respawnTimer -= dt; if (c.respawnTimer <= 0) c.active = true; continue; }
        if (dist(player.x, player.y, c.x, c.y) < 30) {
            c.active = false; c.respawnTimer = 15;
            player.hp = Math.min(player.maxHp, player.hp + 35);
            spawnFloatText(player.x, player.y - 30, '+35 HP', '#2ecc71');
            spawnParticles(c.x, c.y, '#f7c948', 12, 100);
        }
    }

    for (const e of sdEntities) {
        if (e === player || e.dead) continue;
        const eDist = dist(e.x, e.y, SD_ZONE_CX, SD_ZONE_CY);
        if (eDist > sdZoneRadius + 20) {
            const ang = Math.atan2(SD_ZONE_CY - e.y, SD_ZONE_CX - e.x);
            e.angle = ang;
            const s = e.speed * dt;
            const nx = e.x + Math.cos(ang)*s, ny = e.y + Math.sin(ang)*s;
            if (!isWall(nx, e.y, e.size/2-2)) e.x = clamp(nx, e.size/2, W-e.size/2);
            if (!isWall(e.x, ny, e.size/2-2)) e.y = clamp(ny, e.size/2, H-e.size/2);
        } else {
            let nearest = null, nearD = Infinity;
            for (const other of sdEntities) {
                if (other === e || other.dead) continue;
                const d = dist(e.x, e.y, other.x, other.y);
                if (d < nearD) { nearD = d; nearest = other; }
            }
            if (nearest) {
                e.angle = Math.atan2(nearest.y - e.y, nearest.x - e.x);
                if (nearD > 120) {
                    const s = e.speed * dt;
                    const nx = e.x + Math.cos(e.angle)*s, ny = e.y + Math.sin(e.angle)*s;
                    if (!isWall(nx, e.y, e.size/2-2)) e.x = clamp(nx, e.size/2, W-e.size/2);
                    if (!isWall(e.x, ny, e.size/2-2)) e.y = clamp(ny, e.size/2, H-e.size/2);
                }
                e.attackTimer -= dt;
                if (nearD < 280 && e.attackTimer <= 0 && e.ammo > 0) {
                    e.attackTimer = e.def.ammoMax > 4 ? 0.2 : 0.6;
                    e.ammo--; e.ammoTimer = 0;
                    e.def.attack(e);
                }
            }
        }
        if (e.ammo < e.ammoMax) { e.ammoTimer += dt; if (e.ammoTimer >= AMMO_REGEN) { e.ammo++; e.ammoTimer = 0; } }
    }

    updateBulletsShowdown(dt);
    updateParticlesAndTexts(dt);

    const alive = sdEntities.filter(e => !e.dead).length;
    if (alive <= 1 && !player.dead) { triggerGameOver(true); return; }
    updateSDHUD();
    updateHUD();
}

function updateBulletsShowdown(dt) {
    bullets = bullets.filter(b => {
        if (b.dead) return false;
        if (b.explodeRing) { b.radius += (b.maxR/0.35)*dt; b.life -= dt; return b.life > 0; }
        b.x += b.vx*dt; b.y += b.vy*dt;
        b.traveled += Math.hypot(b.vx, b.vy)*dt;
        if (b.traveled > b.maxRange) return false;
        if (isWall(b.x, b.y, b.radius)) {
            if (b.explodeOnHit) spawnExplosion(b.x, b.y, b.explodeRadius, b.explodeDmg, {fromPlayer:b.fromPlayer}, b.explodeColor);
            spawnParticles(b.x, b.y, b.color, 4, 60);
            return false;
        }
        for (const c of sdEntities) {
            if (c.dead || c === b.ownerRef) continue;
            if (dist(b.x, b.y, c.x, c.y) < c.size/2 + b.radius) {
                let dmg = b.dmg; if (b.sniper) dmg = b.dmg*(1+b.traveled/300);
                c.hp -= dmg;
                spawnFloatText(c.x, c.y-24, `-${Math.round(dmg)}`, b.color);
                if (b.ownerRef === player || c === player) player.super = Math.min(SUPER_MAX, player.super+8);
                spawnParticles(b.x, b.y, b.color, 5, 80);
                if (c.hp <= 0) {
                    killEntityGeneric(c);
                    if (c === player) { const pl = sdEntities.filter(e=>!e.dead).length + 1; triggerGameOver(false, pl); return false; }
                }
                if (b.explodeOnHit) { spawnExplosion(b.x, b.y, b.explodeRadius, b.explodeDmg, {fromPlayer:b.fromPlayer}, b.explodeColor); return false; }
                if (!b.pierce) return false;
            }
        }
        return true;
    });
}

function drawShowdown() {
    drawMap();

    ctx.save();
    ctx.fillStyle = 'rgba(100,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(SD_ZONE_CX, SD_ZONE_CY, sdZoneRadius, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(SD_ZONE_CX, SD_ZONE_CY, sdZoneRadius, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

    for (const c of sdCrates) {
        if (!c.active) continue;
        ctx.save();
        ctx.fillStyle = '#f7c948'; ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 2;
        ctx.shadowBlur = 8; ctx.shadowColor = '#f7c948';
        ctx.fillRect(c.x-14, c.y-14, 28, 28);
        ctx.strokeRect(c.x-14, c.y-14, 28, 28);
        ctx.fillStyle = '#333'; ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowBlur = 0;
        ctx.fillText('❤️', c.x, c.y);
        ctx.restore();
    }

    drawParticlesAndRings();
    drawBullets();
    for (const e of sdEntities) { if (e !== player && !e.dead) drawChar(ctx, e, false); }
    if (!player.dead) drawChar(ctx, player, true);
    drawFloatTexts();
}

// ── Shared helpers ────────────────────────────────────────────────────
function movePlayer(dt) {
    let dx = 0, dy = 0;
    if (keys['w']||keys['arrowup'])    dy -= 1;
    if (keys['s']||keys['arrowdown'])  dy += 1;
    if (keys['a']||keys['arrowleft'])  dx -= 1;
    if (keys['d']||keys['arrowright']) dx += 1;
    if (dx !== 0 || dy !== 0) { const mv = Math.hypot(dx, dy); dx /= mv; dy /= mv; }

    let spd = player.speed;
    if (player.dashing) {
        player.dashTimer -= dt;
        if (player.dashTimer <= 0) player.dashing = false;
        else { dx = Math.cos(player.dashAngle); dy = Math.sin(player.dashAngle); spd = player.dashSpeed; }
    }

    const nx = player.x + dx*spd*dt, ny = player.y + dy*spd*dt;
    if (!isWall(nx, player.y, player.size/2-2)) player.x = clamp(nx, player.size/2, W-player.size/2);
    if (!isWall(player.x, ny, player.size/2-2)) player.y = clamp(ny, player.size/2, H-player.size/2);

    player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    if (player.attackCooldown > 0) player.attackCooldown -= dt;
    if (player.ammo < player.ammoMax) { player.ammoTimer += dt; if (player.ammoTimer >= AMMO_REGEN) { player.ammo++; player.ammoTimer = 0; } }
}

function updateParticlesAndTexts(dt) {
    for (const f of floatTexts) { f.y += f.vy*dt; f.life -= dt; }
    floatTexts = floatTexts.filter(f => f.life > 0);
    for (const p of particles) { p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
}

function drawMap() {
    ctx.clearRect(0, 0, W, H);
    for (let r = 0; r < activeMap.length; r++) {
        for (let c = 0; c < activeMap[r].length; c++) {
            if (activeMap[r][c] === 0) {
                ctx.fillStyle = (r+c)%2===0 ? '#3a7a32' : '#306828';
                ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
            }
        }
    }
    for (const w of walls) {
        ctx.fillStyle = '#7a6040'; ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = '#9a7a50'; ctx.fillRect(w.x+2, w.y+2, w.w-4, 8);
        ctx.fillStyle = '#5a4428'; ctx.fillRect(w.x, w.y+w.h-5, w.w, 5);
    }
}

function drawParticlesAndRings() {
    for (const b of bullets) {
        if (!b.explodeRing) continue;
        ctx.save(); ctx.globalAlpha = b.life/0.35*0.5; ctx.strokeStyle = b.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2); ctx.stroke(); ctx.restore();
    }
    for (const p of particles) {
        ctx.save(); ctx.globalAlpha = p.life/p.maxLife; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r*(p.life/p.maxLife), 0, Math.PI*2); ctx.fill(); ctx.restore();
    }
}

function drawBullets() {
    for (const b of bullets) {
        if (b.explodeRing) continue;
        ctx.save(); ctx.shadowBlur = b.rocket ? 16 : 8; ctx.shadowColor = b.color; ctx.fillStyle = b.color;
        const r = b.rocket ? b.radius*1.3 : b.radius;
        if (b.rocket) {
            ctx.translate(b.x, b.y); ctx.rotate(b.angle);
            ctx.beginPath(); ctx.ellipse(0, 0, r, r*0.5, 0, 0, Math.PI*2); ctx.fill();
        } else { ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI*2); ctx.fill(); }
        ctx.restore();
    }
}

function drawFloatTexts() {
    for (const f of floatTexts) {
        ctx.save(); ctx.globalAlpha = f.life/1.2; ctx.fillStyle = f.color;
        ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y); ctx.restore();
    }
}

function drawChar(ctx, e, isPlayer) {
    const { x, y, size, color, angle } = e;
    const r = size/2;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(2, r*0.85, r*0.7, r*0.28, 0, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = isPlayer ? 14 : 0; ctx.shadowColor = color; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = isPlayer ? '#fff' : 'rgba(0,0,0,0.35)'; ctx.lineWidth = isPlayer ? 2 : 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.arc(-r*0.27, -r*0.27, r*0.45, 0, Math.PI*2); ctx.fill();
    const ea = [angle-0.38, angle+0.38], ed = r*0.4;
    ctx.fillStyle = '#fff';
    ea.forEach(a => { ctx.beginPath(); ctx.arc(Math.cos(a)*ed, Math.sin(a)*ed, r*0.22, 0, Math.PI*2); ctx.fill(); });
    ctx.fillStyle = '#111';
    ea.forEach(a => {
        const px = Math.cos(a)*ed + Math.cos(angle)*r*0.1, py = Math.sin(a)*ed + Math.sin(angle)*r*0.1;
        ctx.beginPath(); ctx.arc(px, py, r*0.1, 0, Math.PI*2); ctx.fill();
    });
    ctx.strokeStyle = isPlayer ? '#ddd' : '#aaa'; ctx.lineWidth = isPlayer ? 5 : 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(Math.cos(angle)*r*0.5, Math.sin(angle)*r*0.5);
    ctx.lineTo(Math.cos(angle)*(r+12), Math.sin(angle)*(r+12)); ctx.stroke();
    ctx.restore();

    const bw = size*1.5, bh = 5, bx = x-bw/2, by = y-r-14;
    ctx.fillStyle = '#222'; roundRect(ctx, bx, by, bw, bh, 3); ctx.fill();
    const ratio = Math.max(0, e.hp/(e.maxHp||e.hp));
    ctx.fillStyle = ratio>0.5 ? '#2ecc71' : ratio>0.25 ? '#f39c12' : '#e74c3c';
    if (ratio > 0) { roundRect(ctx, bx, by, bw*ratio, bh, 3); ctx.fill(); }
    if (isPlayer) {
        ctx.save(); ctx.font = 'bold 11px Arial'; ctx.fillStyle = color; ctx.textAlign = 'center';
        ctx.fillText(player.def.name, x, by-3); ctx.restore();
    }
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r); ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h); ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-r); ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath();
}

// ── Arena ─────────────────────────────────────────────────────────────
function initArena() {
    buildWalls(MAP);
    enemies = [];
    spawnWave(wave);
    document.getElementById('bb-score').style.display = 'none';
    document.getElementById('sd-hud').style.display = 'none';
    updateHUD();
}

function updateArena(dt) {
    movePlayer(dt);
    bullets = bullets.filter(b => {
        if (b.dead) return false;
        if (b.explodeRing) { b.radius += (b.maxR/0.35)*dt; b.life -= dt; return b.life > 0; }
        b.x += b.vx*dt; b.y += b.vy*dt;
        b.traveled += Math.hypot(b.vx, b.vy)*dt;
        if (b.traveled > b.maxRange) return false;
        if (isWall(b.x, b.y, b.radius)) {
            if (b.explodeOnHit) spawnExplosion(b.x, b.y, b.explodeRadius, b.explodeDmg, {fromPlayer:b.fromPlayer}, b.explodeColor);
            spawnParticles(b.x, b.y, b.color, 4, 60); return false;
        }
        if (b.fromPlayer) {
            let hit = false;
            for (const e of enemies) {
                if (e.dead) continue;
                if (dist(b.x, b.y, e.x, e.y) < e.size/2 + b.radius) {
                    let dmg = b.dmg; if (b.sniper) dmg = b.dmg*(1+b.traveled/300);
                    e.hp -= dmg; spawnFloatText(e.x, e.y-24, `-${Math.round(dmg)}`, b.color);
                    player.super = Math.min(SUPER_MAX, player.super+8);
                    spawnParticles(b.x, b.y, b.color, 5, 80);
                    if (e.hp <= 0) killEntityGeneric(e);
                    if (b.explodeOnHit) { spawnExplosion(b.x, b.y, b.explodeRadius, b.explodeDmg, {fromPlayer:true}, b.explodeColor); return false; }
                    if (!b.pierce) { hit = true; break; }
                }
            }
            if (hit) return false;
        } else {
            if (!player.dead && dist(b.x, b.y, player.x, player.y) < player.size/2 + b.radius) {
                let dmg = b.dmg; if (b.sniper) dmg = b.dmg*(1+b.traveled/300);
                player.hp -= dmg; spawnParticles(b.x, b.y, b.color, 5, 80);
                spawnFloatText(player.x, player.y-24, `-${Math.round(dmg)}`, '#e74c3c');
                if (player.hp <= 0 && !player.dead) triggerGameOver(false);
                return false;
            }
        }
        return true;
    });

    for (const e of enemies) {
        if (e.dead) continue;
        e.wobble = (e.wobble||0) + dt*1.8;
        if (!player.dead) {
            const pdx = player.x-e.x, pdy = player.y-e.y, pdist = Math.hypot(pdx, pdy);
            e.angle = Math.atan2(pdy, pdx);
            if (pdist > e.attackRange*0.75) {
                const s = e.speed*dt;
                const ex = e.x+(pdx/pdist)*s, ey = e.y+(pdy/pdist)*s;
                if (!isWall(ex, e.y, e.size/2-2)) e.x = clamp(ex, e.size/2, W-e.size/2);
                if (!isWall(e.x, ey, e.size/2-2)) e.y = clamp(ey, e.size/2, H-e.size/2);
            }
            e.attackTimer -= dt;
            if (e.attackTimer <= 0 && pdist < e.attackRange+e.size) { e.attackTimer = e.attackCool; e.fire(e); }
        }
    }
    enemies = enemies.filter(e => !e.dead);
    updateParticlesAndTexts(dt);

    if (enemies.length === 0 && gameActive) {
        wave++;
        if (wave > 5) { triggerGameOver(true); return; }
        player.hp = Math.min(player.maxHp, player.hp+40);
        player.ammo = player.ammoMax;
        spawnParticles(player.x, player.y, '#f7c948', 20, 200);
        spawnWave(wave);
    }
    updateHUD();
}

function drawArena() {
    drawMap(); drawParticlesAndRings(); drawBullets();
    for (const e of enemies) if (!e.dead) drawChar(ctx, e, false);
    drawChar(ctx, player, true); drawFloatTexts();
    if (enemies.length > 0) {
        ctx.save(); ctx.fillStyle = 'rgba(247,201,72,0.18)'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'right';
        ctx.fillText(`Welle ${wave} · ${enemies.length} Gegner`, W-10, 20); ctx.restore();
    }
}

// ── HUD ───────────────────────────────────────────────────────────────
function updateHUD() {
    if (!player) return;
    document.getElementById('hp-fill').style.width    = Math.max(0, player.hp/player.maxHp*100)+'%';
    document.getElementById('ammo-fill').style.width  = (player.ammo/player.ammoMax*100)+'%';
    document.getElementById('super-fill').style.width = (player.super/SUPER_MAX*100)+'%';
    if (currentMode === 'arena') {
        document.getElementById('hud-kills').textContent = `Kills: ${kills}`;
        document.getElementById('hud-wave').textContent  = `Welle ${wave}/5`;
    } else if (currentMode === 'brawlball') {
        document.getElementById('hud-kills').textContent = '';
        document.getElementById('hud-wave').textContent  = 'Brawl Ball';
    } else if (currentMode === 'showdown') {
        document.getElementById('hud-kills').textContent = `Kills: ${kills}`;
        document.getElementById('hud-wave').textContent  = 'Showdown';
    }
    document.getElementById('super-btn-hint').style.color = player.super >= SUPER_MAX ? '#f7c948' : '#555';
}

// ── Game Over ─────────────────────────────────────────────────────────
// ── Trophy system ─────────────────────────────────────────────────────
function getTrophies() { return parseInt(localStorage.getItem('brawlTrophies') || '0', 10); }
function addTrophies(delta) {
    const t = Math.max(0, getTrophies() + delta);
    localStorage.setItem('brawlTrophies', t);
    return t;
}
function updateMenuTrophies() {
    const el = document.getElementById('menu-trophies');
    if (el) el.textContent = `🏆 ${getTrophies()} Trophäen`;
}

function triggerGameOver(won, placement) {
    if (!gameActive) return;
    gameActive = false;
    let title, sub, score;

    // Showdown placement-based win condition: top 7 = win, 8-10 = lose
    if (currentMode === 'showdown') {
        const aliveCount = sdEntities ? sdEntities.filter(e => !e.dead).length : 1;
        placement = placement || (won ? 1 : (10 - aliveCount + 1));
        won = placement <= 7;
        title = won ? '🏆 LETZTER STEHEND!' : '💀 AUSGESCHIEDEN';
        sub   = won ? `Platz ${placement} – du hast überlebt!` : `Platz ${placement} – zu früh ausgeschieden!`;
        score = `Kills: ${kills}`;
    } else if (currentMode === 'arena') {
        title = won ? '🏆 SIEG!' : '💀 GAME OVER';
        sub   = won ? 'Du hast alle 5 Wellen überstanden!' : 'Du wurdest besiegt...';
        score = `Kills: ${kills}  ·  Welle ${wave}`;
    } else {
        title = won ? '🏆 SIEG!' : '😢 NIEDERLAGE';
        sub   = won ? 'Dein Team hat gewonnen!' : 'Das rote Team hat gewonnen!';
        score = `🔵 ${bbScore.blue} – ${bbScore.red} 🔴`;
    }

    const delta = won ? 13 : -2;
    const newTotal = addTrophies(delta);
    const trophyText = won
        ? `+13 🏆  →  ${newTotal} Trophäen gesamt`
        : `-2 🏆  →  ${Math.max(0, newTotal)} Trophäen gesamt`;

    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-sub').textContent   = sub;
    document.getElementById('overlay-score').textContent = score;
    document.getElementById('overlay-trophies').textContent = trophyText;
    document.getElementById('overlay-trophies').style.color = won ? '#f7c948' : '#e74c3c';
    document.getElementById('overlay').classList.remove('hidden');
    updateMenuTrophies();
}

// ── Main Loop ─────────────────────────────────────────────────────────
function loop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (gameActive) {
        updateMode(dt);
        drawMode();
        requestAnimationFrame(loop);
    }
}

function updateMode(dt) {
    if (currentMode === 'arena') updateArena(dt);
    else if (currentMode === 'brawlball') updateBrawlBall(dt);
    else if (currentMode === 'showdown') updateShowdown(dt);
}

function drawMode() {
    if (currentMode === 'arena') drawArena();
    else if (currentMode === 'brawlball') drawBrawlBall();
    else if (currentMode === 'showdown') drawShowdown();
}

// ── Screen navigation ─────────────────────────────────────────────────
function showSelect() {
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('modeScreen').classList.add('hidden');
    document.getElementById('selectScreen').classList.remove('hidden');
    document.getElementById('gameCanvas').style.display = 'none';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('bb-score').style.display = 'none';
    document.getElementById('sd-hud').style.display = 'none';
    renderBrawlerGrid();
}

function showModeSelect() {
    document.getElementById('selectScreen').classList.add('hidden');
    document.getElementById('modeScreen').classList.remove('hidden');
    document.getElementById('gameCanvas').style.display = 'none';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('bb-score').style.display = 'none';
    document.getElementById('sd-hud').style.display = 'none';
    selectMode(selectedMode || 'arena');
}

function selectMode(mode) {
    selectedMode = mode;
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById('mode-' + mode);
    if (card) card.classList.add('selected');
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

function startGame(mode) {
    currentMode = mode || selectedMode || 'arena';
    selectedMode = currentMode;
    gameActive = false; // stop any previous loop

    document.getElementById('selectScreen').classList.add('hidden');
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('modeScreen').classList.add('hidden');
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('gameCanvas').style.display = 'block';
    document.getElementById('hud').classList.remove('hidden');

    bullets = []; floatTexts = []; particles = []; kills = 0; wave = 1; enemies = [];
    gameActive = true;

    const def = BRAWLERS[selectedBrawlerIdx];
    player = makeCharacter(def, W/2, H/2, true, true);

    if (currentMode === 'arena') initArena();
    else if (currentMode === 'brawlball') initBrawlBall();
    else if (currentMode === 'showdown') initShowdown();

    updateHUD();
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

// ── Attack ────────────────────────────────────────────────────────────
function fireAttack() {
    if (!gameActive || !player || player.dead || player.attackCooldown > 0 || player.ammo <= 0) return;
    player.ammo--; player.ammoTimer = 0; player.attackCooldown = 0.18;
    player.def.attack(player);
}

// ── Input ─────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (!gameActive || !player) return;
    if (e.key === ' ') { e.preventDefault(); fireAttack(); }
    if (e.key.toLowerCase() === 'e' && player.super >= SUPER_MAX) {
        player.super = 0;
        player.def.super(player);
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

// Init trophy display on load
updateMenuTrophies();
