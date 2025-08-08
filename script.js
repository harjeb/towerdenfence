(function(){
  // 基础世界坐标
  const WORLD = { w: 1000, h: 560 };

  // 画布 & 尺寸
  const canvas = document.getElementById('game');
  const wrap = document.getElementById('canvasWrap');
  const ctx = canvas.getContext('2d');
  let scale = 1, offsetX = 0, offsetY = 0;

  // UI refs
  const goldText = document.getElementById('goldText');
  const energyText = document.getElementById('energyText');
  const energyMaxText = document.getElementById('energyMaxText');
  const coreText = document.getElementById('coreText');
  const difficultySel = document.getElementById('difficulty');
  const startBtn = document.getElementById('startBtn');
  const helpBtn = document.getElementById('helpBtn');
  const speedBtn = document.getElementById('speedBtn');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMsg = document.getElementById('overlayMsg');
  const overlayRestart = document.getElementById('overlayRestart');
  const forkF1 = document.getElementById('fork-F1');
  const forkF3 = document.getElementById('fork-F3');

  const unitButtons = Array.from(document.querySelectorAll('.unit-btn'));
  const skillButtons = Array.from(document.querySelectorAll('.skill-btn'));

  // 难度与地图（固定路径 + 不同塔阵）
  const MAP = {
    nodes: {
      S:  {id:'S',  x: 60,  y:280, next:'N1'},
      N1: {id:'N1', x:220,  y:280, next:'F1'},
      F1: {id:'F1', x:320,  y:280, edges:{ up:'U1', down:'L1' }},
      U1: {id:'U1', x:470,  y:180, next:'U2'},
      U2: {id:'U2', x:620,  y:220, next:'N4'},
      L1: {id:'L1', x:470,  y:380, next:'L2'},
      L2: {id:'L2', x:620,  y:340, next:'N4'},
      N4: {id:'N4', x:720,  y:280, next:'F3'},
      F3: {id:'F3', x:820,  y:280, edges:{ up:'U3', down:'L3' }},
      U3: {id:'U3', x:900,  y:200, next:'CORE'},
      L3: {id:'L3', x:900,  y:360, next:'CORE'},
      CORE: {id:'CORE', x:950, y:280}
    },
    forks: ['F1','F3'],
    // 预绘路径（简单把所有可能线段都画出来）
    edges: [
      ['S','N1'],['N1','F1'],
      ['F1','U1'],['U1','U2'],['U2','N4'],
      ['F1','L1'],['L1','L2'],['L2','N4'],
      ['N4','F3'],
      ['F3','U3'],['U3','CORE'],
      ['F3','L3'],['L3','CORE'],
    ],
    difficulties: {
      easy: {
        coreHP: 120,
        energyMax: 100, energyRegen: 12,
        goldStart: 80, goldRegen: 2.0,
        towers: [
          {type:'arrow', x:360, y:240},
          {type:'cannon',x:600, y:280},
          {type:'frost', x:760, y:240},
          {type:'arrow', x:880, y:300},
        ]
      },
      normal: {
        coreHP: 140,
        energyMax: 100, energyRegen: 11,
        goldStart: 70, goldRegen: 1.6,
        towers: [
          {type:'arrow', x:300, y:240},
          {type:'cannon',x:470, y:240},
          {type:'frost', x:620, y:220},
          {type:'arrow', x:700, y:320},
          {type:'cannon',x:820, y:320},
          {type:'frost', x:900, y:260},
        ]
      },
      hard: {
        coreHP: 160,
        energyMax: 100, energyRegen: 10,
        goldStart: 60, goldRegen: 1.2,
        towers: [
          {type:'arrow', x:260, y:260},
          {type:'cannon',x:450, y:210},
          {type:'cannon',x:450, y:350},
          {type:'frost', x:600, y:240},
          {type:'arrow', x:680, y:320},
          {type:'frost', x:760, y:240},
          {type:'cannon',x:820, y:280},
          {type:'arrow', x:900, y:310},
        ]
      }
    }
  };

  // 单位 & 塔类型
  const UNITS = {
    goblin: { name:'哥布林', cost:10, speed:90,  hp:60,  dmg:8,  r:8,  color:'#2b8a3e' },
    brute:  { name:'巨兽',   cost:25, speed:50,  hp:280, dmg:25, r:12, color:'#7f5539' },
    assassin:{name:'刺客',   cost:20, speed:85,  hp:90,  dmg:16, r:9,  color:'#343a40', stealth:true },
    minion: { name:'小弟',   cost:0,  speed:70,  hp:35,  dmg:4,  r:7,  color:'#6a994e' } // 召唤
  };
  const TOWERS = {
    arrow: { name:'箭塔', color:'#2f4f4f', range:120, detectRatio:0.50, fireCd:0.35, dmg:18, bulletSpeed:320, aoe:0, slow:0 },
    cannon:{ name:'炮塔', color:'#6b3400', range:140, detectRatio:0.30, fireCd:1.2,  dmg:35, bulletSpeed:230, aoe:40, slow:0 },
    frost: { name:'寒霜', color:'#006d77', range:110, detectRatio:0.70, fireCd:1.2,  dmg:8,  bulletSpeed:280, aoe:0, slow:0.40, slowDur:1.8 }
  };

  // 技能
  const SKILLS = {
    charge: { name:'冲锋', cost:18, cd:6,  apply: (m)=>{ m.buffs.charge = 2.0; m.buffs.chargeT = 2.0; flash(m, '#fff', 0.6);} },
    heal:   { name:'治疗', cost:22, cd:8,  apply: (m)=>{ let v = Math.floor(m.maxHp*0.35); healMonster(m, v); flash(m, '#66ff99', 0.5);} },
    summon: { name:'召唤', cost:30, cd:12, apply: (m)=>{ summonMinionsNear(m, 2); flash(m, '#ffd166', 0.5);} },
  };

  // 状态
  let state = {};
  function resetState(diffKey){
    const mapConf = MAP.difficulties[diffKey];
    state = {
      running: true,
      timeScale: 1,
      t: 0,
      difficulty: diffKey,
      gold: mapConf.goldStart,
      goldFloat: mapConf.goldStart,
      goldRegen: mapConf.goldRegen,
      energy: mapConf.energyMax * 0.5,
      energyMax: mapConf.energyMax,
      energyRegen: mapConf.energyRegen,
      coreHP: mapConf.coreHP,
      coreHPMax: mapConf.coreHP,
      monsters: [],
      bullets: [],
      towers: mapConf.towers.map(t => makeTower(t)),
      forkChoice: { F1:'up', F3:'down' }, // 默认上/下
      activeSkill: null,
      skillCd: { charge:0, heal:0, summon:0 },
      selectedMonsterId: null,
      unitCd: { goblin:0, brute:0, assassin:0 },
    };
    energyMaxText.textContent = state.energyMax;
    updateForkUI();
  }

  function makeTower(conf){
    const base = TOWERS[conf.type];
    return {
      id: uid(),
      type: conf.type,
      x: conf.x, y: conf.y,
      range: base.range,
      detect: base.range * base.detectRatio,
      fireCd: base.fireCd,
      cd: Math.random()*base.fireCd*0.5,
      dmg: base.dmg,
      bulletSpeed: base.bulletSpeed,
      aoe: base.aoe||0,
      slow: base.slow||0,
      slowDur: base.slowDur||0,
      color: base.color,
      targetId: null,
    }
  }

  // 工具
  let _uid=1; function uid(){return _uid++;}
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function dist(a,b,c,d){ const dx=a-c, dy=b-d; return Math.hypot(dx,dy); }
  function lerp(a,b,t){ return a+(b-a)*t; }

  // 路径
  const nodes = MAP.nodes;
  const forks = MAP.forks;

  // 坐标转换
  function resize(){
    const w = wrap.clientWidth;
    const h = Math.max(320, Math.min(720, Math.floor(w*0.56)));
    canvas.width = Math.floor(w);
    canvas.height = Math.floor(h);
    const sx = canvas.width / WORLD.w;
    const sy = canvas.height / WORLD.h;
    scale = Math.min(sx, sy);
    // 居中
    offsetX = (canvas.width - WORLD.w * scale)/2;
    offsetY = (canvas.height - WORLD.h * scale)/2;

    // 更新分叉按钮位置
    positionForkUI();
  }
  window.addEventListener('resize', resize);

  function toScreen(p){ return { x: Math.round(offsetX + p.x*scale), y: Math.round(offsetY + p.y*scale) }; }
  function toWorld(x,y){ return { x: (x - offsetX)/scale, y: (y - offsetY)/scale }; }

  // 分叉 UI
  function updateForkUI(){
    // 设置高亮
    document.querySelectorAll('.fork-btn').forEach(btn=>{
      const f = btn.dataset.fork;
      const dir = btn.dataset.dir;
      btn.classList.toggle('active', state.forkChoice[f]===dir);
    });
  }
  function positionForkUI(){
    // F1, F3
    [ ['F1',forkF1], ['F3',forkF3] ].forEach(([id,el])=>{
      const p = toScreen(nodes[id]);
      el.style.left = p.x+'px';
      el.style.top = (p.y-26)+'px';
    });
  }

  // 怪物
  function spawnUnit(typeKey, near=null){
    const t = UNITS[typeKey];
    if(!near){
      if(state.gold < t.cost) return false;
      if(state.unitCd[typeKey] > 0) return false;
      state.gold -= t.cost;
      state.goldFloat = state.gold;
      // 冷却
      state.unitCd[typeKey] = (typeKey==='goblin'?0.4 : typeKey==='assassin'?0.7 : 1.0);
    }
    const m = {
      id: uid(),
      type: typeKey,
      x: near? near.x : nodes.S.x,
      y: near? near.y : nodes.S.y,
      r: t.r,
      color: t.color,
      hp: t.hp, maxHp: t.hp,
      speed: t.speed,
      baseSpeed: t.speed,
      dmg: t.dmg,
      stealth: !!t.stealth,
      buffs: { charge:1.0, chargeT:0, slow:1.0, slowT:0 },
      selected: false,
      prev: 'S',
      next: nodes['S'].next,
      alive: true,
      reached: false
    };
    state.monsters.push(m);
    return true;
  }

  function getNextFrom(nodeId){
    const n = nodes[nodeId];
    if(!n) return null;
    if(n.edges){
      const dir = state.forkChoice[nodeId] || 'up';
      return n.edges[dir];
    }
    return n.next || null;
  }

  function arriveNode(monster, nodeId){
    monster.prev = nodeId;
    const next = getNextFrom(nodeId);
    monster.next = next;
  }

  // 技能效果
  function flash(m, color, dur){
    m.flash = { color, t: dur||0.4, full: dur||0.4 };
  }
  function healMonster(m, amount){
    m.hp = Math.min(m.maxHp, m.hp + amount);
  }
  function summonMinionsNear(m, count){
    for(let i=0;i<count;i++){
      const angle = Math.random()*Math.PI*2;
      const r = 12+Math.random()*14;
      const pos = { x: m.x + Math.cos(angle)*r, y: m.y + Math.sin(angle)*r };
      spawnUnit('minion', pos);
    }
  }

  // 射击子弹
  function makeBullet(tower, target){
    const t = TOWERS[tower.type];
    return {
      id: uid(),
      type: tower.type,
      x: tower.x, y: tower.y,
      speed: tower.bulletSpeed,
      dmg: tower.dmg,
      aoe: tower.aoe || 0,
      slow: tower.slow || 0,
      slowDur: tower.slowDur || 0,
      targetId: target.id,
      life: 4 // 最多飞4秒
    };
  }

  // 塔视野
  function canTarget(tower, m){
    const d = dist(tower.x, tower.y, m.x, m.y);
    if(d > tower.range) return false;
    if(!m.alive) return false;
    if(m.stealth){
      // 只有进入探测范围才可见
      return d <= tower.detect;
    }
    return true;
  }

  // 点击交互
  let pointer = { x:0, y:0, worldX:0, worldY:0, down:false };
  canvas.addEventListener('pointerdown', e=>{
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    const p = toWorld(pointer.x, pointer.y);
    pointer.worldX = p.x; pointer.worldY = p.y;
    pointer.down = true;

    // 如果选择了技能 -> 施放
    if(state.activeSkill){
      const skill = SKILLS[state.activeSkill];
      if(state.energy < skill.cost || state.skillCd[state.activeSkill] > 0){
        // 不足
      }else{
        const m = pickMonsterAt(pointer.worldX, pointer.worldY, 18);
        if(m){
          // 施放
          skill.apply(m);
          state.energy = Math.max(0, state.energy - skill.cost);
          state.skillCd[state.activeSkill] = skill.cd;
        }
      }
      return;
    }

    // 无技能：选择怪物
    const m = pickMonsterAt(pointer.worldX, pointer.worldY, 18);
    setSelected(m ? m.id : null);
  });
  canvas.addEventListener('pointerup', ()=> pointer.down=false);

  function pickMonsterAt(wx, wy, radius){
    let best=null, bestD=999;
    for(const m of state.monsters){
      if(!m.alive) continue;
      const d = dist(wx, wy, m.x, m.y);
      if(d <= (radius/scale + m.r) && d < bestD){
        best = m; bestD = d;
      }
    }
    return best;
  }
  function setSelected(id){
    state.selectedMonsterId = id;
    state.monsters.forEach(m=> m.selected = (m.id===id));
  }

  // 分叉按钮
  document.querySelectorAll('.fork-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(!state.running) return;
      const fork = btn.dataset.fork;
      const dir = btn.dataset.dir;
      state.forkChoice[fork] = dir;
      updateForkUI();
    });
  });

  // 出兵按钮
  unitButtons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(!state.running) return;
      const type = btn.dataset.type;
      spawnUnit(type);
    });
  });

  // 技能按钮
  skillButtons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const skill = btn.dataset.skill;
      if(state.activeSkill === skill){
        state.activeSkill = null;
      }else{
        state.activeSkill = skill;
      }
      refreshSkillBtnUI();
    });
  });
  function refreshSkillBtnUI(){
    skillButtons.forEach(btn=>{
      btn.classList.toggle('selected-skill', state.activeSkill===btn.dataset.skill);
    });
  }

  // 顶部按钮
  startBtn.addEventListener('click', ()=>{
    resetState(difficultySel.value);
  });
  helpBtn.addEventListener('click', ()=>{
    showOverlay('帮助', 
      '你是进攻方！花金币出兵（哥布林/巨兽/刺客），并在分叉处切换上/下路线。消耗能量释放技能（冲锋/治疗/召唤），能量会自动恢复。刺客具隐身能力，只有在较短探测范围内才会被塔锁定。目标：让足够多的怪物成功到达右侧核心并将其摧毁！'
    );
  });
  speedBtn.addEventListener('click', ()=>{
    state.timeScale = (state.timeScale===1? 1.5 : state.timeScale===1.5? 2 : 1);
    speedBtn.textContent = '速度×'+state.timeScale;
  });

  overlayRestart.addEventListener('click', ()=>{
    overlay.classList.remove('show');
    resetState(difficultySel.value);
  });

  function showOverlay(title, msg){
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    overlay.classList.add('show');
  }

  // 更新循环
  let last = performance.now();
  function loop(now){
    const dtReal = Math.min(0.05, (now - last)/1000);
    last = now;
    const dt = dtReal * (state.timeScale||1);

    if(state.running){
      state.t += dt;

      // 资源再生
      state.energy = clamp(state.energy + state.energyRegen*dt, 0, state.energyMax);
      state.goldFloat += state.goldRegen*dt;
      const newGold = Math.floor(state.goldFloat);
      if(newGold !== state.gold){
        state.gold = newGold;
      }

      // 冷却
      Object.keys(state.unitCd).forEach(k=> state.unitCd[k] = Math.max(0, state.unitCd[k]-dt));
      Object.keys(state.skillCd).forEach(k=> state.skillCd[k] = Math.max(0, state.skillCd[k]-dt));
      updateCooldownBars();

      // 怪物更新
      for(const m of state.monsters){
        if(!m.alive) continue;
        // buff/slow
        if(m.buffs.chargeT>0){
          m.buffs.chargeT -= dt;
          if(m.buffs.chargeT<=0){ m.buffs.chargeT=0; m.buffs.charge=1.0; }
        }
        if(m.buffs.slowT>0){
          m.buffs.slowT -= dt;
          if(m.buffs.slowT<=0){ m.buffs.slowT=0; m.buffs.slow=1.0; }
        }
        // 移动
        if(m.next){
          const n = nodes[m.next];
          const dx = n.x - m.x, dy = n.y - m.y;
          const d = Math.hypot(dx,dy);
          let spd = m.baseSpeed * m.buffs.charge * m.buffs.slow;
          const mv = spd * dt;
          if(d <= mv){
            // 到点
            m.x = n.x; m.y = n.y;
            if(n.id === 'CORE'){
              // 击中核心
              hitCore(m);
              m.alive = false;
              m.reached = true;
              continue;
            }
            arriveNode(m, n.id);
          }else{
            m.x += dx/d * mv;
            m.y += dy/d * mv;
          }
        }
        // 闪光
        if(m.flash){
          m.flash.t -= dt;
          if(m.flash.t<=0) m.flash=null;
        }
      }

      // 塔更新
      for(const t of state.towers){
        t.cd -= dt;
        // 锁定或寻找目标
        let target = null;
        if(t.targetId){
          target = state.monsters.find(m=>m.id===t.targetId && m.alive && canTarget(t,m));
        }
        if(!target){
          t.targetId = null;
          let best=null, bestD=1e9;
          for(const m of state.monsters){
            if(!m.alive) continue;
            if(!canTarget(t,m)) continue;
            const d = dist(t.x,t.y,m.x,m.y);
            if(d<bestD){ best=m; bestD=d; }
          }
          target = best;
          if(target) t.targetId = target.id;
        }
        // 开火
        if(target && t.cd<=0){
          state.bullets.push( makeBullet(t, target) );
          t.cd = TOWERS[t.type].fireCd;
        }
      }

      // 子弹更新
      for(const b of state.bullets){
        if(b.life<=0) continue;
        b.life -= dt;
        let target = state.monsters.find(m=>m.id===b.targetId && m.alive);
        let tx,ty;
        if(target){
          tx=target.x; ty=target.y;
        }else{
          // 没目标就直线飞（这里简单处理：停滞）
          b.life = 0;
          continue;
        }
        const dx = tx - b.x, dy = ty - b.y;
        const d = Math.hypot(dx,dy);
        const mv = b.speed * dt;
        if(d <= mv+2){
          // 命中
          if(b.aoe>0){
            for(const m of state.monsters){
              if(!m.alive) continue;
              const dd = dist(b.x,b.y,m.x,m.y);
              if(dd <= b.aoe){
                damageMonster(m, b.dmg);
              }
            }
          }else{
            damageMonster(target, b.dmg);
            if(b.slow>0 && target.alive){
              target.buffs.slow = Math.min(target.buffs.slow, 1-b.slow);
              target.buffs.slowT = Math.max(target.buffs.slowT, b.slowDur);
            }
          }
          b.life = 0;
        }else{
          b.x += dx/d * mv;
          b.y += dy/d * mv;
        }
      }

      // 清理
      state.monsters = state.monsters.filter(m=> m.alive);
      state.bullets = state.bullets.filter(b=> b.life>0);

      // UI
      goldText.textContent = state.gold;
      energyText.textContent = Math.floor(state.energy);
      coreText.textContent = state.coreHP;

      // 结束
      if(state.coreHP <= 0){
        state.running = false;
        showOverlay('胜利！', '你摧毁了敌方核心！');
      }
    }

    // 绘制
    draw();
    requestAnimationFrame(loop);
  }

  function hitCore(m){
    state.coreHP = Math.max(0, state.coreHP - m.dmg);
    // 击中核心奖励少量金币
    state.goldFloat += 5;
  }

  function damageMonster(m, dmg){
    // 隐身不减伤，只是更难被锁定
    m.hp -= dmg;
    if(m.hp<=0){
      m.alive = false;
      m.selected = false;
      if(state.selectedMonsterId === m.id) state.selectedMonsterId = null;
    }
  }

  // 冷却条
  function updateCooldownBars(){
    // 单位
    unitButtons.forEach(btn=>{
      const type = btn.dataset.type;
      const cd = clamp(state.unitCd[type],0,1.5);
      const bar = btn.querySelector('.cooldown-bar');
      const ratio = (type==='goblin'?0.4: type==='assassin'?0.7:1.0);
      const p = clamp(cd/ratio, 0, 1);
      bar.style.height = (p*100)+'%';
      btn.classList.toggle('disabled', state.gold < UNITS[type].cost || state.unitCd[type]>0);
    });
    // 技能
    skillButtons.forEach(btn=>{
      const skill = btn.dataset.skill;
      const cd = state.skillCd[skill];
      const bar = btn.querySelector('.cooldown-bar');
      const p = clamp(cd / SKILLS[skill].cd, 0, 1);
      bar.style.height = (p*100)+'%';
      btn.classList.toggle('disabled', state.energy < SKILLS[skill].cost || state.skillCd[skill]>0);
    });
  }

  // 绘制
  function draw(){
    // 背景
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 地面
    ctx.fillStyle = '#d6e0e7';
    ctx.fillRect(0,0,WORLD.w,WORLD.h);

    // 路面
    drawPath();

    // 核心
    drawCore();

    // 塔
    for(const t of state.towers){
      drawTower(t);
    }

    // 子弹
    for(const b of state.bullets){
      drawBullet(b);
    }

    // 怪物
    for(const m of state.monsters){
      drawMonster(m);
    }

    ctx.restore();
  }

  function drawPath(){
    // 阴影
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.lineWidth = 18;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    for(const [a,b] of MAP.edges){
      const na = nodes[a], nb = nodes[b];
      ctx.beginPath();
      ctx.moveTo(na.x+2,na.y+2);
      ctx.lineTo(nb.x+2,nb.y+2);
      ctx.stroke();
    }
    // 路面
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#b8c2c9';
    for(const [a,b] of MAP.edges){
      const na = nodes[a], nb = nodes[b];
      ctx.beginPath();
      ctx.moveTo(na.x,na.y);
      ctx.lineTo(nb.x,nb.y);
      ctx.stroke();
    }
    // 分叉节点点缀
    for(const f of forks){
      const n = nodes[f];
      ctx.beginPath();
      ctx.fillStyle='#e8edf2';
      ctx.arc(n.x, n.y, 10, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle='#9aa9b5';
      ctx.lineWidth=2;
      ctx.stroke();
    }
  }

  function drawCore(){
    const n = nodes.CORE;
    // 背板
    ctx.fillStyle = '#ffe8e8';
    ctx.beginPath();
    ctx.arc(n.x, n.y, 18, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#cc6666';
    ctx.lineWidth=3; ctx.stroke();
    // 宝石
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.moveTo(n.x, n.y-12);
    ctx.lineTo(n.x+10, n.y);
    ctx.lineTo(n.x, n.y+12);
    ctx.lineTo(n.x-10, n.y);
    ctx.closePath(); ctx.fill();
    // 血条
    const w = 80, h = 8;
    const x = n.x - w/2, y = n.y - 30;
    const p = clamp(state.coreHP/state.coreHPMax, 0, 1);
    ctx.fillStyle = '#222'; ctx.fillRect(x-1,y-1,w+2,h+2);
    ctx.fillStyle = '#550000'; ctx.fillRect(x,y,w,h);
    ctx.fillStyle = '#ff5555'; ctx.fillRect(x,y, w*p, h);
    ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(x-1,y-1,w+2,h+2);
  }

  function drawTower(t){
    // 范围阴影略，只画塔体
    ctx.save();
    ctx.translate(t.x,t.y);
    // 底座
    ctx.fillStyle='#6e6e6e';
    ctx.fillRect(-10, -6, 20, 12);
    // 塔身
    ctx.fillStyle=t.color;
    ctx.fillRect(-6, -16, 12, 20);
    // 炮口/箭口
    ctx.fillStyle='#222';
    ctx.fillRect(-3, -22, 6, 6);
    ctx.restore();
  }

  function drawMonster(m){
    // 影子
    ctx.fillStyle='rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(m.x, m.y+4, m.r*0.9, m.r*0.5, 0, 0, Math.PI*2); ctx.fill();

    // 边框颜色（选中）
    ctx.lineWidth = 2;
    ctx.strokeStyle = m.selected ? '#ffd43b' : '#000';

    // 身体（隐身半透明）
    ctx.beginPath();
    ctx.fillStyle = m.color;
    if(m.stealth) ctx.globalAlpha = 0.6;
    ctx.arc(m.x, m.y, m.r, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.stroke();

    // 冲锋闪光
    if(m.flash){
      const a = Math.max(0, m.flash.t / m.flash.full);
      ctx.beginPath();
      ctx.strokeStyle = m.flash.color;
      ctx.globalAlpha = a*0.8;
      ctx.arc(m.x, m.y, m.r+4, 0, Math.PI*2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // 血条
    const w= Math.max(24, m.r*2+8), h=5;
    const x = m.x - w/2, y = m.y - m.r - 12;
    const p = clamp(m.hp/m.maxHp, 0, 1);
    ctx.fillStyle='#222'; ctx.fillRect(x-1,y-1,w+2,h+2);
    ctx.fillStyle='#003300'; ctx.fillRect(x,y,w,h);
    ctx.fillStyle='#66dd66'; ctx.fillRect(x,y,w*p,h);
    ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(x-1,y-1,w+2,h+2);

    // 状态图标（减速/加速/隐身）
    let iconX = x;
    if(m.buffs.slow<1.0){
      drawStatusIcon(iconX, y-10, '#00c2ff'); iconX += 12;
    }
    if(m.buffs.charge>1.0){
      drawStatusIcon(iconX, y-10, '#ffcc00'); iconX += 12;
    }
    if(m.stealth){
      drawStatusIcon(iconX, y-10, '#444'); iconX += 12;
    }
  }

  function drawStatusIcon(x,y,color){
    ctx.fillStyle=color; ctx.beginPath(); ctx.arc(x+6,y+6,4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#000'; ctx.strokeRect(x+1,y+1,10,10);
  }

  function drawBullet(b){
    ctx.save();
    ctx.translate(b.x,b.y);
    if(b.type==='cannon'){
      ctx.fillStyle = '#553300';
      ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
    }else if(b.type==='frost'){
      ctx.fillStyle = '#66d9ff';
      ctx.fillRect(-3,-3,6,6);
    }else{
      ctx.fillStyle = '#333';
      ctx.fillRect(-2,-5,4,10);
    }
    ctx.restore();
  }

  // 初始化
  resize();
  resetState(difficultySel.value);
  requestAnimationFrame(loop);

  // 防止滚动影响
  document.addEventListener('gesturestart', e=> e.preventDefault());
  document.addEventListener('touchmove', function(e){
    if(e.target.closest('#game')) e.preventDefault();
  }, {passive:false});

})();