# System Patterns *Optional*

This file documents recurring patterns and standards used in the project.
It is optional, but recommended to be updated as the project evolves.
2025-08-08 08:00:43 - Log of updates made.

*

## Coding Patterns

*   

## Architectural Patterns

*   
---
### Tag-Based Counter System
[2025-08-08 09:11:06] - A system where unit effectiveness is determined by a combination of tags, damage types, and armor types, rather than direct unit-vs-unit matchups.

**Description:**
This pattern decouples combat logic from specific unit definitions. Every unit and tower is assigned a set of properties:
- **Tags** (e.g., `Flying`, `Armored`): Define its characteristics.
- **Armor Type** (e.g., `Light`, `Heavy`): Defines its defensive profile.
- **Attack Type** (e.g., `Physical`, `Explosive`): Defines its offensive profile.

A central `DAMAGE_MODIFIERS` matrix dictates the interaction between `Attack Types` and `Armor Types`. This creates a predictable and extensible "rock-paper-scissors" dynamic. For example, an attack's `canTarget` property uses tags to determine valid targets (e.g., a `Cannon Tower` can only target units with the `Ground` tag).

**Benefits:**
*   **Scalability**: New units can be added by simply defining their properties, and they will automatically fit into the existing counter system without requiring custom logic.
*   **Balance & Tuning**: Game balance can be adjusted by tweaking the `DAMAGE_MODIFIERS` matrix or changing a unit's tags/types, without altering core code.
*   **Clarity**: The system is easy for designers and players to understand. "Explosive damage is good against light armor" is a clear and memorable rule.

**Implementation:**
*   Define enumerations for `ROLES`, `TAGS`, `DAMAGE_TYPES`, and `ARMOR_TYPES`.
*   Create a `DAMAGE_MODIFIERS` data structure (e.g., a 2D object/map) that holds the damage multipliers.
*   Refactor all unit and tower definitions to include these new properties.
*   Implement a `calculateDamage` helper function that takes an attack and a target's armor type, and returns the final damage after applying the modifier.
*   Use tags in targeting logic to filter valid targets (e.g., anti-air attacks can only target units with the `Flying` tag).
---
### Data-Driven Level Design
[2025-08-08 08:27:41] - 游戏关卡的内容和逻辑由外部数据结构（如JSON文件）定义，而不是硬编码在游戏代码中。

**Description:**
该模式将关卡的所有具体参数，包括地图布局、敌人配置、胜利/失败条件（如时间限制）等，都存储在一个或多个数据文件中。游戏引擎在启动或加载一个新关卡时，会读取这些数据并动态生成游戏世界。

**Benefits:**
*   **灵活性和可扩展性**: 无需修改核心代码即可轻松添加、删除或修改关卡。
*   **快速迭代**: 关卡设计师可以在不重新编译或部署整个游戏的情况下，快速调整关卡参数并进行测试。
*   **关注点分离**: 游戏逻辑（引擎）与游戏内容（关卡数据）分离，使得代码更清晰，职责更明确。

**Implementation:**
*   定义一个标准的、版本化的关卡数据结构（Schema）。
*   创建一个 `LevelLoader` 模块，负责解析数据文件并根据其内容设置游戏状态。
*   游戏的核心逻辑引用由 `LevelLoader` 填充的当前关卡数据来运作。

## Testing Patterns

*
---
### Data-Driven Metagame Progression
[2025-08-08 09:18:53] - A system that uses external data structures to define a player's long-term progression, including unlocks, permanent upgrades, and other persistent rewards.

**Description:**
This pattern decouples the long-term player journey from the core game logic. All progression elements—such as the technology tree, level-up rewards, and permanent stat bonuses—are defined in data files (e.g., JSON). A central `playerProfile` object stores the player's current state (XP, level, unlocked items, etc.) and is persisted between game sessions (e.g., via `localStorage`).

**Benefits:**
*   **High Engagement &amp; Retention**: Provides players with long-term goals and a tangible sense of achievement that carries over between sessions.
*   **Flexibility &amp; Scalability**: New units, skills, and upgrades can be added to the progression path without changing game code, simply by updating the data files.
*   **Tunability**: The entire player journey, including the "grind" and reward schedule, can be fine-tuned by adjusting values in the data files, facilitating long-term game balance.

**Implementation:**
*   Define a clear schema for the `playerProfile` object, which will act as the single source of truth for a player's persistent data.
*   Define a data structure for the `techTree`, where each node has a cost, dependencies, and a specific reward payload.
*   Implement a `PersistenceManager` to handle saving and loading the `playerProfile` from a storage medium like `localStorage`.
*   Create a `ProgressionManager` that modifies the initial state of a game session based on the loaded `playerProfile` (e.g., applying permanent upgrades to base unit stats, filtering the available unit list).
*   At the end of a game session, calculate rewards (XP, currency) and update the `playerProfile` accordingly.