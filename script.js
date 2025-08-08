(function(){
    // =================================================
    // --- I. CORE DATA STRUCTURES ---
    // =================================================

    /**
     * A deep, cloneable object containing all static game data.
     * This object will be cloned and modified by playerProfile upgrades at the start of a game session.
     */
    const FINAL_GAME_CONSTANTS = {
        ROLES: {
            TANK: 'Tank', DPS: 'DPS', SUPPORT: 'Support'
        },
        TAGS: {
            GROUND: 'Ground', FLYING: 'Flying', ARMORED: 'Armored', BIOLOGICAL: 'Biological', MECHANICAL: 'Mechanical'
        },
        DAMAGE_TYPES: {
            PHYSICAL: 'Physical', EXPLOSIVE: 'Explosive', ENERGY: 'Energy'
        },
        ARMOR_TYPES: {
            LIGHT: 'Light', HEAVY: 'Heavy', SHIELDED: 'Shielded', UNARMORED: 'Unarmored', STRUCTURE: 'Structure'
        },
        DAMAGE_MODIFIERS: {}, // Will be populated below
        UNIT_TYPES: {}, // Will be populated below
        TOWER_TYPES: {}, // Will be populated below
        TACTICAL_SKILLS: {}, // Will be populated below
        TECH_TREE_DATA: {}, // Will be populated below
        LEVEL_DATA: [] // Will be populated below
    };

    // Populate dynamic parts of the constants
    const C = FINAL_GAME_CONSTANTS; // Shorthand
    C.DAMAGE_MODIFIERS = {
        [C.DAMAGE_TYPES.PHYSICAL]: { [C.ARMOR_TYPES.HEAVY]: 1.0, [C.ARMOR_TYPES.LIGHT]: 1.0, [C.ARMOR_TYPES.UNARMORED]: 1.0, [C.ARMOR_TYPES.STRUCTURE]: 0.75, [C.ARMOR_TYPES.SHIELDED]: 0.5 },
        [C.DAMAGE_TYPES.EXPLOSIVE]: { [C.ARMOR_TYPES.HEAVY]: 0.75, [C.ARMOR_TYPES.LIGHT]: 1.5, [C.ARMOR_TYPES.UNARMORED]: 1.0, [C.ARMOR_TYPES.STRUCTURE]: 1.25, [C.ARMOR_TYPES.SHIELDED]: 0.75 },
        [C.DAMAGE_TYPES.ENERGY]: { [C.ARMOR_TYPES.HEAVY]: 0.5, [C.ARMOR_TYPES.LIGHT]: 0.75, [C.ARMOR_TYPES.UNARMORED]: 1.0, [C.ARMOR_TYPES.STRUCTURE]: 1.0, [C.ARMOR_TYPES.SHIELDED]: 2.0 }
    };

    C.UNIT_TYPES = {
        stoneman: {
            name: "石巨人", role: C.ROLES.TANK, tags: [C.TAGS.GROUND, C.TAGS.ARMORED, C.TAGS.BIOLOGICAL], armorType: C.ARMOR_TYPES.HEAVY, productionTime: 10,
            attack: { damage: 20, damageType: C.DAMAGE_TYPES.PHYSICAL, range: 1, attackSpeed: 1.5 },
            upgradeTree: [
                { hp: 250, speed: 0.8, cost: 200 },
                { hp: 350, speed: 0.8, cost: 300 },
                { hp: 480, speed: 0.8, cost: 0 }
            ],
            color: '#7f5539', r: 12
        },
        archer: {
            name: "弓箭手", role: C.ROLES.DPS, tags: [C.TAGS.GROUND, C.TAGS.BIOLOGICAL], armorType: C.ARMOR_TYPES.LIGHT, productionTime: 7,
            attack: { damage: 15, damageType: C.DAMAGE_TYPES.PHYSICAL, range: 5, attackSpeed: 1.0 },
             upgradeTree: [
                { hp: 80, speed: 1.1, cost: 150 },
                { hp: 110, speed: 1.1, cost: 250 },
                { hp: 150, speed: 1.2, cost: 0 }
            ],
            color: '#2b8a3e', r: 8
        }
    };

    C.TOWER_TYPES = {
        arrow_tower: {
            name: "箭塔", armorType: C.ARMOR_TYPES.STRUCTURE, hp: 500,
            attack: { damage: 15, damageType: C.DAMAGE_TYPES.PHYSICAL, range: 6, attackSpeed: 1.0, canTarget: [C.TAGS.GROUND, C.TAGS.FLYING] }
        },
        cannon_tower: {
            name: "炮塔", armorType: C.ARMOR_TYPES.STRUCTURE, hp: 800,
            attack: { damage: 40, damageType: C.DAMAGE_TYPES.EXPLOSIVE, range: 5, attackSpeed: 2.0, canTarget: [C.TAGS.GROUND] }
        }
    };

    C.TACTICAL_SKILLS = {
        SKL_HEAL_AURA: {
            skillId: "SKL_HEAL_AURA", name: "治疗光环", cost: 200, cooldown: 45, targetingType: "area",
            effects: [ { type: "HEAL_OVER_TIME", amountPerSecond: 20, duration: 10, radius: 150 } ]
        },
        SKL_EMP: {
            skillId: "SKL_EMP", name: "EMP", cost: 150, cooldown: 60, targetingType: "area",
            effects: [
                { type: "DISABLE_ATTACK", duration: 8, radius: 120 },
                { type: "DAMAGE_SHIELD", amount: 300, radius: 120 }
            ]
        }
    };

    C.TECH_TREE_DATA = {
        unlock_sapper: {
            id: "unlock_sapper", type: "UNLOCK_UNIT", name: "解锁工兵", cost: 5, dependencies: [],
            payload: { unitId: "sapper" }
        },
        global_hp_boost_1: {
            id: "global_hp_boost_1", type: "PERMANENT_UPGRADE", name: "全局HP+5%", cost: 3, dependencies: [],
            payload: { target: "units", filter: "all", stat: "hp", value: 0.05, type: "percent" }
        }
    };

    C.LEVEL_DATA = [
        {
            levelId: 1, timeLimit: 180,
            mapLayout: { /* ... */ },
            enemySetup: [ { type: "arrow_tower", position: { x: 300, y: 100 } } ]
        }
    ];


    /**
     * The central, dynamic state of the game.
     */
    const gameState = {
        player: {
            resources: 100,
            units: [],
            towers: [] // Enemy towers
        },
        map: {
            interactables: [],
            pathfindingGrid: [],
        },
        sessionConstants: {}, // Holds the modified, session-specific constants after profile upgrades
        gameTime: 0,
        currentLevelId: 1,
        levelTimeLeft: 0,
        isGameOver: false,
        running: false,
        timeScale: 1,
        unitLevels: {}, // In-game upgrades: { stoneman: 0, archer: 1, ... }
        productionQueue: [], // { unitType: 'stoneman', timeLeft: 3.5, ... }
        skillCooldowns: {}, // { SKL_HEAL_AURA: 167... , ... }
        activeEffects: [], // Active skill effects on the map
        forkChoice: { F1: 'up', F3: 'down' }, // Temporary
        activeSkill: null,
    };

    // --- Canvas & UI Refs ---
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    let scale = 1, offsetX = 0, offsetY = 0;
    
    // UI refs
    const goldText = document.getElementById('goldText');
    const energyText = document.getElementById('energyText');
    const coreText = document.getElementById('coreText');
    const timerText = document.getElementById('timerText');
    const startBtn = document.getElementById('startBtn');
    const unitButtons = Array.from(document.querySelectorAll('.unit-btn'));
    const skillButtons = Array.from(document.querySelectorAll('.skill-btn'));

    function resize(){
        const wrap = document.getElementById('canvasWrap');
        const w = wrap.clientWidth;
        const h = Math.max(320, Math.min(720, Math.floor(w*0.56)));
        canvas.width = Math.floor(w);
        canvas.height = Math.floor(h);
        const sx = canvas.width / 1000;
        const sy = canvas.height / 560;
        scale = Math.min(sx, sy);
        offsetX = (canvas.width - 1000 * scale)/2;
        offsetY = (canvas.height - 560 * scale)/2;
    }
    window.addEventListener('resize', resize);

    function toScreen(p){ return { x: Math.round(offsetX + p.x*scale), y: Math.round(offsetY + p.y*scale) }; }
    function toWorld(x,y){ return { x: (x - offsetX)/scale, y: (y - offsetY)/scale }; }

    const MAP_NODES = {
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
    };

    function getNextFrom(nodeId){
        const n = MAP_NODES[nodeId];
        if(!n) return null;
        if(n.edges){
          const dir = gameState.forkChoice[nodeId] || 'up';
          return n.edges[dir];
        }
        return n.next || null;
    }

    function arriveNode(unit, nodeId){
        unit.prev = nodeId;
        const next = getNextFrom(nodeId);
        unit.next = next;
        if (!next) {
            // Reached the core
            console.log(`${unit.name} reached the core.`);
            // Logic to damage core can be handled elsewhere
        }
    }

    // =================================================
    // --- II. METAGAME & PERSISTENCE ---
    // =================================================

    const defaultPlayerProfile = {
      profileId: "player123",
      playerName: "Arch-Strategist",
      xp: 0,
      level: 1,
      techPoints: 0,
      unlockedUnits: ["stoneman", "archer"],
      unlockedSkills: [],
      permanentUpgrades: {
        units: { "stoneman": { hp: 50 } },
        skills: {},
        global: { "startingResources": 100 }
      },
      unlockedTechs: []
    };

    function loadPlayerProfile() {
        const savedProfile = localStorage.getItem('playerProfile');
        return savedProfile ? JSON.parse(savedProfile) : JSON.parse(JSON.stringify(defaultPlayerProfile));
    }

    function savePlayerProfile(profile) {
        localStorage.setItem('playerProfile', JSON.stringify(profile));
        console.log("Player profile saved.");
    }

    function applyPlayerProfile(profile) {
        const sessionConstants = JSON.parse(JSON.stringify(FINAL_GAME_CONSTANTS));

        if (profile.permanentUpgrades.global.startingResources) {
            gameState.player.resources += profile.permanentUpgrades.global.startingResources;
        }

        for (const unitId in profile.permanentUpgrades.units) {
            if (sessionConstants.UNIT_TYPES[unitId]) {
                const upgrades = profile.permanentUpgrades.units[unitId];
                sessionConstants.UNIT_TYPES[unitId].upgradeTree.forEach(level => {
                    for (const stat in upgrades) {
                        if (level[stat] !== undefined) level[stat] += upgrades[stat];
                    }
                });
            }
        }
        
        for (const skillId in profile.permanentUpgrades.skills) {
            if (sessionConstants.TACTICAL_SKILLS[skillId]) {
                const upgrades = profile.permanentUpgrades.skills[skillId];
                 for (const stat in upgrades) {
                    if (sessionConstants.TACTICAL_SKILLS[skillId][stat] !== undefined) {
                        sessionConstants.TACTICAL_SKILLS[skillId][stat] += upgrades[stat];
                    }
                }
            }
        }

        console.log("Player profile bonuses applied to session constants.");
        return sessionConstants;
    }

    function purchaseTech(profile, techId) {
        const techData = FINAL_GAME_CONSTANTS.TECH_TREE_DATA[techId];
        if (!techData) {
            console.error(`Tech ${techId} not found.`);
            return false;
        }
        if (profile.techPoints < techData.cost) {
            console.log("Not enough tech points.");
            return false;
        }
        // Check dependencies
        for (const depId of techData.dependencies) {
            if (!profile.unlockedTechs.includes(depId)) {
                console.log(`Missing dependency: ${depId}`);
                return false;
            }
        }

        profile.techPoints -= techData.cost;
        profile.unlockedTechs.push(techId);

        // Apply the payload immediately to the profile
        const payload = techData.payload;
        if (techData.type === 'UNLOCK_UNIT') {
            if (!profile.unlockedUnits.includes(payload.unitId)) {
                profile.unlockedUnits.push(payload.unitId);
            }
        } else if (techData.type === 'PERMANENT_UPGRADE') {
            // This part gets complex and requires a robust way to merge upgrades
            // For now, we assume a simple structure.
            if (!profile.permanentUpgrades[payload.target]) {
                profile.permanentUpgrades[payload.target] = {};
            }
            // ... logic to apply payload ...
        }

        savePlayerProfile(profile);
        console.log(`Tech ${techId} purchased.`);
        return true;
    }


    // =================================================
    // --- III. GAME INITIALIZATION & FLOW ---
    // =================================================

    function initializeGame() {
        resize();
        const playerProfile = loadPlayerProfile();
        gameState.sessionConstants = applyPlayerProfile(playerProfile);

        for (const unitType in gameState.sessionConstants.UNIT_TYPES) {
            if (playerProfile.unlockedUnits.includes(unitType)) {
                gameState.unitLevels[unitType] = 0;
            }
        }
        
        loadLevel(gameState.currentLevelId);

        console.log("Game Initialized. Starting loop.");
        gameState.running = true;
        requestAnimationFrame(gameLoop);
    }

    function loadLevel(levelId) {
        const level = gameState.sessionConstants.LEVEL_DATA.find(l => l.levelId === levelId);
        if (!level) {
            gameOver('ALL_LEVELS_COMPLETE');
            return;
        }

        // Reset state for new level
        gameState.player.units = [];
        gameState.player.towers = [];
        gameState.productionQueue = [];
        gameState.activeEffects = [];
        gameState.levelTimeLeft = level.timeLimit;
        gameState.isGameOver = false;

        level.enemySetup.forEach(towerData => {
            const towerProps = gameState.sessionConstants.TOWER_TYPES[towerData.type];
            gameState.player.towers.push({
                ...towerProps,
                id: `t_${Math.random()}`,
                position: towerData.position,
                currentHp: towerProps.hp,
                attackCd: Math.random() * towerProps.attack.attackSpeed, // Initial random cooldown
                effects: {}
            });
        });

        console.log(`Level ${level.levelId} loaded.`);
    }

    let lastTime = 0;
    function gameLoop(currentTime) {
        if (gameState.isGameOver || !gameState.running) {
            console.log("Game Over or Paused. Loop stopped.");
            return;
        }

        if (!lastTime) lastTime = currentTime;
        const deltaTime = (currentTime - lastTime) / 1000 * gameState.timeScale;
        lastTime = currentTime;

        updateTimers(deltaTime);
        updateProductionQueue(deltaTime);
        updateActiveEffects(deltaTime);
        updateAI(deltaTime);
        renderGame();
        updateUI();
        checkEndConditions();

        requestAnimationFrame(gameLoop);
    }

    function gameOver(reason) {
        gameState.isGameOver = true;
        gameState.running = false;
        console.log(`Game Over! Reason: ${reason}`);

        const playerProfile = loadPlayerProfile();
        const rewards = calculateEndGameRewards({ success: false });
        updatePlayerProfileWithRewards(playerProfile, rewards);
        savePlayerProfile(playerProfile);
    }

    function levelComplete() {
        console.log(`Level ${gameState.currentLevelId} Complete!`);
        
        const playerProfile = loadPlayerProfile();
        const rewards = calculateEndGameRewards({ success: true });
        updatePlayerProfileWithRewards(playerProfile, rewards);
        savePlayerProfile(playerProfile);

        gameState.currentLevelId++;
        loadLevel(gameState.currentLevelId);
    }


    // =================================================
    // --- IV. CORE GAMEPLAY LOGIC ---
    // =================================================

    function updateTimers(deltaTime) {
        gameState.gameTime += deltaTime;
        gameState.levelTimeLeft -= deltaTime;
    }

    function updateProductionQueue(deltaTime) {
        for (let i = gameState.productionQueue.length - 1; i >= 0; i--) {
            const item = gameState.productionQueue[i];
            item.timeLeft -= deltaTime;
            if (item.timeLeft <= 0) {
                spawnUnitOnMap(item.unitType);
                gameState.productionQueue.splice(i, 1);
            }
        }
    }

    function updateActiveEffects(deltaTime) {
        for (let i = gameState.activeEffects.length - 1; i >= 0; i--) {
            const effect = gameState.activeEffects[i];
            effect.duration -= deltaTime;

            // Apply continuous effects
            if (effect.type === 'HEAL_OVER_TIME') {
                const affectedUnits = gameState.player.units.filter(u => dist(effect.position.x, effect.position.y, u.position.x, u.position.y) <= effect.radius);
                affectedUnits.forEach(u => {
                    u.currentHp = Math.min(u.hp, u.currentHp + effect.amountPerSecond * deltaTime);
                });
            }

            if (effect.duration <= 0) {
                // Cleanup expired effects
                if (effect.type === 'DISABLE_ATTACK') {
                    const affectedTowers = gameState.player.towers.filter(t => dist(effect.position.x, effect.position.y, t.position.x, t.position.y) <= effect.radius);
                    affectedTowers.forEach(t => {
                        delete t.effects.disabled;
                    });
                }
                gameState.activeEffects.splice(i, 1);
            }
        }
    }

    function updateAI(deltaTime) {
        // Tower AI
        gameState.player.towers.forEach(tower => {
            if(tower.attackCd > 0) tower.attackCd -= deltaTime;
            if (tower.attackCd > 0) return;

            const target = findTargetFor(tower, gameState.player.units);
            if (target) {
                const damage = calculateDamage(tower.attack, target.armorType);
                target.currentHp -= damage;
                console.log(`${tower.name} dealt ${damage} to ${target.type}. Target HP: ${target.currentHp}`);
                tower.attackCd = tower.attack.attackSpeed;
            }
        });

        // Unit AI
        gameState.player.units.forEach(unit => {
            // 1. Find target
            const target = findTargetFor(unit, gameState.player.towers);
            
            // 2. Move or Attack
            if (target) {
                // Target in range, stop and attack
                if(unit.attackCd > 0) unit.attackCd -= deltaTime;
                if (unit.attackCd <= 0) {
                    const damage = calculateDamage(unit.attack, target.armorType);
                    target.currentHp -= damage;
                    console.log(`${unit.name} dealt ${damage} to ${target.name}. Target HP: ${target.currentHp}`);
                    unit.attackCd = unit.attack.attackSpeed;
                }
            } else {
                // No target, move along path
                if (unit.next) {
                    const n = MAP_NODES[unit.next];
                    const dx = n.x - unit.position.x, dy = n.y - unit.position.y;
                    const d = Math.hypot(dx, dy);
                    const spd = unit.speed * 100; // Adjust speed scale
                    const mv = spd * deltaTime;
                    if (d <= mv) {
                        unit.position.x = n.x;
                        unit.position.y = n.y;
                        arriveNode(unit, n.id);
                    } else {
                        unit.position.x += dx / d * mv;
                        unit.position.y += dy / d * mv;
                    }
                }
            }
        });
    }

    function checkEndConditions() {
        if (gameState.levelTimeLeft <= 0) {
            gameOver('TIME_OUT');
        }
        if (gameState.player.towers.length > 0 && gameState.player.towers.every(t => t.currentHp <= 0)) {
            levelComplete();
        }
    }


    // =================================================
    // --- V. ACTION & HELPER FUNCTIONS ---
    // =================================================

    function purchaseUnit(unitType) {
        const unitData = gameState.sessionConstants.UNIT_TYPES[unitType];
        const currentLevel = gameState.unitLevels[unitType];
        const cost = unitData.upgradeTree[currentLevel].cost;

        if (gameState.player.resources >= cost) {
            gameState.player.resources -= cost;
            gameState.productionQueue.push({
                unitType: unitType,
                timeLeft: unitData.productionTime,
                totalTime: unitData.productionTime
            });
            console.log(`Purchased ${unitType}.`);
        }
    }

    function spawnUnitOnMap(unitType) {
        const unitData = gameState.sessionConstants.UNIT_TYPES[unitType];
        const currentLevel = gameState.unitLevels[unitType];
        const stats = unitData.upgradeTree[currentLevel];

        const newUnit = {
            ...stats,
            id: `u_${Math.random()}`,
            type: unitType,
            name: unitData.name,
            level: currentLevel,
            currentHp: stats.hp,
            position: { ...MAP_NODES.S }, // Start at S node
            prev: 'S',
            next: MAP_NODES['S'].next,
            color: unitData.color,
            r: unitData.r,
            tags: unitData.tags,
            armorType: unitData.armorType,
            attack: unitData.attack,
            attackCd: unitData.attack.attackSpeed, // Start with full cooldown
            buffs: {},
            effects: {}
        };
        gameState.player.units.push(newUnit);
        console.log(`${unitType} spawned at level ${currentLevel}.`);
    }

    function calculateDamage(attack, targetArmorType) {
        const modifier = gameState.sessionConstants.DAMAGE_MODIFIERS[attack.damageType]?.[targetArmorType] ?? 1.0;
        return attack.damage * modifier;
    }

    function dist(a,b,c,d){ const dx=a-c, dy=b-d; return Math.hypot(dx,dy); }

    function activateTacticalSkill(skillId, position) {
        const skillData = gameState.sessionConstants.TACTICAL_SKILLS[skillId];
        if (!skillData) return;

        const now = gameState.gameTime;
        if ((gameState.skillCooldowns[skillId] || 0) > now) {
            console.log(`${skillData.name} is on cooldown.`);
            return;
        }
        if (gameState.player.resources < skillData.cost) {
            console.log(`Not enough resources for ${skillData.name}.`);
            return;
        }

        gameState.player.resources -= skillData.cost;
        gameState.skillCooldowns[skillId] = now + skillData.cooldown;

        skillData.effects.forEach(effectInfo => {
            const effect = { ...effectInfo, position, startTime: now, endTime: now + effectInfo.duration };
            gameState.activeEffects.push(effect);

            // Apply instant effects
            if (effect.type === 'DISABLE_ATTACK') {
                 const affectedTowers = gameState.player.towers.filter(t => dist(position.x, position.y, t.position.x, t.position.y) <= effect.radius);
                 affectedTowers.forEach(t => {
                     t.effects.disabled = true;
                 });
            } else if (effect.type === 'DAMAGE_SHIELD') {
                // This would be handled in the damage calculation logic
            }
        });
        console.log(`Activated skill: ${skillData.name}`);
    }

    function findTargetFor(attacker, potentialTargets) {
        if (attacker.effects && attacker.effects.disabled) return null; // Cannot target if disabled

        let bestTarget = null;
        let minDistance = Infinity;

        // Attacker's position can be either {x, y} or {position: {x, y}}
        const attackerPos = attacker.position || attacker;

        for (const target of potentialTargets) {
            if (!target.currentHp || target.currentHp <= 0) continue;

            const targetPos = target.position || target;

            // 1. Check range
            const distance = dist(attackerPos.x, attackerPos.y, targetPos.x, targetPos.y);
            if (distance > attacker.attack.range) continue;

            // 2. Check tags if `canTarget` exists
            if (attacker.attack.canTarget) {
                const targetTags = target.tags || [];
                const canAttack = attacker.attack.canTarget.some(tag => targetTags.includes(tag));
                if (!canAttack) continue;
            }

            // 3. Select closest valid target
            if (distance < minDistance) {
                minDistance = distance;
                bestTarget = target;
            }
        }
        return bestTarget;
    }

    function updateUI() {
        goldText.textContent = Math.floor(gameState.player.resources);
        // Add other UI updates here, e.g., energy, timer, etc.
        timerText.textContent = new Date(gameState.levelTimeLeft * 1000).toISOString().substr(14, 5);
    }

    function renderGame() {
        // Background
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);

        // Ground
        ctx.fillStyle = '#d6e0e7';
        ctx.fillRect(0,0,1000,560);

        // Path
        drawPath();

        // Core
        drawCore();

        // Towers
        for(const t of gameState.player.towers){
          drawTower(t);
        }

        // Units
        for(const m of gameState.player.units){
          drawMonster(m);
        }

        ctx.restore();
    }

    function drawPath(){
        ctx.lineCap='round'; ctx.lineJoin='round';
        ctx.lineWidth = 16;
        ctx.strokeStyle = '#b8c2c9';
        // This needs to be adapted if map edges are defined in LEVEL_DATA
        // For now, we assume a static path for rendering
    }

    function drawCore(){
        const n = MAP_NODES.CORE;
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath();
        ctx.arc(n.x, n.y, 18, 0, Math.PI*2); ctx.fill();
    }

    function drawTower(t){
        ctx.save();
        ctx.translate(t.position.x, t.position.y);
        ctx.fillStyle='#6e6e6e';
        ctx.fillRect(-10, -6, 20, 12);
        ctx.fillStyle= t.color || '#2f4f4f';
        ctx.fillRect(-6, -16, 12, 20);
        ctx.restore();
    }

    function drawMonster(m){
        ctx.save();
        ctx.translate(m.position.x, m.position.y);
        
        // Body
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(0, 0, m.r, 0, Math.PI*2);
        ctx.fill();

        // Health bar
        const w = m.r * 2 + 8, h = 5;
        const x = -w/2, y = -m.r - 12;
        const p = Math.max(0, m.currentHp / m.hp);
        ctx.fillStyle='#222'; ctx.fillRect(x-1,y-1,w+2,h+2);
        ctx.fillStyle='#003300'; ctx.fillRect(x,y,w,h);
        ctx.fillStyle='#66dd66'; ctx.fillRect(x,y,w*p,h);
        
        ctx.restore();
    }

    function calculateEndGameRewards(result) {
        return result.success ? { xp: 500 } : { xp: 100 };
    }

    function updatePlayerProfileWithRewards(profile, rewards) {
        profile.xp += rewards.xp;
        
        const xpForNextLevel = profile.level * 1000;
        if (profile.xp >= xpForNextLevel) {
            profile.level++;
            profile.xp -= xpForNextLevel;
            profile.techPoints += 1; // Gain 1 tech point on level up
            console.log(`Level up! Reached level ${profile.level}.`);
        }
    }

    // =================================================
    // --- VI. ENTRY POINT ---
    // =================================================
    
    // --- Event Listeners ---
    startBtn.addEventListener('click', initializeGame);

    unitButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const unitType = btn.dataset.type;
            purchaseUnit(unitType);
        });
    });

    skillButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const skillId = btn.dataset.skill;
            // For skills that need targeting, we'd set a state here
            // For now, we assume area-targeting at a fixed point
            activateTacticalSkill(skillId, {x: 400, y: 280});
        });
    });

    // Initial setup and start
    initializeGame();

})();