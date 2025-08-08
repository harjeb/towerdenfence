// =================================================
// --- FINAL INTEGRATED ARCHITECTURE PSEUDOCODE ---
// =================================================
// This file represents the unified game logic, integrating all systems
// from Phases 1, 2, and 3. It serves as the master blueprint for implementation.

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
    DAMAGE_MODIFIERS: {
        [this.DAMAGE_TYPES.PHYSICAL]: { [this.ARMOR_TYPES.HEAVY]: 1.0, /*...*/ },
        [this.DAMAGE_TYPES.EXPLOSIVE]: { [this.ARMOR_TYPES.LIGHT]: 1.5, /*...*/ },
        [this.DAMAGE_TYPES.ENERGY]: { [this.ARMOR_TYPES.SHIELDED]: 1.75, /*...*/ }
    },
    UNIT_TYPES: {
        stoneman: {
            name: "Stoneman", role: this.ROLES.TANK, tags: [this.TAGS.GROUND, this.TAGS.ARMORED], armorType: this.ARMOR_TYPES.HEAVY, productionTime: 10,
            attack: { damage: 20, damageType: this.DAMAGE_TYPES.PHYSICAL, range: 1, attackSpeed: 1.5 },
            upgradeTree: [ { hp: 250, speed: 0.8, cost: 200 }, /*...*/ ]
        },
        archer: { /*...*/ }
    },
    TOWER_TYPES: {
        arrow_tower: {
            name: "Arrow Tower", armorType: this.ARMOR_TYPES.STRUCTURE, hp: 500,
            attack: { damage: 15, damageType: this.DAMAGE_TYPES.PHYSICAL, range: 6, attackSpeed: 1.0, canTarget: [this.TAGS.GROUND, this.TAGS.FLYING] }
        },
        cannon_tower: { /*...*/ }
    },
    TACTICAL_SKILLS: {
        SKL_HEAL_AURA: {
            skillId: "SKL_HEAL_AURA", name: "治疗光环", cost: 200, cooldown: 45, targetingType: "area",
            effects: [ { type: "HEAL_OVER_TIME", amountPerSecond: 20, duration: 10, radius: 150 } ]
        },
        SKL_EMP: { /*...*/ }
    },
    TECH_TREE_DATA: {
        unlock_sapper: {
            id: "unlock_sapper", type: "UNLOCK_UNIT", name: "Unlock Sapper", cost: 5, dependencies: [],
            payload: { unitId: "sapper" }
        },
        global_hp_boost_1: { /*...*/ }
    },
    LEVEL_DATA: [
        {
            levelId: 1, timeLimit: 180,
            mapLayout: { /*...*/ },
            enemySetup: [ { type: "ARROW_TOWER", position: { x: 300, y: 100 } } ]
        }
    ]
};

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
    unitLevels: {}, // In-game upgrades: { stoneman: 0, archer: 1, ... }
    productionQueue: [], // { unitType: 'stoneman', timeLeft: 3.5, ... }
    skillCooldowns: {}, // { SKL_HEAL_AURA: 167... , ... }
    activeEffects: [], // Active skill effects on the map
};

// =================================================
// --- II. METAGAME & PERSISTENCE ---
// =================================================

/**
 * Default structure for a new player's profile.
 */
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
  }
};

/**
 * Loads the player's profile from localStorage.
 * @returns {object} The player's profile.
 */
function loadPlayerProfile() {
    const savedProfile = localStorage.getItem('playerProfile');
    return savedProfile ? JSON.parse(savedProfile) : { ...defaultPlayerProfile };
}

/**
 * Saves the current player profile to localStorage.
 * @param {object} profile - The profile object to save.
 */
function savePlayerProfile(profile) {
    localStorage.setItem('playerProfile', JSON.stringify(profile));
    console.log("Player profile saved.");
}

/**
 * Applies permanent bonuses from the profile to a fresh copy of game constants.
 * This is the crucial link between the metagame and the core game.
 * @param {object} profile - The player's profile.
 * @returns {object} The modified, session-specific constants.
 */
function applyPlayerProfile(profile) {
    // Deep clone constants to avoid modifying the base data across sessions
    const sessionConstants = JSON.parse(JSON.stringify(FINAL_GAME_CONSTANTS));

    // 1. Apply global upgrades
    if (profile.permanentUpgrades.global.startingResources) {
        gameState.player.resources += profile.permanentUpgrades.global.startingResources;
    }

    // 2. Apply unit-specific upgrades
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
    
    // 3. Apply skill-specific upgrades
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

// =================================================
// --- III. GAME INITIALIZATION & FLOW ---
// =================================================

/**
 * Initializes the entire game.
 */
function initializeGame() {
    // 1. Load persistence data
    const playerProfile = loadPlayerProfile();

    // 2. Apply metagame upgrades to create session-specific constants
    gameState.sessionConstants = applyPlayerProfile(playerProfile);

    // 3. Initialize game state based on profile
    for (const unitType in gameState.sessionConstants.UNIT_TYPES) {
        if (playerProfile.unlockedUnits.includes(unitType)) {
            gameState.unitLevels[unitType] = 0;
        }
    }
    // UI should be built based on playerProfile.unlockedUnits and unlockedSkills

    // 4. Load the first level
    loadLevel(gameState.currentLevelId);

    // 5. Start the game loop
    console.log("Game Initialized. Starting loop.");
    requestAnimationFrame(gameLoop);
}

/**
 * Loads a specific level's data into the game state.
 * @param {number} levelId
 */
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

    // Load enemy towers
    level.enemySetup.forEach(towerData => {
        const towerProps = gameState.sessionConstants.TOWER_TYPES[towerData.type];
        gameState.player.towers.push({
            ...towerProps,
            id: `t_${Math.random()}`,
            position: towerData.position,
            currentHp: towerProps.hp
        });
    });

    console.log(`Level ${level.levelId} loaded.`);
}

/**
 * The main game loop, called each frame.
 * @param {number} currentTime - The current high-resolution timestamp.
 */
let lastTime = 0;
function gameLoop(currentTime) {
    if (gameState.isGameOver) {
        console.log("Game Over. Loop stopped.");
        return;
    }

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // --- UPDATE PHASE ---
    updateTimers(deltaTime);
    updateProductionQueue(deltaTime);
    updateActiveEffects(deltaTime);
    updateAI(deltaTime); // Unified AI updates for both units and towers

    // --- RENDER PHASE ---
    renderGame();

    // --- END CONDITION CHECK ---
    checkEndConditions();

    requestAnimationFrame(gameLoop);
}

/**
 * Handles game over procedures.
 * @param {string} reason - The reason for the game ending.
 */
function gameOver(reason) {
    gameState.isGameOver = true;
    console.log(`Game Over! Reason: ${reason}`);

    // Post-game progression
    const playerProfile = loadPlayerProfile();
    const rewards = calculateEndGameRewards({ success: false });
    updatePlayerProfileWithRewards(playerProfile, rewards);
    savePlayerProfile(playerProfile);
}

/**
 * Handles level completion procedures.
 */
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
    // Logic from previous pseudocode for HEAL_OVER_TIME, etc.
}

/**
 * Unified AI update for all actors.
 * @param {number} deltaTime
 */
function updateAI(deltaTime) {
    // Tower AI
    gameState.player.towers.forEach(tower => {
        const target = findTargetFor(tower, gameState.player.units);
        if (target) {
            // ... attack cooldown logic ...
            const damage = calculateDamage(tower.attack, target.armorType);
            target.currentHp -= damage;
        }
    });

    // Unit AI
    gameState.player.units.forEach(unit => {
        // 1. Move unit along path
        // ... move logic ...
        
        // 2. Find target and attack
        const target = findTargetFor(unit, gameState.player.towers);
        if (target) {
            // ... attack cooldown logic ...
            const damage = calculateDamage(unit.attack, target.armorType);
            target.currentHp -= damage;
        }
    });
}

function checkEndConditions() {
    if (gameState.levelTimeLeft <= 0) {
        gameOver('TIME_OUT');
    }
    // Assuming the goal is to destroy all towers
    if (gameState.player.towers.length > 0 && gameState.player.towers.every(t => t.currentHp <= 0)) {
        levelComplete();
    }
}

// =================================================
// --- V. ACTION & HELPER FUNCTIONS ---
// =================================================

/**
 * Handles a player's request to purchase a unit.
 * @param {string} unitType
 */
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

/**
 * Creates a unit instance on the map.
 * @param {string} unitType
 */
function spawnUnitOnMap(unitType) {
    const unitData = gameState.sessionConstants.UNIT_TYPES[unitType];
    const currentLevel = gameState.unitLevels[unitType];
    const stats = unitData.upgradeTree[currentLevel];

    const newUnit = {
        ...stats,
        id: `u_${Math.random()}`,
        type: unitType,
        level: currentLevel,
        currentHp: stats.hp,
        position: { x: 0, y: 0 } // Set to spawn point
    };
    gameState.player.units.push(newUnit);
    console.log(`${unitType} spawned at level ${currentLevel}.`);
}

/**
 * Calculates damage based on types and modifiers.
 * @param {object} attack - The attack object { damage, damageType }
 * @param {string} targetArmorType - The armor type of the target
 */
function calculateDamage(attack, targetArmorType) {
    const modifier = gameState.sessionConstants.DAMAGE_MODIFIERS[attack.damageType]?.[targetArmorType] ?? 1.0;
    return attack.damage * modifier;
}

/**
 * Finds a valid target for an attacker.
 * @param {object} attacker - The unit or tower that is attacking.
 * @param {Array} potentialTargets - The array of potential targets.
 */
function findTargetFor(attacker, potentialTargets) {
    // 1. Filter targets in range.
    // 2. Filter targets based on `attacker.attack.canTarget` tags.
    // 3. Select best target (e.g., closest).
    return potentialTargets.find(t => t.currentHp > 0); // Simplified for pseudocode
}

function renderGame() {
    // This function would contain all the rendering logic to draw the gameState.
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
        profile.techPoints++;
        console.log(`Level up! Reached level ${profile.level}.`);
    }
}

// =================================================
// --- VI. ENTRY POINT ---
// =================================================

initializeGame();