# Decision Log

This file records architectural and implementation decisions using a list format.
2025-08-08 08:00:33 - Log of updates made.

*

---
### Decision
[2025-08-08 08:01:17] - 设计了“反转塔防”游戏中的两种核心地图互动元素：可破坏的捷径和关键增益点。

**Rationale:**
为了增加游戏的策略深度和可玩性，引入动态的地图元素是必要的。
- **可破坏的捷径** 允许玩家通过改变地形来创造战略优势，为进攻路线提供更多选择。
- **关键增益点** 鼓励玩家进行地图控制和资源争夺，而不仅仅是单一地推进单位。

**Implementation Details:**

**1. 可破坏的捷径 (Destructible Shortcut)**

*   **数据结构**:
    ```json
    {
      "id": "string",
      "type": "DESTRUCTIBLE_OBSTACLE",
      "position": { "x": "number", "y": "number" },
      "size": { "width": "number", "height": "number" },
      "maxHealth": "number",
      "currentHealth": "number",
      "isDestroyed": "boolean",
      "armor": "number"
    }
    ```
*   **互动逻辑**:
    -   **自动攻击**: 范围内的单位在无其他目标时会自动攻击障碍物。
    -   **玩家指令**: 玩家可以强制单位攻击特定障碍物。
    -   **摧毁效果**: 生命值降为0后，障碍物在视觉上被摧毁，并且其所占的地图网格将从“不可通行”变为“可通行”，触发所有单位的路径重算。

**2. 关键增益点 (Key Buff Point)**

*   **数据结构**:
    ```json
    {
      "id": "string",
      "type": "BUFF_POINT",
      "position": { "x": "number", "y": "number" },
      "captureRadius": "number",
      "captureTimeRequired": "number",
      "captureProgress": "number",
      "controllingPlayer": "string",
      "buff": {
        "type": "string",
        "value": "number",
        "range": "number"
      }
    }
    ```
*   **互动逻辑**:
    -   **占领过程**: 玩家单位进入范围后开始累加占领进度，占领速度与单位数量/权重相关。
    -   **占领完成**: 进度条满后，增益点归属该玩家，并激活增益效果。
    -   **增益类型**: 可设计为局部光环效果（如攻击速度提升）或全局效果（如资源增长）。
    -   **易手**: 敌方单位可以反向占领，将进度清零后再为己方累加。

---
### Decision (Code)
[2025-08-08 08:10:24] - 确定了可交互对象的具体实现方案。

**Rationale:**
在将架构转化为代码的过程中，需要根据现有代码库和游戏机制做出具体的技术选择，以确保功能能够平稳集成并表现良好。

**Details:**
1.  **渲染方式**:
    *   **决策**: 选择使用 HTML DOM 元素（置于一个单独的 `interactables-layer` div 中）来渲染可破坏的障碍物和增益点，而不是在 Canvas 上绘制。
    *   **理由**: DOM + CSS 更易于处理复杂的 UI 状态，如生命值/占领进度条的动画、元素的视觉变化（如被摧毁时的效果），并且可以与现有的 Canvas 渲染分离，简化了渲染逻辑。

2.  **增益效果的具体化**:
    *   **决策**: 将架构中定义的 `ATTACK_SPEED_AURA` 增益效果，在具体实现中调整为提升单位的 `movement speed`。
    *   **理由**: 当前 `script.js` 中的单位在到达终点前没有攻击行为，因此“攻击速度”增益无效。将其调整为“移动速度”增益，既能实现战略价值，也符合现有游戏机制。

3.  **塔的攻击优先级**:
    *   **决策**: 更新了塔的索敌 AI，使其优先攻击范围内的怪物。只有当没有怪物目标时，才会转而攻击可被摧毁的障碍物。
    *   **理由**: 这是标准的塔防游戏逻辑，确保防御单位首先处理最具威胁性的目标（进攻单位），使游戏玩法更直观、更具策略性。
---
### Decision
[2025-08-08 08:26:32] - 设计了关卡系统与“时间耗尽”失败条件。

**Rationale:**
为了提供结构化的游戏进程和明确的挑战目标，需要一个灵活的关卡系统。引入时间限制作为失败条件，可以增加游戏的紧迫感和策略性，促使玩家优化进攻效率。

**Implementation Details:**

**1. 关卡数据结构 (Level Data Structure)**

*   **设计**: 采用一个包含所有关卡数据的JSON对象数组。每个关卡对象定义了该关卡的所有参数。
    ```json
    [
      {
        "levelId": 1,
        "mapLayout": {
          "pathNodes": [ { "x": 0, "y": 100 }, { "x": 800, "y": 100 } ],
          "obstacles": [ { "x": 200, "y": 150, "destructible": true, "health": 500 } ],
          "buffPoints": [ { "x": 400, "y": 200, "buffType": "SPEED" } ]
        },
        "spawnPoints": [ { "x": 50, "y": 50 }, { "x": 50, "y": 150 } ],
        "enemySetup": [
          { "type": "ARROW_TOWER", "position": { "x": 300, "y": 100 }, "level": 1 },
          { "type": "CANNON_TOWER", "position": { "x": 600, "y": 100 }, "level": 2 }
        ],
        "timeLimit": 180 
      }
    ]
    ```
*   **说明**:
    *   `levelId`: 唯一标识，用于加载和关卡过渡。
    *   `mapLayout`: 包含构建游戏地图所需的所有静态和动态元素。
    *   `spawnPoints`: 定义了玩家可以部署单位的起始位置。
    *   `enemySetup`: 预设了该关卡中敌方防御塔的布局。
    *   `timeLimit`: 该关卡的挑战时间（秒）。

**2. “时间耗尽”失败条件 (Time-out Fail Condition)**

*   **核心状态整合**:
    *   在主游戏状态 `gameState` 中添加 `levelTimeLeft` 变量，在加载关卡时根据 `level.timeLimit` 初始化。
*   **游戏循环逻辑**:
    *   在游戏的主 `update` 或 `gameLoop` 函数中，每秒钟将 `levelTimeLeft` 减1。
    *   检查 `levelTimeLeft` 是否小于等于0。如果为真，则触发 `gameOver('TIME_OUT')` 函数，结束游戏。

**3. 关卡过渡逻辑 (Level Progression)**

*   **触发**: 当玩家成功摧毁敌方主基地或达成其他胜利条件时，触发 `levelComplete()` 函数。
*   **流程**:
    1.  显示胜利画面，并展示统计数据。
    2.  将 `gameState.currentLevelId` 加1。
    3.  调用 `loadLevel(gameState.currentLevelId)` 函数。
    4.  `loadLevel` 函数会从关卡数据中查找新的 `levelId`，并用其数据重置游戏状态（地图、敌人、计时器等）。
---
### Decision
[2025-08-08 08:33:01] - 设计了单位升级系统，允许玩家通过花费资源来强化单位。

**Rationale:**
为了增加游戏内的策略选择和长期目标，引入一个单位升级系统是至关重要的。这不仅为玩家提供了资源消耗的途径，也使得游戏后期的单位更具战斗力，能够应对更强的挑战。此设计遵循了“数据驱动”的原则，将升级路径和属性配置化，便于未来的平衡性调整。

**Implementation Details:**

**1. 数据结构设计 (Data Structure Design)**

*   **`UNIT_TYPES` 扩展**:
    *   在核心的 `UNIT_TYPES` 定义中，为每种单位增加了一个 `upgradeTree` 数组。
    *   `upgradeTree` 中的每个对象都定义了从当前等级升至下一级所需的 `cost`（金币消耗）以及新等级的全部属性（`hp`, `damage`, `speed` 等）。
    *   最后一项代表单位的最高等级，其 `cost` 为 0。
    ```javascript
    const UNIT_TYPES = {
        goblin: {
            name: "Goblin",
            upgradeTree: [
                { hp: 50, damage: 5, speed: 1.2, cost: 75 },   // Level 0 -> 1
                { hp: 70, damage: 7, speed: 1.3, cost: 150 },  // Level 1 -> 2
                { hp: 100, damage: 10, speed: 1.4, cost: 0 },    // Level 2 (Max)
            ]
        },
        // ... other units
    };
    ```

*   **`gameState` 扩展**:
    *   在 `gameState` 对象中增加 `unitLevels` 字典，用于追踪每种单位的当前等级。
    *   游戏初始化时，所有单位的等级都设置为 `0`。
    ```javascript
    const gameState = {
        // ...
        unitLevels: { goblin: 0, brute: 0 }, 
    };
    ```

**2. 核心逻辑 (Core Logic)**

*   **`upgradeUnit(unitType)` 函数**:
    *   **职责**: 处理特定单位类型的升级请求。
    *   **流程**:
        1.  检查单位是否已达到最高等级。
        2.  获取下一级的升级成本 (`cost`)。
        3.  检查玩家是否有足够的资源 (`gameState.player.resources`)。
        4.  如果满足条件，扣除资源并将 `gameState.unitLevels[unitType]` 加 1。
        5.  返回成功或失败的状态，以便UI可以给出反馈。

*   **`spawnUnit(unitType)` 函数 (修改)**:
    *   **职责**: 生成一个单位实例。
    *   **修改点**: 在创建新单位时，它会首先从 `gameState.unitLevels` 中读取该单位类型的当前等级，然后从 `UNIT_TYPES[unitType].upgradeTree` 中查找对应等级的属性，并应用到新生成的单位上。

**3. UI/UX 考量 (UI/UX Considerations)**

*   **触发点**: 玩家界面上应为每种可升级的单位提供一个升级按钮。
*   **信息展示**:
    *   按钮上应清晰地显示下一次升级所需的 **金币 `cost`**。
    *   当鼠标悬停或点击按钮时，可以显示一个提示框，详细说明下一级将带来的 **属性提升**（例如，“生命值: 70 -> 100”，“伤害: 7 -> 10”）。
    *   当单位达到满级时，升级按钮应变为禁用状态或隐藏。
---
### Decision
[2025-08-08 08:37:05] - 设计了单位生产队列系统，将单位的购买与生成过程分离。

**Rationale:**
引入生产时间可以增加游戏的策略维度。玩家需要提前规划单位的生产，而不是在需要时立即获得单位，这为战术决策（如时机把握、资源分配）增加了深度。该系统还能与现有的升级系统、关卡系统无缝集成，是游戏核心循环的最后一个关键模块。

**Implementation Details:**

**1. 数据结构设计 (Data Structure Design)**

*   **`UNIT_TYPES` 扩展**:
    *   在 `UNIT_TYPES` 定义中，为每个单位的基础属性（`upgradeTree` 的第一级或一个独立的 `baseStats` 对象）增加 `productionTime` 属性（单位：秒）。
    ```javascript
    const UNIT_TYPES = {
        goblin: {
            name: "Goblin",
            productionTime: 5, // 生产时间5秒
            upgradeTree: [
                // ...
            ]
        },
        // ... other units
    };
    ```

*   **`gameState` 扩展**:
    *   在 `gameState` 对象中增加一个 `productionQueue` 数组。
    *   队列中的每个对象都代表一个正在生产的单位，包含其类型和剩余生产时间。
    ```javascript
    const gameState = {
        // ...
        productionQueue: [], // e.g., [ { unitType: 'goblin', timeLeft: 3.5, totalTime: 5 } ]
    };
    ```

**2. 核心逻辑 (Core Logic)**

*   **`purchaseUnit(unitType)` 函数 (取代 `spawnUnit`)**:
    *   **职责**: 处理玩家的单位购买请求。
    *   **流程**:
        1.  检查玩家资源是否足够支付单位成本（从 `upgradeTree` 获取）。
        2.  如果资源充足，扣除资源。
        3.  将一个新对象 `{ unitType: unitType, timeLeft: UNIT_TYPES[unitType].productionTime, totalTime: UNIT_TYPES[unitType].productionTime }` 添加到 `gameState.productionQueue` 数组中。
        4.  函数不直接在地图上创建单位。

*   **游戏循环中的生产逻辑 (`updateProductionQueue`)**:
    *   **职责**: 在游戏主循环 (`gameLoop`) 中被调用，负责更新生产队列。
    *   **流程**:
        1.  遍历 `gameState.productionQueue` 数组。
        2.  对于每个正在生产的单位，将其 `timeLeft` 减去 `deltaTime` (自上一帧以来的时间)。
        3.  检查是否有单位的 `timeLeft` 小于等于 0。
        4.  如果有，调用真正的 `spawnUnitOnMap(unitType)` 函数，在出生点创建单位实体。
        5.  `spawnUnitOnMap` 的逻辑与旧的 `spawnUnit` 类似，会根据 `gameState.unitLevels` 来应用正确的属性。
        6.  将完成生产的单位从 `productionQueue` 中移除。

**3. UI/UX 考量 (UI/UX Considerations)**

*   **生产进度可视化**:
    *   在每个单位的购买卡片上，实现一个进度条（例如，一个从下到上填充的遮罩层）。
    *   当一个单位被加入生产队列时，其对应的卡片进入“生产中”状态。
    *   进度条的填充百分比根据 `(totalTime - timeLeft) / totalTime` 计算。
*   **卡片状态**:
    *   当一个单位正在生产时，其购买卡片应变为不可点击状态，以防止玩家重复排队同一个单位（或者可以设计成允许多个单位排队，UI上显示队列数量）。
    *   生产完成后，卡片恢复到可用状态。
---
### Decision (Code)
[2025-08-08 08:48:03] - 实现了关卡系统、单位升级和单位生产队列的核心功能。

**Rationale:**
本次实现旨在将先前在架构和设计阶段确定的所有核心游戏机制（关卡、升级、生产）完全集成到现有的代码库中。这是将概念转化为可玩体验的关键步骤。

**Details:**
1.  **关卡与失败条件**:
    *   **实现**: 在 `script.js` 中引入了 `LEVELS` 数组来替代旧的 `MAP.difficulties`。创建了 `loadLevel(levelId)` 函数，负责根据关卡数据重置游戏状态，包括敌人布局、资源和 `levelTimeLeft` 计时器。
    *   **UI**: 在 `index.html` 中添加了 `#timerText` 元素，并在 `style.css` 中为其添加了样式，用于实时显示剩余时间。
    *   **逻辑**: 游戏主循环 `loop()` 现在会递减计时器，并在其归零时触发 `gameOver('TIME_OUT')` 逻辑。

2.  **单位升级系统**:
    *   **实现**: 将 `UNITS` 常量重构为包含 `upgradeTree` 的 `UNIT_TYPES`。在 `gameState` 中添加了 `unitLevels` 来跟踪每个单位的当前等级。
    *   **UI**: 在 `index.html` 的每个单位按钮中添加了升级按钮 (`.upgrade-btn`) 和等级显示 (`.unit-level`)。在 `style.css` 中为这些新元素添加了样式。
    *   **逻辑**: `spawnUnit` 被修改为 `spawnUnitOnMap`，它会根据单位的当前等级应用正确的属性。新的 `upgradeUnit` 函数处理升级逻辑。`updateUIAfterUpgrade` 函数负责在升级后刷新UI。

3.  **单位生产时间**:
    *   **实现**: 在 `UNIT_TYPES` 中为每个单位添加了 `productionTime` 属性。在 `gameState` 中增加了 `productionQueue` 数组。
    *   **UI**: 在 `style.css` 中为单位按钮添加了 `.production-overlay` 样式，用于显示生产进度动画。
    *   **逻辑**: 创建了 `purchaseUnit` 函数，它将单位添加到生产队列而不是立即生成。在主循环中调用的新 `updateProductionQueue` 函数负责处理生产倒计时和单位的最终生成。

**File References:**
*   [`script.js`](script.js:1)
*   [`index.html`](index.html:1)
*   [`style.css`](style.css:1)
---
### Decision
[2025-08-08 09:10:10] - 设计并实现了一个全新的、基于标签和类型的单位克制系统。

**Rationale:**
为了提升游戏的策略深度，摆脱简单的“数值比拼”，需要一个复杂的克制系统。该系统通过引入角色、标签、伤害类型和护甲类型，创建了一个“石头-剪刀-布”式的关系网，鼓励玩家根据敌方配置来调整自己的出兵策略。

**Implementation Details:**

**1. 核心数据结构 (Core Data Structures)**

*   **`ROLES`**: 定义了单位的战场定位（`Tank`, `DPS`, `Support`），主要用于玩家快速理解单位用途。
*   **`TAGS`**: 为单位附加特性（如 `Ground`, `Flying`, `Armored`），用于目标选择和逻辑判断。
*   **`DAMAGE_TYPES`**: 定义了攻击的类别（`Physical`, `Explosive`, `Energy`）。
*   **`ARMOR_TYPES`**: 定义了单位的防御类别（`Light`, `Heavy`, `Shielded`）。

**2. 伤害修正矩阵 (Damage Modification Matrix)**

*   创建了 `DAMAGE_MODIFIERS` 矩阵，它明确定义了每种 `DAMAGE_TYPE` 对每种 `ARMOR_TYPE` 的伤害倍率。
    *   例如，`EXPLOSIVE` 伤害对 `LIGHT` 护甲造成 150% 伤害，但对 `HEAVY` 护甲只造成 75%。
*   实现了一个 `calculateDamage(attack, targetArmorType)` 函数，该函数查询此矩阵以计算最终伤害值。

**3. 单位和防御塔数据重构 (Unit &amp; Tower Refactoring)**

*   完全重构了 `UNIT_TYPES` 和 `TOWER_TYPES` 的数据结构。
*   每个单位和塔现在都包含新的属性，例如：
    *   `role`: 来自 `ROLES` 枚举。
    *   `tags`: 一个 `TAGS` 数组。
    *   `armorType`: 来自 `ARMOR_TYPES` 枚举。
    *   `attack`: 一个包含 `damage`, `damageType`, `range`, `attackSpeed` 和 `canTarget` (基于标签) 的对象。
*   这个新结构使得单位的所有战斗相关属性都集中且清晰，并且是数据驱动的。

**4. 伪代码更新 (Pseudocode Update)**

*   在 `gameLogic.js` 中更新了 `updateUnits` 函数的 conceptual logic，使其调用新的 `calculateDamage` 函数。
*   添加了 `findTargetFor` 的概念函数，该函数会根据攻击者的 `canTarget` 标签来筛选目标。

**File References:**
*   [`gameLogic.js`](gameLogic.js:1)
---
### Decision
[2025-08-08 09:15:10] - 设计并规划了玩家战术技能系统。

**Rationale:**
为了增强玩家在战斗中的直接影响力并增加策略维度，引入一个高影响力的战术技能系统是必要的。该系统允许玩家通过消耗资源来释放改变战局的技能，例如范围治疗、使防御塔失效或造成全局性效果，从而补充了基于单位生产的核心玩法。

**Implementation Details:**

**1. 数据结构设计 (Data Structure Design)**

*   **`TACTICAL_SKILLS` 常量**:
    *   创建了一个中心化的 `TACTICAL_SKILLS` 对象，用于定义所有可用技能。
    *   每个技能对象都包含 `skillId`, `name`, `cost`, `cooldown`, `targetingType` (`area`, `single_target`, `global`) 和一个灵活的 `effects` 数组。
    *   `effects` 数组的设计允许单个技能触发多种效果（例如，EMP既能瘫痪塔，又能伤害护盾），并且可以描述持续性效果（如治疗光环）和即时效果。

*   **`gameState` 扩展**:
    *   在 `gameState` 中增加了 `skillCooldowns` 对象，以时间戳的形式记录每个技能的最后使用时间，用于冷却管理。
    *   增加了 `activeEffects` 数组，用于存储当前在战场上生效的技能效果实例。每个实例都包含其来源技能、位置、效果、开始和结束时间。

**2. 核心逻辑 (Core Logic)**

*   **`activateTacticalSkill(skillId, position)` 函数**:
    *   **职责**: 作为技能释放的入口点。
    *   **流程**:
        1.  验证技能是否存在。
        2.  检查玩家资源 (`cost`) 和技能冷却时间 (`cooldown`)。
        3.  如果通过检查，则扣除资源并更新冷却时间戳。
        4.  创建一个 `activeEffect` 对象，并将其推入 `gameState.activeEffects` 数组。
        5.  立即应用技能中的任何即时效果。

*   **`updateActiveEffects(deltaTime)` 函数**:
    *   **职责**: 在主游戏循环中被调用，处理所有持续性效果和效果的生命周期。
    *   **流程**:
        1.  遍历 `activeEffects` 数组。
        2.  对于持续性效果（如 `HEAL_OVER_TIME`），根据 `deltaTime` 在每一帧应用其效果。
        3.  检查每个效果是否到达其 `endTime`。如果已过期，则调用 `cleanupExpiredEffect` 函数来移除任何残留影响（如状态标签），然后将其从数组中移除。

**3. 与现有系统的集成**

*   **资源系统**: 技能的 `cost` 直接与玩家的资源（当前在伪代码中为 `player.resources`）挂钩。
*   **游戏循环**: `updateActiveEffects` 作为核心更新步骤之一被集成到主 `gameLoop` 中。
*   **单位/塔系统**: 技能效果通过标签（例如，为被致盲的塔添加 `ATTACK_DISABLED` 标签）与单位和塔的逻辑进行交互。单位/塔的AI在执行动作前需要检查这些标签。

**File References:**
*   [`gameLogic.js`](gameLogic.js:1)
---
### Decision
[2025-08-08 09:18:02] - 设计了一个全面的、用于驱动长期留存的局外成长系统。

**Rationale:**
为了在核心玩法之外提供持久的玩家目标和奖励，从而提高长期用户留存率，需要一个连接每局游戏的成长系统。该系统通过经验值、等级、科技树和永久性升级，让玩家的持续投入能够转化为可感知的游戏内优势。设计采用数据驱动的方法，以确保未来的可扩展性和可维护性。

**Implementation Details:**

**1. 核心玩家数据 (`playerProfile`)**
*   **结构**: 一个中心化的JSON对象，用于存储所有局外成长数据。
    ```json
    {
      "profileId": "string",
      "playerName": "string",
      "xp": "number",
      "level": "number",
      "techPoints": "number",
      "unlockedUnits": ["unit_id_1"],
      "unlockedSkills": ["skill_id_1"],
      "permanentUpgrades": {
        "units": {
          "goblin": { "damage": 1, "hp": 5 }
        },
        "skills": {
          "emp_skill": { "cooldown": -2 }
        },
        "global": {
            "startingResources": 50
        }
      }
    }
    ```

**2. 经验与资源获取**
*   **经验值 (XP)**: 在每局游戏结束后根据表现（通关时间、摧毁的塔数等）进行奖励。等级提升需要指数增长的XP。
*   **科技点 (Tech Points)**: 主要通过玩家升级获得，作为在科技树中进行消费的核心资源。

**3. 数据驱动的科技树 (Tech Tree)**
*   **结构**: 一个由外部数据（如JSON）定义的图结构。每个节点代表一项解锁或升级。
*   **节点定义**:
    ```json
    {
      "id": "string",
      "type": "UNLOCK_UNIT" | "UNLOCK_SKILL" | "PERMANENT_UPGRADE",
      "name": "string",
      "description": "string",
      "cost": "number",
      "dependencies": ["dependency_id"],
      "payload": { /* ... */ }
    }
    ```
*   **功能**: 允许玩家使用科技点解锁新单位、新技能或获得对现有单位/技能的永久性加成。

**4. 数据持久化**
*   **方案**: 使用浏览器的 `localStorage` API。
*   **流程**: 游戏启动时加载 `playerProfile`，游戏结束后或在科技树中消费后保存更新后的 `playerProfile`。

**5. 系统集成**
*   **游戏开始时**:
    1.  加载 `playerProfile`。
    2.  根据 `unlockedUnits` 和 `unlockedSkills` 动态生成游戏内的UI（可购买的单位、可使用的技能）。
    3.  将 `permanentUpgrades` 中的数值加成应用到本次游戏局内的所有单位和技能的基础属性上。例如，一个被永久升级过的哥布林在生成时就会拥有更高的生命值。

**File References:**
*   [`gameLogic.js`](gameLogic.js:1)
*   [`memory-bank/systemPatterns.md`](memory-bank/systemPatterns.md:1)
---
### Decision
[2025-08-08 09:23:29] - 最终架构整合 (Final Architecture Integration)

**Rationale:**
为了将“第三阶段”设计的所有独立系统（单位克制、战术技能、局外成长）与先前已实现的核心机制（关卡、升级、生产）融合成一个统一、连贯且可实现的最终架构，必须进行一次全面的整合。本次整合旨在消除系统间的冲突，明确数据流，并为最终的编码阶段提供一份清晰、唯一的架构蓝图。

**Implementation Details:**

**1. 统一数据结构 (Unified Data Structures):**
*   **`FINAL_GAME_CONSTANTS`**: 创建了一个唯一的、深拷贝的静态数据源，包含了所有单位、技能、克制关系、科技树和关卡数据。这确保了游戏基础数据的一致性和不可变性。
*   **`gameState`**: 定义了一个全面的、动态的游戏状态对象，清晰地包含了所有系统所需的状态变量，如资源、单位列表、生产队列、技能冷却等。

**2. 核心数据流定义 (Core Data Flow):**
*   **`playerProfile` -> `sessionConstants` -> `gameState`**:
    1.  游戏启动时，加载 `playerProfile`（持久化数据）。
    2.  调用 `applyPlayerProfile` 函数，该函数深拷贝 `FINAL_GAME_CONSTANTS` 成为 `sessionConstants`，并将 `playerProfile` 中的所有永久升级（如单位HP加成、技能冷却缩减）应用到 `sessionConstants` 上。
    3.  `gameState` 在初始化时及整个游戏过程中，完全依赖 `sessionConstants` 来获取单位属性、技能效果等数据。
*   **此流程解决了核心问题**：它明确了局外成长 (`playerProfile`) 如何精确地修改局内核心玩法数据 (`UNIT_TYPES`, `TACTICAL_SKILLS`)，同时通过会话隔离（`sessionConstants`）确保了每次游戏的独立性。

**3. 最终执行顺序 (Final Execution Order):**
*   **`initializeGame()`**: 重新定义了游戏初始化流程，严格遵循：加载档案 -> 应用加成 -> 加载关卡 -> 启动循环。
*   **`gameLoop()`**: 明确了游戏主循环中各更新函数的调用顺序：`updateTimers` -> `updateProductionQueue` -> `updateActiveEffects` -> `updateAI`。
*   **`updateAI()`**: 创建了一个统一的AI更新函数，负责处理所有单位和防御塔的索敌与攻击逻辑，取代了之前分散的逻辑。

**4. 最终架构蓝图:**
*   更新后的 [`gameLogic.js`](gameLogic.js:1) 文件现在是所有系统整合后的最终版本。它不仅定义了数据结构和函数签名，更重要的是，它通过代码的组织结构和调用顺序本身，完整地描述了整个游戏的设计思想和运行逻辑。

**File References:**
*   [`gameLogic.js`](gameLogic.js:1)
*   [`memory-bank/decisionLog.md`](memory-bank/decisionLog.md:1)
---
### Decision (Code)
[2025-08-08 09:45:00] - 完成了基于最终架构伪代码 (`gameLogic.js`) 的大规模代码重构。

**Rationale:**
为了将所有已设计的系统（单位克制、战术技能、局外成长）转化为功能完整的代码，必须对现有的 `script.js` 进行一次彻底的重构。此次重构的目标是使代码库与最终的、统一的架构蓝图完全保持一致。

**Details:**
1.  **统一数据结构**:
    *   **实现**: 移除了旧的、分散的 `UNIT_TYPES`, `TOWERS`, `LEVELS` 等常量，并用单一的、源于 `gameLogic.js` 的 `FINAL_GAME_CONSTANTS` 对象取而代之。
    *   **实现**: 重新设计了 `gameState` 对象，使其包含所有系统所需的状态变量，并移除了旧的 `state` 对象。

2.  **战斗系统重构**:
    *   **实现**: 完全重写了 `findTargetFor` 和 `calculateDamage` 函数，以支持基于标签和伤害/护甲类型的克制关系。
    *   **实现**: 在 `updateAI` 函数中为单位和塔添加了攻击冷却逻辑，并确保它们使用新的索敌和伤害计算。
    *   **实现**: 更新了单位和塔的生成函数 (`spawnUnitOnMap`, `loadLevel`)，以确保所有实例都包含符合新数据结构的完整属性（如 `tags`, `armorType`, `attack` 对象等）。

3.  **局外成长与持久化**:
    *   **实现**: 实现了 `loadPlayerProfile`, `savePlayerProfile`, `applyPlayerProfile` 和 `purchaseTech` 函数，构成了完整的局外成长循环。
    *   **实现**: `playerProfile` 现在是所有局外进度的唯一真实来源，并通过 `localStorage` 进行持久化。游戏启动时，`applyPlayerProfile` 会将这些永久性加成应用到一个临时的 `sessionConstants` 对象上，供本局游戏使用。

4.  **渲染与UI整合**:
    *   **实现**: 重构了 `renderGame` 及其所有绘图辅助函数，使其从新的 `gameState` 对象中读取数据进行绘制。
    *   **实现**: 重新绑定了所有UI元素的事件监听器，确保按钮（如出兵、技能）能正确调用新的核心逻辑函数。
    *   **实现**: 创建了 `updateUI` 函数，用于在游戏循环中持续刷新界面上的数据读数。

**File References:**
*   [`script.js`](script.js:1)
*   [`gameLogic.js`](gameLogic.js:1)