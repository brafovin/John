'use strict';
// =====================================================================
//  BRAWL CLONE – Multi-Mode · Pure Canvas 2D · No dependencies
// =====================================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const BULLET_SPD  = 420;
const AMMO_REGEN  = 1.6;
const SUPER_MAX   = 100;
const TILE        = 40;

// ── Shared state ──────────────────────────────────────────────────────
let player, bullets, floatTexts, particles;
let kills, gameActive, currentMode, selectedMode = 'arena';
let mouseX = W/2, mouseY = H/2;
let keys = {};
let lastTime = 0;
let selectedBrawlerIdx = 0;

// ── Utilities ─────────────────────────────────────────────────────────
const dist  = (ax,ay,bx,by) => Math.hypot(ax-bx,ay-by);
const clamp = (v,lo,hi)     => Math.max(lo,Math.min(hi,v));
const rand  = (a,b)         => a + Math.random()*(b-a);

function spawnParticles(x,y,color,count=8,spd=140) {
    for (let i=0;i<count;i++) {
        const a=Math.random()*Math.PI*2, v=spd*(0.5+Math.random());
        particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,
            life:0.5+Math.random()*0.4,maxLife:1,r:2+Math.random()*3,color});
    }
}
function spawnFloat(x,y,text,color) {
    floatTexts.push({x,y,text,color,life:1.1,vy:-44});
}

// ── Brawlers (12 total) ───────────────────────────────────────────────
const BRAWLERS = [
    // ─── ORIGINALS ───
    {
        id:'shelly', name:'Shelly', emoji:'🔫', color:'#e67e22',
        classLabel:'Tank', classColor:'#e74c3c',
        desc:'Schrotflinte – nah sehr stark',
        superDesc:'Super: Riesige Explosion',
        hp:140, speed:175, ammoMax:3, stars:[4,2,3],
        attack(p){ shotgun(p,6,0.55,180,22,'#f39c12',7); },
        super(p){ explosion(p.x+Math.cos(p.angle)*60,p.y+Math.sin(p.angle)*60,88,58,p,'#f39c12'); }
    },
    {
        id:'colt', name:'Colt', emoji:'🎯', color:'#3498db',
        classLabel:'Schütze', classColor:'#3498db',
        desc:'Schnelle Doppelschüsse',
        superDesc:'Super: 12-Kugeln Salve',
        hp:90, speed:190, ammoMax:6, stars:[3,4,4],
        attack(p){ bullet(p,p.angle-0.07,380,18,'#74b9ff',5,true); bullet(p,p.angle+0.07,380,18,'#74b9ff',5,true); },
        super(p){ for(let i=0;i<12;i++) setTimeout(()=>{ if(!p.dead) bullet(p,p.angle+(Math.random()-.5)*.12,500,20,'#0984e3',5,true); },i*55); }
    },
    {
        id:'bull', name:'Bull', emoji:'🐂', color:'#e74c3c',
        classLabel:'Nahkämpfer', classColor:'#c0392b',
        desc:'Mächtiger Nahkampf-Brawler',
        superDesc:'Super: Sturm-Dash',
        hp:180, speed:165, ammoMax:3, stars:[5,1,2],
        attack(p){ shotgun(p,8,0.8,120,28,'#e74c3c',8); },
        super(p){ p.dashing=true; p.dashTimer=0.55; p.dashAngle=p.angle; p.dashSpeed=520; }
    },
    {
        id:'spike', name:'Spike', emoji:'🌵', color:'#2ecc71',
        classLabel:'Distanz', classColor:'#27ae60',
        desc:'Explodierende Stacheln',
        superDesc:'Super: Stachelfeld',
        hp:80, speed:180, ammoMax:3, stars:[4,3,5],
        attack(p){ const b=bullet(p,p.angle,270,20,'#2ecc71',8,true); b.explodeR=52; b.explodeDmg=28; b.explodeColor='#27ae60'; },
        super(p){ for(let i=0;i<12;i++){ const a=(Math.PI*2/12)*i; bullet({x:W/2,y:H/2,size:1,fromPlayer:true},a,170,18,'#27ae60',8,false); } spawnParticles(W/2,H/2,'#2ecc71',20,120); }
    },
    {
        id:'brock', name:'Brock', emoji:'🚀', color:'#9b59b6',
        classLabel:'Artillerie', classColor:'#8e44ad',
        desc:'Langsame mächtige Rakete',
        superDesc:'Super: Raketenhagel',
        hp:95, speed:185, ammoMax:3, stars:[5,2,4],
        attack(p){ const b=bullet(p,p.angle,500,40,'#9b59b6',10,true); b.rocket=true; },
        super(p){ for(let i=0;i<5;i++) setTimeout(()=>{ explosion(p.x+rand(-150,150),p.y+rand(-150,150),68,48,p,'#9b59b6'); },i*190); }
    },
    {
        id:'piper', name:'Piper', emoji:'☂️', color:'#fd79a8',
        classLabel:'Sniper', classColor:'#e84393',
        desc:'Mehr Schaden auf Distanz',
        superDesc:'Super: Teleport + Granaten',
        hp:75, speed:195, ammoMax:3, stars:[5,3,3],
        attack(p){ const b=bullet(p,p.angle,600,0,'#fd79a8',5,true); b.sniper=true; },
        super(p){ p.x=clamp(W-p.x,40,W-40); p.y=clamp(H-p.y,40,H-40); spawnParticles(p.x,p.y,'#fd79a8',16,160); for(let i=0;i<4;i++) setTimeout(()=>{ explosion(p.x+rand(-100,100),p.y+rand(-100,100),55,35,p,'#fd79a8'); },i*140); }
    },
    // ─── NEW BRAWLERS ───
    {
        id:'leon', name:'Leon', emoji:'🗡️', color:'#00cec9',
        classLabel:'Assassin', classColor:'#00b894',
        desc:'Wirft Klingen; Super: Unsichtbar',
        superDesc:'Super: 5s Unsichtbarkeit',
        hp:100, speed:210, ammoMax:4, stars:[4,5,3],
        attack(p){
            const offsets=[-0.18,0,0.18];
            offsets.forEach(o=>{
                const b=bullet(p,p.angle+o,280,14,'#00cec9',6,false);
                b.blade=true;
            });
        },
        super(p){ p.invisible=true; p.invisTimer=5.0; spawnParticles(p.x,p.y,'#00cec9',20,120); }
    },
    {
        id:'amber', name:'Amber', emoji:'🔥', color:'#fd9644',
        classLabel:'Feuer', classColor:'#e55039',
        desc:'Feuerspucke – hinterlässt Flammen',
        superDesc:'Super: Feuersee auf dem Boden',
        hp:110, speed:180, ammoMax:4, stars:[4,3,4],
        attack(p){
            const b=bullet(p,p.angle+(rand(-.12,.12)),300,16,'#fd9644',9,false);
            b.fire=true;
        },
        super(p){
            for(let i=0;i<8;i++){
                firePool.push({
                    x:p.x+rand(-80,80), y:p.y+rand(-80,80),
                    r:30, dmgTimer:0, life:5.0
                });
            }
            spawnParticles(p.x,p.y,'#fd9644',18,150);
        }
    },
    {
        id:'mortis', name:'Mortis', emoji:'⚰️', color:'#a29bfe',
        classLabel:'Assassin', classColor:'#6c5ce7',
        desc:'Dash-Angriff nach vorne',
        superDesc:'Super: Fledermäuse heilen dich',
        hp:115, speed:185, ammoMax:3, stars:[3,5,3],
        attack(p){
            p.dashing=true; p.dashTimer=0.22; p.dashAngle=p.angle; p.dashSpeed=460;
            const b=bullet(p,p.angle,80,36,'#a29bfe',12,false);
            b.melee=true;
        },
        super(p){
            for(let i=0;i<3;i++){
                const a=p.angle+(i-1)*0.5;
                const b=bullet(p,a,350,0,'#a29bfe',8,false);
                b.healbat=true;
            }
            spawnParticles(p.x,p.y,'#a29bfe',14,100);
        }
    },
    {
        id:'nita', name:'Nita', emoji:'🐻', color:'#a55eea',
        classLabel:'Tank', classColor:'#8854d0',
        desc:'Stoßwelle nach vorne',
        superDesc:'Super: Beschwört einen Bären',
        hp:130, speed:175, ammoMax:3, stars:[4,2,4],
        attack(p){
            for(let i=-1;i<=1;i++){
                bullet(p,p.angle+i*0.2,220,22,'#a55eea',10,false);
            }
        },
        super(p){ summonBear(p); }
    },
    {
        id:'dynamike', name:'Dynamike', emoji:'💣', color:'#f9ca24',
        classLabel:'Werfer', classColor:'#f0932b',
        desc:'Wirft 2 Bomben gleichzeitig',
        superDesc:'Super: Riesige Super-Bombe',
        hp:80, speed:185, ammoMax:3, stars:[4,2,5],
        attack(p){
            for(let i=0;i<2;i++){
                const a=p.angle+(i-.5)*.3;
                const b=bullet(p,a,260,22,'#f9ca24',9,false);
                b.grenade=true;
            }
        },
        super(p){ explosion(p.x+Math.cos(p.angle)*120,p.y+Math.sin(p.angle)*120,120,70,p,'#f9ca24'); spawnParticles(p.x+Math.cos(p.angle)*120,p.y+Math.sin(p.angle)*120,'#f9ca24',28,220); }
    },
    {
        id:'rosa', name:'Rosa', emoji:'🌸', color:'#ff6b9d',
        classLabel:'Tank', classColor:'#c44569',
        desc:'Kurze Reichweite, sehr viel HP',
        superDesc:'Super: Schild – 3s Unverwundbarkeit',
        hp:200, speed:160, ammoMax:3, stars:[5,1,2],
        attack(p){ shotgun(p,5,0.65,100,30,'#ff6b9d',9); },
        super(p){ p.shielded=true; p.shieldTimer=3.0; spawnParticles(p.x,p.y,'#ff6b9d',18,100); }
    },
];

// ── Bullet/explosion helpers ──────────────────────────────────────────
function bullet(src, angle, maxRange, dmg, color, radius, pierce) {
    const half=(src.size||24)/2;
    const b={
        x:src.x+Math.cos(angle)*(half+6),
        y:src.y+Math.sin(angle)*(half+6),
        vx:Math.cos(angle)*BULLET_SPD, vy:Math.sin(angle)*BULLET_SPD,
        angle, dmg, color, radius, pierce,
        fromPlayer: src.fromPlayer!==false,
        maxRange, traveled:0, dead:false,
    };
    bullets.push(b); return b;
}
function shotgun(src,pellets,spread,range,dmg,color,r) {
    for(let i=0;i<pellets;i++){
        const a=src.angle-spread/2+(spread/(pellets-1))*i;
        bullet(src,a,range,dmg,color,r,false);
    }
}
function explosion(x,y,radius,dmg,src,color) {
    spawnParticles(x,y,color,18,180);
    bullets.push({explodeRing:true,x,y,radius:0,maxR:radius,life:0.35,color,dead:false});
    const targets=src.fromPlayer!==false ? (modeEnemies||[]) : [player];
    targets.forEach(t=>{
        if(t&&!t.dead&&dist(x,y,t.x,t.y)<radius+(t.size||24)/2){
            applyDmg(t,dmg,color,src.fromPlayer!==false);
        }
    });
}

// fire pools (Amber super)
let firePool=[];

// Bears (Nita super)
let bears=[];
function summonBear(owner) {
    bears.push({
        x:owner.x+Math.cos(owner.angle)*60, y:owner.y+Math.sin(owner.angle)*60,
        hp:120, maxHp:120, size:24, color:'#6c5ce7', angle:0,
        speed:110, attackTimer:0, dead:false, owner,
    });
    spawnParticles(owner.x,owner.y,'#a55eea',16,130);
}

function applyDmg(target,dmg,color,fromPlayer) {
    if(target.shielded) return;
    target.hp-=dmg;
    spawnFloat(target.x,target.y-22,`-${Math.round(dmg)}`,color);
    spawnParticles(target.x,target.y,color,5,70);
    if(target.hp<=0) killEntity(target,fromPlayer);
}

function killEntity(e,fromPlayer) {
    if(e.dead) return;
    e.dead=true;
    spawnParticles(e.x,e.y,e.color||'#fff',14,170);
    if(fromPlayer&&e!==player) {
        kills++;
        player.super=Math.min(SUPER_MAX,player.super+20);
    }
}

// ── Tile Maps ─────────────────────────────────────────────────────────
const ARENA_MAP=[
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
// BrawlBall: rows 4-8 have no left/right wall → goal openings
const BB_MAP=[
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];
const SD_MAP=[
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

let walls=[], activeMap=ARENA_MAP;
function buildWalls(map){
    walls=[]; activeMap=map;
    for(let r=0;r<map.length;r++)
        for(let c=0;c<map[r].length;c++)
            if(map[r][c]) walls.push({x:c*TILE,y:r*TILE,w:TILE,h:TILE});
}
function isWall(x,y,r){
    for(const w of walls)
        if(x-r<w.x+w.w&&x+r>w.x&&y-r<w.y+w.h&&y+r>w.y) return true;
    return false;
}

// ── Character drawing ─────────────────────────────────────────────────
function drawChar(e,isPlayer){
    const{x,y,size,color,angle}=e;
    const r=size/2;
    ctx.save(); ctx.translate(x,y);
    // shadow
    ctx.fillStyle='rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(2,r*.85,r*.7,r*.28,0,0,Math.PI*2); ctx.fill();
    // body
    ctx.shadowBlur=isPlayer?14:0; ctx.shadowColor=color;
    if(e.shielded){ ctx.strokeStyle='#74b9ff'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(0,0,r+5,0,Math.PI*2); ctx.stroke(); }
    if(e.invisible&&e.isPlayer){ ctx.globalAlpha=0.35; }
    ctx.fillStyle=color; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    // outline
    ctx.strokeStyle=isPlayer?'rgba(255,255,255,.6)':'rgba(0,0,0,.35)';
    ctx.lineWidth=isPlayer?2:1.5; ctx.stroke();
    // highlight
    ctx.fillStyle='rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(-r*.27,-r*.27,r*.42,0,Math.PI*2); ctx.fill();
    // eyes
    const ea=[angle-.38,angle+.38], ed=r*.4;
    ctx.fillStyle='#fff';
    ea.forEach(a=>{ctx.beginPath();ctx.arc(Math.cos(a)*ed,Math.sin(a)*ed,r*.22,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle='#111';
    ea.forEach(a=>{ctx.beginPath();ctx.arc(Math.cos(a)*ed+Math.cos(angle)*r*.1,Math.sin(a)*ed+Math.sin(angle)*r*.1,r*.1,0,Math.PI*2);ctx.fill();});
    // gun
    ctx.strokeStyle=isPlayer?'#ddd':'#aaa'; ctx.lineWidth=isPlayer?5:4; ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(Math.cos(angle)*r*.5,Math.sin(angle)*r*.5);ctx.lineTo(Math.cos(angle)*(r+12),Math.sin(angle)*(r+12));ctx.stroke();
    ctx.globalAlpha=1; ctx.restore();
    // HP bar
    const bw=size*1.5,bh=5,bx=x-bw/2,by=y-r-14;
    ctx.fillStyle='#222'; rrect(bx,by,bw,bh,3); ctx.fill();
    const ratio=Math.max(0,e.hp/(e.maxHp||e.hp));
    ctx.fillStyle=ratio>.5?'#2ecc71':ratio>.25?'#f39c12':'#e74c3c';
    if(ratio>0){rrect(bx,by,bw*ratio,bh,3);ctx.fill();}
    // name tag for player
    if(isPlayer){
        ctx.font='bold 11px Arial'; ctx.fillStyle=color; ctx.textAlign='center';
        ctx.fillText(player.def.name,x,by-3);
    }
}
function rrect(x,y,w,h,r){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function drawFloor(map){
    for(let r=0;r<map.length;r++)
        for(let c=0;c<map[r].length;c++)
            if(!map[r][c]){ctx.fillStyle=(r+c)%2===0?'#3a7a32':'#306828';ctx.fillRect(c*TILE,r*TILE,TILE,TILE);}
    for(const w of walls){
        ctx.fillStyle='#7a6040';ctx.fillRect(w.x,w.y,w.w,w.h);
        ctx.fillStyle='#9a7a50';ctx.fillRect(w.x+2,w.y+2,w.w-4,8);
        ctx.fillStyle='#5a4428';ctx.fillRect(w.x,w.y+w.h-5,w.w,5);
    }
}

// ── Shared bullet update ──────────────────────────────────────────────
let modeEnemies=[];
function updateBullets(dt){
    bullets=bullets.filter(b=>{
        if(b.dead) return false;
        if(b.explodeRing){ b.radius+=(b.maxR/.35)*dt; b.life-=dt; return b.life>0; }
        b.x+=b.vx*dt; b.y+=b.vy*dt; b.traveled+=Math.hypot(b.vx,b.vy)*dt;
        if(b.traveled>b.maxRange) return false;
        if(isWall(b.x,b.y,b.radius)){
            if(b.explodeR) explosion(b.x,b.y,b.explodeR,b.explodeDmg,{fromPlayer:b.fromPlayer},b.explodeColor||b.color);
            spawnParticles(b.x,b.y,b.color,4,50); return false;
        }
        // fire trail
        if(b.fire&&Math.random()<.3) spawnParticles(b.x,b.y,'#fd9644',2,30);
        if(b.healbat){
            if(dist(b.x,b.y,player.x,player.y)<player.size/2+8){
                player.hp=Math.min(player.maxHp,player.hp+20);
                spawnFloat(player.x,player.y-22,'+20','#a29bfe'); return false;
            }
        }
        if(b.fromPlayer){
            for(const e of modeEnemies){
                if(e.dead) continue;
                if(dist(b.x,b.y,e.x,e.y)<e.size/2+b.radius){
                    let dmg=b.dmg; if(b.sniper) dmg*=(1+b.traveled/300);
                    applyDmg(e,dmg,b.color,true);
                    if(b.explodeR) explosion(b.x,b.y,b.explodeR,b.explodeDmg,{fromPlayer:true},b.explodeColor||b.color);
                    if(!b.pierce) return false;
                }
            }
            // Bears also take damage from enemies
            for(const bear of bears){
                if(bear.dead) continue;
                if(bear.owner!==player&&dist(b.x,b.y,bear.x,bear.y)<bear.size/2+b.radius){ bear.hp-=b.dmg; if(bear.hp<=0)bear.dead=true; return false; }
            }
        } else {
            if(!player.dead&&dist(b.x,b.y,player.x,player.y)<player.size/2+b.radius){
                let dmg=b.dmg; if(b.sniper) dmg*=(1+b.traveled/300);
                applyDmg(player,dmg,b.color,false);
                if(player.hp<=0&&!player.dead){ triggerGameOver(false); }
                return false;
            }
        }
        return true;
    });
}
function updateParticles(dt){
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.92;p.vy*=.92;p.life-=dt;}
    particles=particles.filter(p=>p.life>0);
    for(const f of floatTexts){f.y+=f.vy*dt;f.life-=dt;}
    floatTexts=floatTexts.filter(f=>f.life>0);
}
function updatePlayerTimers(dt){
    if(player.dashing){player.dashTimer-=dt;if(player.dashTimer<=0)player.dashing=false;}
    if(player.invisible){player.invisTimer-=dt;if(player.invisTimer<=0){player.invisible=false;spawnParticles(player.x,player.y,'#00cec9',10,80);}}
    if(player.shielded){player.shieldTimer-=dt;if(player.shieldTimer<=0)player.shielded=false;}
    if(player.attackCooldown>0) player.attackCooldown-=dt;
    if(player.ammo<player.ammoMax){player.ammoTimer+=dt;if(player.ammoTimer>=AMMO_REGEN){player.ammo++;player.ammoTimer=0;}}
}
function moveEntity(e,dx,dy,spd,dt){
    const m=Math.hypot(dx,dy)||1; dx/=m; dy/=m;
    const nx=e.x+dx*spd*dt, ny=e.y+dy*spd*dt;
    if(!isWall(nx,e.y,e.size/2-2)) e.x=clamp(nx,e.size/2,W-e.size/2);
    if(!isWall(e.x,ny,e.size/2-2)) e.y=clamp(ny,e.size/2,H-e.size/2);
}
function movePlayer(dt){
    let dx=0,dy=0;
    if(keys['w']||keys['arrowup'])   dy-=1;
    if(keys['s']||keys['arrowdown']) dy+=1;
    if(keys['a']||keys['arrowleft']) dx-=1;
    if(keys['d']||keys['arrowright'])dx+=1;
    let spd=player.speed;
    if(player.dashing){dx=Math.cos(player.dashAngle);dy=Math.sin(player.dashAngle);spd=player.dashSpeed;}
    if(dx||dy) moveEntity(player,dx,dy,spd,dt);
    player.angle=Math.atan2(mouseY-player.y,mouseX-player.x);
}

// ── ENEMY ARCHETYPES ──────────────────────────────────────────────────
const ENEMY_TYPES=[
    {color:'#e74c3c',hp:80,speed:95,size:22,range:220,cool:1.6,dmg:18,
     fire(e){bullet({x:e.x,y:e.y,size:e.size,fromPlayer:false},e.angle,280,e.dmg,e.color,6,false);}},
    {color:'#9b59b6',hp:65,speed:85,size:20,range:300,cool:2.0,dmg:13,
     fire(e){for(let i=-1;i<=1;i++) bullet({x:e.x,y:e.y,size:e.size,fromPlayer:false},e.angle+i*.22,320,e.dmg*.75,e.color,6,false);}},
    {color:'#e67e22',hp:160,speed:70,size:28,range:52,cool:1.0,dmg:26,
     fire(e){if(dist(e.x,e.y,player.x,player.y)<e.range+e.size){applyDmg(player,e.dmg,e.color,false);if(player.hp<=0)triggerGameOver(false);}}},
    {color:'#1abc9c',hp:55,speed:105,size:18,range:420,cool:2.4,dmg:30,
     fire(e){const b=bullet({x:e.x,y:e.y,size:e.size,fromPlayer:false},e.angle,500,e.dmg,e.color,5,true);b.sniper=true;}},
];
function makeEnemy(type,x,y,hpScale=1){
    return{x,y,hp:type.hp*hpScale,maxHp:type.hp*hpScale,speed:type.speed,size:type.size,color:type.color,
        range:type.range,cool:type.cool,dmg:type.dmg,fire:type.fire,
        angle:0,attackTimer:Math.random()*type.cool,dead:false};
}
function aiSeekPlayer(e,dt){
    const dx=player.x-e.x,dy=player.y-e.y,pd=Math.hypot(dx,dy);
    e.angle=Math.atan2(dy,dx);
    if(pd>e.range*.75) moveEntity(e,dx,dy,e.speed,dt);
    e.attackTimer-=dt;
    if(e.attackTimer<=0&&pd<e.range+e.size){e.attackTimer=e.cool;e.fire(e);}
}

// ── MODE: ARENA ───────────────────────────────────────────────────────
let arenaWave=1, arenaEnemies=[];
function arenaInit(){
    buildWalls(ARENA_MAP); arenaWave=1; arenaEnemies=[]; modeEnemies=arenaEnemies;
    spawnArenaWave();
}
function spawnArenaWave(){
    const pts=[{x:2.5,y:2.5},{x:15.5,y:2.5},{x:2.5,y:10.5},{x:15.5,y:10.5},{x:9,y:5},{x:9,y:9},{x:2,y:6},{x:15,y:6}];
    const count=4+arenaWave*2, scale=1+(arenaWave-1)*.25;
    arenaEnemies.length=0;
    for(let i=0;i<count;i++){
        const sp=pts[i%pts.length];
        const t=ENEMY_TYPES[Math.floor(Math.random()*Math.min(ENEMY_TYPES.length,1+arenaWave))];
        arenaEnemies.push(makeEnemy(t,sp.x*TILE+rand(5,15),sp.y*TILE+rand(5,15),scale));
    }
}
function arenaUpdate(dt){
    updatePlayerTimers(dt); movePlayer(dt); updateFirePools(dt); updateBears(dt);
    arenaEnemies.forEach(e=>{if(!e.dead) aiSeekPlayer(e,dt);});
    arenaEnemies=arenaEnemies.filter(e=>!e.dead); modeEnemies=arenaEnemies;
    updateBullets(dt); updateParticles(dt);
    if(arenaEnemies.length===0){
        arenaWave++;
        if(arenaWave>5){triggerGameOver(true);return;}
        player.hp=Math.min(player.maxHp,player.hp+50);
        player.ammo=player.ammoMax;
        spawnArticles(player.x,player.y,'#f7c948',20,200);
        spawnArenaWave();
    }
    updateHUD();
}
function arenaDrawExtras(){
    // wave info
    ctx.save();ctx.fillStyle='rgba(247,201,72,.25)';ctx.font='bold 13px Arial';ctx.textAlign='right';
    ctx.fillText(`Welle ${arenaWave}/5 · ${arenaEnemies.length} Gegner`,W-8,20);ctx.restore();
}

// ── MODE: BRAWL BALL ──────────────────────────────────────────────────
let ball, bbScore, bbTeam, bbResetTimer, bbGoalFlash;
const BB_GOAL_Y0=4*TILE, BB_GOAL_Y1=8*TILE;  // goal row range
function bbInit(){
    buildWalls(BB_MAP);
    bbScore=[0,0]; bbResetTimer=0; bbGoalFlash=null;
    bbResetPositions();
    document.getElementById('bb-score').style.display='block';
}
function bbMakeBrawler(brawlerDef,x,y,team,isHuman){
    return{x,y,hp:brawlerDef.hp,maxHp:brawlerDef.hp,ammo:brawlerDef.ammoMax,ammoMax:brawlerDef.ammoMax,
        ammoTimer:0,super:0,speed:brawlerDef.speed,size:26,angle:0,color:team===0?brawlerDef.color:'#e74c3c',
        attackCooldown:0,def:brawlerDef,dead:false,team,isHuman,dashing:false,dashTimer:0,shielded:false,invisible:false};
}
function bbResetPositions(){
    const def=BRAWLERS[selectedBrawlerIdx];
    bbTeam=[
        bbMakeBrawler(def,160,H/2,0,true),           // player (blue)
        bbMakeBrawler(BRAWLERS[1],160,H/2-70,0,false),// ally1
        bbMakeBrawler(BRAWLERS[2],160,H/2+70,0,false),// ally2
        bbMakeBrawler(BRAWLERS[0],W-160,H/2,1,false), // opp1
        bbMakeBrawler(BRAWLERS[3],W-160,H/2-70,1,false),
        bbMakeBrawler(BRAWLERS[4],W-160,H/2+70,1,false),
    ];
    // first element is always our player
    Object.assign(player, bbTeam[0]);
    bbTeam[0]=player;
    ball={x:W/2,y:H/2,vx:0,vy:0,radius:13};
    modeEnemies=bbTeam.filter(m=>m.team===1);
}
function bbUpdate(dt){
    if(bbResetTimer>0){ bbResetTimer-=dt; return; }
    updatePlayerTimers(dt); movePlayer(dt);
    bbUpdateAI(dt);
    bbUpdateBall(dt);
    updateBullets(dt); updateParticles(dt);
    // ammo regen for AI
    for(const m of bbTeam){
        if(m.isHuman) continue;
        if(m.ammo<m.ammoMax){m.ammoTimer+=dt;if(m.ammoTimer>=AMMO_REGEN){m.ammo++;m.ammoTimer=0;}}
        if(m.attackCooldown>0) m.attackCooldown-=dt;
    }
    updateHUD();
    const sc=`🔵 ${bbScore[0]} – ${bbScore[1]} 🔴`;
    document.getElementById('bb-score').textContent=sc;
}
function bbUpdateBall(dt){
    const bx=ball.x+ball.vx*dt, by=ball.y+ball.vy*dt;
    // wall bounce
    let nx=bx, ny=by;
    if(isWall(bx,ball.y,ball.radius)){ ball.vx*=-0.65; nx=ball.x; }
    else if(bx-ball.radius<0&&(ball.y<BB_GOAL_Y0||ball.y>BB_GOAL_Y1)){ ball.vx*=-0.65; nx=ball.radius+1; }
    else if(bx+ball.radius>W&&(ball.y<BB_GOAL_Y0||ball.y>BB_GOAL_Y1)){ ball.vx*=-0.65; nx=W-ball.radius-1; }
    if(isWall(ball.x,by,ball.radius)){ ball.vy*=-0.65; ny=ball.y; }
    else if(by-ball.radius<0){ ball.vy*=-0.65; ny=ball.radius+1; }
    else if(by+ball.radius>H){ ball.vy*=-0.65; ny=H-ball.radius-1; }
    ball.x=nx; ball.y=ny;
    ball.vx*=0.977; ball.vy*=0.977;
    // Goal detection
    if(ball.x-ball.radius<0&&ball.y>BB_GOAL_Y0&&ball.y<BB_GOAL_Y1){ bbGoal(1); return; }
    if(ball.x+ball.radius>W&&ball.y>BB_GOAL_Y0&&ball.y<BB_GOAL_Y1){ bbGoal(0); return; }
    // Player/AI push ball
    for(const m of bbTeam){
        if(m.dead) continue;
        const d=dist(m.x,m.y,ball.x,ball.y);
        if(d<m.size/2+ball.radius){
            const a=Math.atan2(ball.y-m.y,ball.x-m.x);
            ball.vx+=Math.cos(a)*60; ball.vy+=Math.sin(a)*60;
            ball.x=m.x+Math.cos(a)*(m.size/2+ball.radius+1);
            ball.y=m.y+Math.sin(a)*(m.size/2+ball.radius+1);
        }
    }
    // Bullet hit ball
    bullets=bullets.filter(b=>{
        if(b.explodeRing||b.dead) return true;
        if(dist(b.x,b.y,ball.x,ball.y)<ball.radius+b.radius){
            ball.vx+=Math.cos(b.angle)*360; ball.vy+=Math.sin(b.angle)*360;
            spawnParticles(ball.x,ball.y,'#fff',6,80);
            return false;
        }
        return true;
    });
}
function bbGoal(scoringTeam){
    bbScore[scoringTeam]++;
    bbGoalFlash={team:scoringTeam,timer:1.5};
    spawnParticles(ball.x,ball.y,'#f7c948',30,250);
    if(bbScore[0]>=2) { triggerGameOver(true); return; }
    if(bbScore[1]>=2) { triggerGameOver(false); return; }
    bbResetTimer=1.5;
    setTimeout(()=>bbResetPositions(),200);
}
function bbUpdateAI(dt){
    for(const m of bbTeam){
        if(m.isHuman||m.dead) continue;
        const goalX=m.team===0?W-TILE:TILE;
        const goalY=H/2;
        const dball=dist(m.x,m.y,ball.x,ball.y);
        // Find closest ally to ball
        let closest=null,cdist=9999;
        for(const a of bbTeam){if(a.team===m.team&&!a.isHuman){ const d=dist(a.x,a.y,ball.x,ball.y);if(d<cdist){cdist=d;closest=a;}}}
        if(closest===m||dball<90){
            // Chase ball
            const adx=ball.x-m.x,ady=ball.y-m.y;
            m.angle=Math.atan2(ady,adx);
            moveEntity(m,adx,ady,m.speed,dt);
            // When near ball, shoot toward goal
            if(dball<100&&m.attackCooldown<=0&&m.ammo>0){
                m.ammo--; m.ammoTimer=0; m.attackCooldown=0.3;
                const shootA=Math.atan2(goalY-m.y,goalX-m.x)+(rand(-.15,.15));
                bullet({x:m.x,y:m.y,size:m.size,fromPlayer:m.team===0},shootA,350,15,m.color,5,false);
            }
        } else {
            // Defensive position
            const tx=m.team===0?W*0.3+rand(-30,30):W*0.7+rand(-30,30);
            const ty=H/2+rand(-80,80);
            moveEntity(m,tx-m.x,ty-m.y,m.speed*.6,dt);
        }
        m.attackCooldown-=dt;
    }
}
function bbDraw(){
    drawFloor(BB_MAP);
    // Goal zones
    ctx.save();
    ctx.fillStyle='rgba(52,152,219,.2)';
    ctx.fillRect(0,BB_GOAL_Y0,TILE,BB_GOAL_Y1-BB_GOAL_Y0);
    ctx.fillStyle='rgba(231,76,60,.2)';
    ctx.fillRect(W-TILE,BB_GOAL_Y0,TILE,BB_GOAL_Y1-BB_GOAL_Y0);
    // Goal posts
    ctx.strokeStyle='#fff'; ctx.lineWidth=3;
    ctx.strokeRect(0,BB_GOAL_Y0,4,BB_GOAL_Y1-BB_GOAL_Y0);
    ctx.strokeRect(W-4,BB_GOAL_Y0,4,BB_GOAL_Y1-BB_GOAL_Y0);
    // Center circle
    ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(W/2,H/2,70,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(W/2,TILE);ctx.lineTo(W/2,H-TILE);ctx.stroke();
    ctx.restore();
    // Ball shadow
    ctx.fillStyle='rgba(0,0,0,.3)';
    ctx.beginPath();ctx.ellipse(ball.x+3,ball.y+5,ball.radius*.9,ball.radius*.4,0,0,Math.PI*2);ctx.fill();
    // Ball
    ctx.save();
    ctx.shadowBlur=10;ctx.shadowColor='#fff';
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#555';ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(ball.x-ball.radius*.5,ball.y-ball.radius*.7);
    ctx.lineTo(ball.x+ball.radius*.5,ball.y-ball.radius*.7);
    ctx.moveTo(ball.x-ball.radius*.7,ball.y);ctx.lineTo(ball.x+ball.radius*.7,ball.y);
    ctx.moveTo(ball.x-ball.radius*.5,ball.y+ball.radius*.7);
    ctx.lineTo(ball.x+ball.radius*.5,ball.y+ball.radius*.7);
    ctx.stroke();ctx.restore();
    // Goal flash overlay
    if(bbGoalFlash&&bbGoalFlash.timer>0){
        bbGoalFlash.timer-=0.016;
        ctx.save();ctx.globalAlpha=Math.min(0.4,bbGoalFlash.timer*.4);
        ctx.fillStyle=bbGoalFlash.team===0?'#3498db':'#e74c3c';
        ctx.fillRect(0,0,W,H);
        ctx.globalAlpha=1;ctx.font='bold 60px Arial Black';ctx.textAlign='center';ctx.fillStyle='#fff';
        ctx.fillText('TOR!',W/2,H/2);ctx.restore();
    }
    drawBulletsAndFX();
    for(const m of bbTeam) if(!m.dead) drawChar(m,m===player);
    drawSharedFX();
}

// ── MODE: SHOWDOWN ────────────────────────────────────────────────────
let sdPlayers, sdZone, sdCrates, sdAlive;
const SD_TOTAL=10;
function sdInit(){
    buildWalls(SD_MAP);
    sdZone={cx:W/2,cy:H/2,r:320,shrinkRate:320/90};
    sdCrates=[];
    const cratePos=[
        {x:3,y:3},{x:14,y:3},{x:3,y:9},{x:14,y:9},
        {x:8,y:2},{x:8,y:10},{x:3,y:6},{x:14,y:6},
    ];
    cratePos.forEach(c=>sdCrates.push({x:c.x*TILE+20,y:c.y*TILE+20,alive:true,respawnTimer:0}));
    sdPlayers=[];
    const colors=['#e74c3c','#9b59b6','#e67e22','#1abc9c','#f39c12','#e84393','#16a085','#c0392b','#2980b9'];
    for(let i=0;i<SD_TOTAL-1;i++){
        const def=BRAWLERS[i%BRAWLERS.length];
        const angle=((Math.PI*2)/( SD_TOTAL-1))*i;
        const r2=200;
        sdPlayers.push({
            x:W/2+Math.cos(angle)*r2,y:H/2+Math.sin(angle)*r2,
            hp:def.hp,maxHp:def.hp,ammo:def.ammoMax,ammoMax:def.ammoMax,
            ammoTimer:0,super:0,speed:def.speed,size:24,angle:0,color:colors[i%colors.length],
            attackCooldown:0,def,dead:false,isAI:true,
            attackTimer:rand(0,2), dashing:false,shielded:false,invisible:false,
        });
    }
    sdPlayers.unshift(player); // player at index 0
    modeEnemies=sdPlayers.filter(p=>p!==player);
    sdAlive=SD_TOTAL;
    document.getElementById('sd-hud').style.display='block';
}
function sdUpdate(dt){
    updatePlayerTimers(dt); movePlayer(dt);
    // Zone shrink
    sdZone.r=Math.max(0,sdZone.r-sdZone.shrinkRate*dt);
    // Outside zone damage
    for(const p of sdPlayers){
        if(p.dead) continue;
        if(dist(p.x,p.y,sdZone.cx,sdZone.cy)>sdZone.r){
            p.hp-=7*dt;
            if(p.hp<=0&&!p.dead){ p.dead=true; spawnParticles(p.x,p.y,p.color,14,160); if(p===player){triggerGameOver(false);return;} }
        }
    }
    // Crate respawn
    for(const c of sdCrates){
        if(!c.alive){c.respawnTimer-=dt;if(c.respawnTimer<=0)c.alive=true;}
    }
    // Crate collection (player)
    for(const c of sdCrates){
        if(!c.alive) continue;
        if(dist(player.x,player.y,c.x,c.y)<30){
            c.alive=false;c.respawnTimer=15;
            player.hp=Math.min(player.maxHp,player.hp+35);
            spawnFloat(player.x,player.y-22,'❤️+35','#2ecc71');
        }
    }
    // AI players
    const alivePlayers=sdPlayers.filter(p=>!p.dead);
    sdAlive=alivePlayers.length;
    modeEnemies=sdPlayers.filter(p=>p!==player&&!p.dead);
    for(const ai of sdPlayers){
        if(!ai.isAI||ai.dead) continue;
        ai.attackCooldown-=dt;
        if(ai.ammo<ai.ammoMax){ai.ammoTimer+=dt;if(ai.ammoTimer>=AMMO_REGEN){ai.ammo++;ai.ammoTimer=0;}}
        // Outside zone? go to center
        if(dist(ai.x,ai.y,sdZone.cx,sdZone.cy)>sdZone.r-30){
            moveEntity(ai,sdZone.cx-ai.x,sdZone.cy-ai.y,ai.speed,dt);
            ai.angle=Math.atan2(sdZone.cy-ai.y,sdZone.cx-ai.x);
            continue;
        }
        // Find nearest enemy
        let target=null, td=9999;
        for(const t of alivePlayers){
            if(t===ai) continue;
            const d=dist(ai.x,ai.y,t.x,t.y);
            if(d<td){td=d;target=t;}
        }
        if(!target) continue;
        ai.angle=Math.atan2(target.y-ai.y,target.x-ai.x);
        if(td>130) moveEntity(ai,target.x-ai.x,target.y-ai.y,ai.speed,dt);
        if(td<280&&ai.attackCooldown<=0&&ai.ammo>0){
            ai.ammo--;ai.ammoTimer=0;ai.attackCooldown=0.25;
            bullet({x:ai.x,y:ai.y,size:ai.size,fromPlayer:false},ai.angle+(rand(-.1,.1)),300,16,ai.color,5,false);
        }
    }
    updateBullets(dt); updateFirePools(dt); updateBears(dt); updateParticles(dt);
    if(sdAlive<=1&&!player.dead){ triggerGameOver(true); return; }
    updateHUD();
    document.getElementById('sd-alive').textContent=`Alive: ${sdAlive}/${SD_TOTAL}`;
    document.getElementById('sd-timer').textContent=`Zone: ${Math.ceil(sdZone.r/sdZone.shrinkRate)}s`;
}
function sdDraw(){
    drawFloor(SD_MAP);
    // Zone darkness outside
    ctx.save();
    ctx.fillStyle='rgba(60,0,0,.55)';
    ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation='destination-out';
    ctx.beginPath();ctx.arc(sdZone.cx,sdZone.cy,sdZone.r,0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation='source-over';
    // Zone border
    ctx.strokeStyle='#e74c3c';ctx.lineWidth=3;ctx.setLineDash([8,6]);
    ctx.beginPath();ctx.arc(sdZone.cx,sdZone.cy,sdZone.r,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);ctx.restore();
    // Crates
    for(const c of sdCrates){
        if(!c.alive) continue;
        ctx.save();ctx.fillStyle='#f9ca24';ctx.strokeStyle='#f39c12';ctx.lineWidth=2;
        ctx.fillRect(c.x-12,c.y-12,24,24);ctx.strokeRect(c.x-12,c.y-12,24,24);
        ctx.fillStyle='#e67e22';ctx.font='bold 14px Arial';ctx.textAlign='center';ctx.fillText('❤',c.x,c.y+5);
        ctx.restore();
    }
    drawBulletsAndFX();
    for(const p of sdPlayers) if(!p.dead) drawChar(p,p===player);
    for(const b of bears) if(!b.dead) drawChar(b,false);
    drawSharedFX();
}

// ── Shared draw helpers ───────────────────────────────────────────────
function drawBulletsAndFX(){
    for(const b of bullets){
        if(b.explodeRing){
            ctx.save();ctx.globalAlpha=b.life/.35*.45;ctx.strokeStyle=b.color;ctx.lineWidth=4;
            ctx.beginPath();ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);ctx.stroke();ctx.restore(); continue;
        }
        ctx.save();ctx.shadowBlur=b.rocket?16:8;ctx.shadowColor=b.color;ctx.fillStyle=b.color;
        if(b.rocket){
            ctx.translate(b.x,b.y);ctx.rotate(b.angle);
            ctx.beginPath();ctx.ellipse(0,0,b.radius*1.4,b.radius*.55,0,0,Math.PI*2);ctx.fill();
        } else if(b.blade){
            ctx.translate(b.x,b.y);ctx.rotate(b.angle);
            ctx.fillRect(-b.radius*1.5,-b.radius*.4,b.radius*3,b.radius*.8);
        } else {
            ctx.beginPath();ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
    }
}
function drawSharedFX(){
    for(const p of particles){
        ctx.save();ctx.globalAlpha=p.life/p.maxLife;ctx.fillStyle=p.color;
        ctx.beginPath();ctx.arc(p.x,p.y,p.r*(p.life/p.maxLife),0,Math.PI*2);ctx.fill();ctx.restore();
    }
    for(const f of floatTexts){
        ctx.save();ctx.globalAlpha=f.life/1.1;ctx.fillStyle=f.color;ctx.font='bold 13px Arial';ctx.textAlign='center';
        ctx.fillText(f.text,f.x,f.y);ctx.restore();
    }
    // Fire pools
    for(const f of firePool){
        ctx.save();ctx.globalAlpha=f.life/5*.6;
        const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);
        g.addColorStop(0,'rgba(255,150,30,.8)');g.addColorStop(1,'rgba(255,50,0,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.fill();ctx.restore();
    }
}
function updateFirePools(dt){
    for(const f of firePool){
        f.life-=dt; f.dmgTimer+=dt;
        if(f.dmgTimer>=0.5){
            f.dmgTimer=0;
            if(dist(player.x,player.y,f.x,f.y)<f.r+player.size/2) applyDmg(player,10,'#fd9644',false);
            for(const e of modeEnemies) if(!e.dead&&dist(e.x,e.y,f.x,f.y)<f.r+e.size/2) applyDmg(e,10,'#fd9644',true);
        }
    }
    firePool=firePool.filter(f=>f.life>0);
}
function updateBears(dt){
    for(const b of bears){
        if(b.dead) continue;
        // find nearest non-owner enemy
        let target=null,td=9999;
        for(const e of modeEnemies){
            if(e===b.owner||e.dead) continue;
            const d=dist(b.x,b.y,e.x,e.y);if(d<td){td=d;target=e;}
        }
        if(target){
            b.angle=Math.atan2(target.y-b.y,target.x-b.x);
            moveEntity(b,target.x-b.x,target.y-b.y,b.speed,dt);
            b.attackTimer-=dt;
            if(b.attackTimer<=0&&td<b.size+target.size){
                b.attackTimer=1.2; applyDmg(target,30,'#6c5ce7',true);
            }
        }
    }
    bears=bears.filter(b=>!b.dead);
}
function spawnArticles(x,y,color,count,spd){spawnParticles(x,y,color,count,spd);}

// ── Main game loop ────────────────────────────────────────────────────
function loop(ts){
    const dt=Math.min((ts-lastTime)/1000,.05); lastTime=ts;
    if(!gameActive) return;
    if(currentMode==='arena'){ arenaUpdate(dt); drawMode(); }
    else if(currentMode==='brawlball'){ bbUpdate(dt); drawMode(); }
    else if(currentMode==='showdown'){ sdUpdate(dt); drawMode(); }
    requestAnimationFrame(loop);
}
function drawMode(){
    ctx.clearRect(0,0,W,H);
    if(currentMode==='arena'){
        drawFloor(ARENA_MAP);
        drawBulletsAndFX();
        for(const e of arenaEnemies) if(!e.dead) drawChar(e,false);
        for(const b of bears) if(!b.dead) drawChar(b,false);
        drawChar(player,true);
        drawSharedFX();
        arenaDrawExtras();
    } else if(currentMode==='brawlball'){
        bbDraw();
    } else if(currentMode==='showdown'){
        sdDraw();
    }
}

// ── HUD ───────────────────────────────────────────────────────────────
function updateHUD(){
    document.getElementById('hp-fill').style.width=Math.max(0,player.hp/player.maxHp*100)+'%';
    document.getElementById('ammo-fill').style.width=(player.ammo/player.ammoMax*100)+'%';
    document.getElementById('super-fill').style.width=(player.super/SUPER_MAX*100)+'%';
    document.getElementById('hud-kills').textContent=`Kills: ${kills}`;
    if(currentMode==='arena') document.getElementById('hud-wave').textContent=`Welle ${arenaWave}/5`;
    else if(currentMode==='showdown') document.getElementById('hud-wave').textContent=`Showdown`;
    else document.getElementById('hud-wave').textContent=`Brawl Ball`;
    document.getElementById('super-btn-hint').style.color=player.super>=SUPER_MAX?'#f7c948':'#555';
}

// ── Game over ─────────────────────────────────────────────────────────
function triggerGameOver(won){
    gameActive=false;
    const msgs={
        arena:   [won?'🏆 SIEG!':'💀 NIEDERLAGE', won?'Alle Wellen besiegt!':'Du wurdest eliminiert!'],
        brawlball:[won?'🏆 SIEG!':'💀 NIEDERLAGE', won?'Du hast 2 Tore geschossen!':'Die rote Mannschaft hat gewonnen!'],
        showdown: [won?'🏆 GEWONNEN!':'💀 AUSGESCHIEDEN', won?'Du bist der letzte Überlebende!':'Du wurdest eliminated!'],
    };
    const[title,sub]=msgs[currentMode];
    document.getElementById('overlay-title').textContent=title;
    document.getElementById('overlay-sub').textContent=sub;
    document.getElementById('overlay-score').textContent=`Kills: ${kills}`;
    document.getElementById('overlay').classList.remove('hidden');
}

// ── UI flow ───────────────────────────────────────────────────────────
function showSelect(){
    hideAll();
    document.getElementById('selectScreen').classList.remove('hidden');
    renderBrawlerGrid();
}
function showModeSelect(){
    hideAll();
    document.getElementById('modeScreen').classList.remove('hidden');
    selectMode(selectedMode);
}
function hideAll(){
    ['menuScreen','selectScreen','modeScreen'].forEach(id=>document.getElementById(id).classList.add('hidden'));
    document.getElementById('gameCanvas').style.display='none';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('bb-score').style.display='none';
    document.getElementById('sd-hud').style.display='none';
}
function selectMode(mode){
    selectedMode=mode;
    document.querySelectorAll('.mode-card').forEach(c=>c.classList.remove('selected'));
    document.getElementById('mode-'+mode).classList.add('selected');
}
function renderBrawlerGrid(){
    const grid=document.getElementById('brawlerGrid');
    grid.innerHTML='';
    // Adjust grid columns for more brawlers
    grid.style.gridTemplateColumns='repeat(4, 150px)';
    BRAWLERS.forEach((b,i)=>{
        const card=document.createElement('div');
        card.className='brawler-card'+(i===selectedBrawlerIdx?' selected':'');
        const stars=b.stars.map(s=>`<div style="display:flex;gap:2px">${Array.from({length:5},(_,k)=>`<div class="stat-bar${k<s?' filled':''}"></div>`).join('')}</div>`).join('');
        card.innerHTML=`<div class="brawler-icon" style="background:${b.color}33;border:2px solid ${b.color}">${b.emoji}</div>
            <div class="brawler-class" style="background:${b.classColor}22;color:${b.classColor}">${b.classLabel}</div>
            <h3>${b.name}</h3><div class="brawler-desc">${b.desc}</div>
            <div style="font-size:10px;color:${b.color};margin-top:4px">${b.superDesc}</div>
            <div class="stat-row">${stars}</div>`;
        card.onclick=()=>{ selectedBrawlerIdx=i; renderBrawlerGrid(); };
        grid.appendChild(card);
    });
}
function startGame(mode){
    hideAll();
    currentMode=mode||selectedMode;
    document.getElementById('gameCanvas').style.display='block';
    document.getElementById('hud').classList.remove('hidden');

    bullets=[]; floatTexts=[]; particles=[]; firePool=[]; bears=[];
    kills=0; gameActive=true;

    const def=BRAWLERS[selectedBrawlerIdx];
    player={
        x:W/2,y:H/2,hp:def.hp,maxHp:def.hp,
        ammo:def.ammoMax,ammoMax:def.ammoMax,ammoTimer:0,super:0,
        speed:def.speed,size:26,angle:0,color:def.color,
        attackCooldown:0,def,dead:false,
        dashing:false,dashTimer:0,dashAngle:0,dashSpeed:400,
        invisible:false,invisTimer:0,shielded:false,shieldTimer:0,
        fromPlayer:true,
    };

    if(currentMode==='arena')     arenaInit();
    else if(currentMode==='brawlball') bbInit();
    else if(currentMode==='showdown')  sdInit();

    updateHUD();
    lastTime=performance.now();
    requestAnimationFrame(loop);
}

// ── Input ─────────────────────────────────────────────────────────────
window.addEventListener('keydown',e=>{
    keys[e.key.toLowerCase()]=true;
    if(!gameActive) return;
    if(e.key===' '){ e.preventDefault(); fireAttack(); }
    if(e.key.toLowerCase()==='e'&&player.super>=SUPER_MAX){
        player.super=0; player.def.super(player);
    }
});
window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
canvas.addEventListener('mousemove',e=>{
    const r=canvas.getBoundingClientRect();
    mouseX=e.clientX-r.left; mouseY=e.clientY-r.top;
});
canvas.addEventListener('mousedown',e=>{ if(gameActive&&e.button===0) fireAttack(); });
function fireAttack(){
    if(player.dead||player.attackCooldown>0||player.ammo<=0) return;
    player.ammo--;player.ammoTimer=0;player.attackCooldown=0.18;
    player.def.attack(player);
}
