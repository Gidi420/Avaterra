// ============================================================
// data.js  –  All static game data for Avaterra
// ============================================================

// ── CHARACTERS ──────────────────────────────────────────────
const CHARACTERS = [
  {
    id: 'zephyr', name: 'Zephyr', lore: 'The Shadow Dancer',
    hp: 30, damage: 3, actionsPerTurn: 4,
    combatCardCapacity: 5, itemCapacity: 5,
    color: '#9b59b6', hexColor: 0x9b59b6,
    abilityName: 'Veil-Step',
    abilityDesc: 'Spend 1 Action to move exactly 2 tiles through connected paths (walls still apply unless upgraded).',
    abilityType: 'active', abilityCost: { actions: 1 },
    limitation: 'Cannot cross walls or removed tiles without upgrade.',
    upgrades: [
      { id: 'swift_step',  tier: 1, name: 'Swift Step',   desc: '+1 Action per turn.',            cost: 3, effect: { actions: 1 } },
      { id: 'card_master', tier: 2, name: 'Card Mastery', desc: '+1 Combat Card Capacity.',        cost: 4, effect: { combatCardCap: 1 } },
      { id: 'phase_walk',  tier: 3, name: 'Phase Walk',   desc: 'Veil-Step ignores walls/removed tiles.', cost: 6, effect: { flag: 'throughWalls' } },
    ],
  },
  {
    id: 'lyra', name: 'Lyra', lore: 'The Mind Weaver',
    hp: 27, damage: 3, actionsPerTurn: 4,
    combatCardCapacity: 5, itemCapacity: 5,
    color: '#3498db', hexColor: 0x3498db,
    abilityName: 'Mind-Link',
    abilityDesc: 'Discard 1 Combat Card to peek at an opponent\'s hand. They gain 1 resistance vs. you this round.',
    abilityType: 'active', abilityCost: { combatCards: 1 },
    limitation: 'Target gains 1 resistance against you for the round.',
    upgrades: [
      { id: 'clarity',    tier: 1, name: 'Clarity',    desc: '+1 Action per turn.',           cost: 3, effect: { actions: 1 } },
      { id: 'collector',  tier: 2, name: 'Collector',  desc: '+1 Item Capacity.',              cost: 4, effect: { itemCap: 1 } },
      { id: 'deep_probe', tier: 3, name: 'Deep Probe', desc: 'Mind-Link targets two players for 1 card.', cost: 6, effect: { flag: 'twoTargets' } },
    ],
  },
  {
    id: 'kael', name: 'Kael', lore: 'The Shadow Plunderer',
    hp: 33, damage: 2, actionsPerTurn: 4,
    combatCardCapacity: 5, itemCapacity: 5,
    color: '#2ecc71', hexColor: 0x2ecc71,
    abilityName: 'Shadow-Plunder',
    abilityDesc: 'Discard 1 Combat Card to steal 1 random item from an opponent on your tile. On success, draw 1 Combat Card. Opponent may block.',
    abilityType: 'active', abilityCost: { combatCards: 1 },
    limitation: 'Opponents can block this ability.',
    upgrades: [
      { id: 'nimble',      tier: 1, name: 'Nimble',      desc: '+1 Action per turn.',      cost: 3, effect: { actions: 1 } },
      { id: 'brutality',   tier: 2, name: 'Brutality',   desc: '+1 Damage.',               cost: 4, effect: { damage: 1 } },
      { id: 'grand_theft', tier: 3, name: 'Grand Theft', desc: 'Shadow-Plunder steals 2 items.', cost: 6, effect: { flag: 'steals2' } },
    ],
  },
  {
    id: 'mason', name: 'Mason', lore: 'The Battle Hungry',
    hp: 30, damage: 3, actionsPerTurn: 4,
    combatCardCapacity: 5, itemCapacity: 4,
    color: '#e67e22', hexColor: 0xe67e22,
    abilityName: 'Battle Hunger',
    abilityDesc: 'Passive: Gain +1 XP from winning PvP combat and +1 XP from winning a hunt.',
    abilityType: 'passive', abilityCost: {},
    limitation: 'Gaining "Berserker" upgrade reduces item capacity to 3.',
    upgrades: [
      { id: 'warriors_path', tier: 1, name: "Warrior's Path", desc: '+1 Action per turn.',           cost: 3, effect: { actions: 1 } },
      { id: 'extra_slot',    tier: 2, name: 'Extra Slot',     desc: '+1 Combat Card Capacity.',       cost: 4, effect: { combatCardCap: 1 } },
      { id: 'berserker',     tier: 3, name: 'Berserker',      desc: 'Spend 2 XP at combat start for +1 Dmg or +1 Res (stackable). Item cap → 3.', cost: 6, effect: { flag: 'berserker', itemCapDelta: -1 } },
    ],
  },
  {
    id: 'vesper', name: 'Vesper', lore: 'The Blood Mage',
    hp: 25, damage: 3, actionsPerTurn: 4,
    combatCardCapacity: 5, itemCapacity: 4,
    color: '#e74c3c', hexColor: 0xe74c3c,
    abilityName: 'Sanguine Ritual',
    abilityDesc: 'Spend 2 Actions at the start of combat. If you win that combat, recover 2 HP.',
    abilityType: 'pre-combat', abilityCost: { actions: 2 },
    limitation: 'Cannot exceed starting Max HP. Healing Potion gives 2 HP; Grand Elixir gives 4 HP.',
    upgrades: [
      { id: 'bloodlust',   tier: 1, name: 'Bloodlust',   desc: '+1 Combat Card Capacity.',   cost: 3, effect: { combatCardCap: 1 } },
      { id: 'vitality',    tier: 2, name: 'Vitality',    desc: '+1 Action per turn.',         cost: 4, effect: { actions: 1 } },
      { id: 'blood_feast', tier: 3, name: 'Blood Feast', desc: 'Sanguine Ritual win also grants +1 Action this turn.', cost: 6, effect: { flag: 'bonusAction' } },
    ],
  },
  {
    id: 'soren', name: 'Soren', lore: 'The Master Archer',
    hp: 30, damage: 2, actionsPerTurn: 4,
    combatCardCapacity: 5, itemCapacity: 4,
    color: '#1abc9c', hexColor: 0x1abc9c,
    abilityName: 'Seeking Arrow',
    abilityDesc: 'Spend 2 Actions to fire at a player on an adjacent tile for 4 damage. They may block but cannot counter.',
    abilityType: 'active', abilityCost: { actions: 2 },
    limitation: 'Takes +1 damage from close-range attacks. Deals only 2 damage on close-range attacks.',
    upgrades: [
      { id: 'fleet_foot',     tier: 1, name: 'Fleet Foot',     desc: '+1 Action per turn.',                                     cost: 3, effect: { actions: 1 } },
      { id: 'precision',      tier: 2, name: 'Precision',      desc: '+1 Damage to attacks on your current tile (Point-Blank).', cost: 4, effect: { flag: 'pointBlank' } },
      { id: 'pierce_arrow',   tier: 3, name: 'Piercing Arrow', desc: 'Seeking Arrow fires through walls; targets two enemies on same tile.', cost: 6, effect: { flag: 'pierce' } },
    ],
  },
];

// ── TILE TYPES ───────────────────────────────────────────────
// Special tile counts: forest×9, tower×2, fortress×2, swamp×2, vault×2, lava×2, curse×2, plain×3 = 24
const TILE_TYPE_DATA = {
  forest:   { label: 'Forest',   color: 0x1a5c2a, textColor: '#7dff9b', icon: '🌲', hasMonsters: true,  desc: 'Spend 1 Action to Hunt a monster and earn an item.' },
  tower:    { label: 'Tower',    color: 0x8b6914, textColor: '#ffe066', icon: '🏛',  hasMonsters: false, desc: 'Spend 1 Action: teleport to other Tower. Or spend 1 Action to heal 3 HP (once per game).' },
  fortress: { label: 'Fortress', color: 0x3a3a4a, textColor: '#aaaacc', icon: '🏰', hasMonsters: false, desc: 'Must be drawn from the bag TWICE before it can be removed.' },
  swamp:    { label: 'Swamp',    color: 0x1a3a30, textColor: '#66ffcc', icon: '🌿', hasMonsters: false, desc: 'Lose 1 Action immediately when you move onto or through this tile.' },
  vault:    { label: 'Vault',    color: 0x3a1a5c, textColor: '#cc88ff', icon: '💎', hasMonsters: false, desc: 'Pay 1 XP to enter. On rounds 7, 10, 13: entering grants a free item.' },
  lava:     { label: 'Lava',     color: 0x5c1a1a, textColor: '#ff6666', icon: '🌋', hasMonsters: false, desc: 'Lose 3 HP immediately upon entering.' },
  curse:    { label: 'Cursed',   color: 0x4a1a4a, textColor: '#ff88ff', icon: '💀', hasMonsters: false, desc: 'Discard 2 Combat Cards of your choice upon entering.' },
  plain:    { label: 'Plain',    color: 0x2a2010, textColor: '#ddcc88', icon: '⬜', hasMonsters: false, desc: 'No special effect.' },
};

// Board tile positions (row, col in a 8-wide virtual grid)
// Layout: cross shape – 2 top, 4×4 center, 2 left, 2 right, 2 bottom = 24 tiles
const TILE_LAYOUT = [
  // Top 2 (above center row 0)
  { id: 0,  row: 0, col: 3 }, { id: 1,  row: 0, col: 4 },
  // Center row 0
  { id: 2,  row: 1, col: 2 }, { id: 3,  row: 1, col: 3 }, { id: 4,  row: 1, col: 4 }, { id: 5,  row: 1, col: 5 },
  // Left arm row 1 + Center row 1 + Right arm row 1
  { id: 6,  row: 2, col: 1 }, { id: 7,  row: 2, col: 2 }, { id: 8,  row: 2, col: 3 }, { id: 9,  row: 2, col: 4 }, { id: 10, row: 2, col: 5 }, { id: 11, row: 2, col: 6 },
  // Left arm row 2 + Center row 2 + Right arm row 2
  { id: 12, row: 3, col: 1 }, { id: 13, row: 3, col: 2 }, { id: 14, row: 3, col: 3 }, { id: 15, row: 3, col: 4 }, { id: 16, row: 3, col: 5 }, { id: 17, row: 3, col: 6 },
  // Center row 3
  { id: 18, row: 4, col: 2 }, { id: 19, row: 4, col: 3 }, { id: 20, row: 4, col: 4 }, { id: 21, row: 4, col: 5 },
  // Bottom 2
  { id: 22, row: 5, col: 3 }, { id: 23, row: 5, col: 4 },
];
// Total: 2+4+6+6+4+2 = 24 ✓

// Tiles that have wall configurations (rotation matters)
const WALLED_TILE_IDS = [3, 8, 9, 14, 15, 20];

// Tile type distribution (shuffled at game start)
const TILE_TYPE_POOL = [
  'forest','forest','forest','forest','forest','forest','forest','forest','forest',
  'tower','tower',
  'fortress','fortress',
  'swamp','swamp',
  'vault','vault',
  'lava','lava',
  'curse','curse',
  'plain','plain','plain',
]; // 24 total

// ── ITEMS ────────────────────────────────────────────────────
const ITEMS = [
  // ── BRONZE (12 types × 3 copies = 36) ──
  { id: 'mind_drain',      tier: 'bronze', name: 'Mind Drain',      icon: '🧠', desc: 'Force an opponent to discard 1 Combat Card of your choice.',                       timing: 'own_turn',   effect: 'mind_drain' },
  { id: 'healing_potion',  tier: 'bronze', name: 'Healing Potion',  icon: '🧪', desc: 'Restore 3 HP (Vesper: only 2 HP).',                                                 timing: 'own_turn',   effect: 'heal',       value: 3 },
  { id: 'shockwave',       tier: 'bronze', name: 'Shockwave',       icon: '💥', desc: 'Push a player on your tile to any adjacent tile (ignores walls).',                 timing: 'own_turn',   effect: 'push' },
  { id: 'wind_step',       tier: 'bronze', name: 'Wind Step',       icon: '💨', desc: 'Move 1 space in any legal direction for free (no Action cost).',                   timing: 'own_turn',   effect: 'free_move' },
  { id: 'shield',          tier: 'bronze', name: 'Shield',          icon: '🛡', desc: 'Defensive: play when attacked to block the hit. Combat ends immediately, no damage.', timing: 'reaction', effect: 'shield', defensive: true },
  { id: 'terrain_rotator', tier: 'bronze', name: 'Terrain Rotator', icon: '🔄', desc: 'Rotate a walled tile in any direction.',                                            timing: 'own_turn',   effect: 'rotate_tile' },
  { id: 'sabotage',        tier: 'bronze', name: 'Sabotage',        icon: '🔨', desc: "Destroy one of an opponent's items at random.",                                     timing: 'own_turn',   effect: 'destroy_item' },
  { id: 'crystal_eye',     tier: 'bronze', name: 'Crystal Eye',     icon: '👁',  desc: "Look at an opponent's Combat Card hand.",                                           timing: 'own_turn',   effect: 'peek_hand' },
  { id: 'battle_surge',    tier: 'bronze', name: 'Battle Surge',    icon: '⚔',  desc: 'Your next successful attack deals +2 extra damage.',                                timing: 'own_turn',   effect: 'battle_surge', value: 2 },
  { id: 'soul_gem',        tier: 'bronze', name: 'Soul Gem',        icon: '✨',  desc: 'Instantly gain 2 XP.',                                                              timing: 'own_turn',   effect: 'gain_xp',    value: 2 },
  { id: 'smoke_bomb',      tier: 'bronze', name: 'Smoke Bomb',      icon: '💨', desc: 'Defensive: cancel any combat immediately — no damage, no winner.',                  timing: 'reaction',   effect: 'smoke_bomb', defensive: true },
  { id: 'swift_boots',     tier: 'bronze', name: 'Swift Boots',     icon: '👟', desc: 'Gain 1 extra Action Point this turn.',                                              timing: 'own_turn',   effect: 'extra_action', value: 1 },

  // ── SILVER (12 types × 3 copies = 36) ──
  { id: 'warp_stone',      tier: 'silver', name: 'Warp Stone',      icon: '🌀', desc: 'Instantly teleport to any available tile on the board.',                           timing: 'own_turn',   effect: 'teleport' },
  { id: 'counter_stance',  tier: 'silver', name: 'Counter Stance',  icon: '🔀', desc: 'Defensive: play when attacked to immediately swap roles and become the Attacker.',  timing: 'reaction',   effect: 'counter_stance', defensive: true },
  { id: 'iron_armor',      tier: 'silver', name: 'Iron Armor',      icon: '🧲', desc: 'Take -2 damage from all sources until the start of your next turn.',               timing: 'reaction',   effect: 'iron_armor', value: 2, defensive: true },
  { id: 'phantom_strike',  tier: 'silver', name: 'Phantom Strike',  icon: '🏹', desc: 'Attack an opponent 1 tile away. They cannot counter; they can only block or take damage.', timing: 'own_turn', effect: 'ranged_attack' },
  { id: 'archaeologist',   tier: 'silver', name: 'Archaeologist',   icon: '⛏',  desc: 'Pick up any Bronze item from the discard pile.',                                   timing: 'own_turn',   effect: 'salvage' },
  { id: 'grand_elixir',    tier: 'silver', name: 'Grand Elixir',    icon: '🔮', desc: 'Restore 6 HP (Vesper: only 4 HP).',                                                timing: 'own_turn',   effect: 'heal',       value: 6 },
  { id: 'banishment',      tier: 'silver', name: 'Banishment',      icon: '🌪',  desc: 'Move an opponent from their tile to any other tile on the board.',                timing: 'own_turn',   effect: 'displace' },
  { id: 'world_shaper',    tier: 'silver', name: 'World Shaper',    icon: '🗺',  desc: 'Remove a tile from the board OR restore a previously removed tile.',              timing: 'own_turn',   effect: 'world_shaper' },
  { id: 'time_stop',       tier: 'silver', name: 'Time Stop',       icon: '⏱',  desc: "End an opponent's turn immediately.",                                              timing: 'own_turn',   effect: 'time_stop' },
  { id: 'ethereal_blade',  tier: 'silver', name: 'Ethereal Blade',  icon: '🗡',  desc: 'Your next successful attack deals +4 extra damage.',                              timing: 'own_turn',   effect: 'battle_surge', value: 4 },
  { id: 'mass_confusion',  tier: 'silver', name: 'Mass Confusion',  icon: '🌀', desc: 'All players on your tile (except you) each discard 1 Combat Card.',               timing: 'own_turn',   effect: 'mass_confusion' },
  { id: 'rally',           tier: 'silver', name: 'Rally',           icon: '📣', desc: 'Draw Combat Cards up to your capacity immediately (no Action or XP cost).',       timing: 'own_turn',   effect: 'free_draw' },

  // ── GOLD (6 types × 2 copies = 12) ──
  { id: 'godslayer',       tier: 'gold', name: 'Godslayer',       icon: '⚡', desc: 'Your next successful attack deals +5 extra damage.',                              timing: 'own_turn',   effect: 'battle_surge', value: 5 },
  { id: 'phoenix_feather', tier: 'gold', name: 'Phoenix Feather', icon: '🔥', desc: 'Restore 10 HP.',                                                                  timing: 'own_turn',   effect: 'heal',       value: 10 },
  { id: 'void_rift',       tier: 'gold', name: 'Void Rift',       icon: '🕳',  desc: 'Teleport yourself to any tile AND move one opponent to any tile.',               timing: 'own_turn',   effect: 'void_rift' },
  { id: 'chaos_orb',       tier: 'gold', name: 'Chaos Orb',       icon: '🌑', desc: 'All other players immediately discard their entire Combat Card hand.',            timing: 'own_turn',   effect: 'chaos_orb' },
  { id: 'titan_armor',     tier: 'gold', name: "Titan's Armor",   icon: '🔰', desc: 'Take -4 damage from all sources until the start of your next turn.',             timing: 'reaction',   effect: 'iron_armor', value: 4, defensive: true },
  { id: 'blink_strike',    tier: 'gold', name: 'Blink Strike',    icon: '🗡',  desc: 'Attack any player on any tile on the board. They cannot counter — only block.', timing: 'own_turn',   effect: 'blink_strike' },
];

function buildItemDeck() {
  const deck = [];
  let uid = 0;
  ITEMS.forEach(template => {
    const copies = template.tier === 'bronze' ? 3 : template.tier === 'silver' ? 3 : 2;
    for (let i = 0; i < copies; i++) {
      deck.push({ ...template, uid: uid++ });
    }
  });
  return shuffle(deck);
}

// ── COMBAT CARDS ─────────────────────────────────────────────
const COMBAT_CARD_TYPES = ['slash', 'smash', 'jab'];
const COMBAT_CARD_ICONS = { slash: '⚔', smash: '🔨', jab: '👊' };
const COMBAT_CARD_COLORS = { slash: '#e74c3c', smash: '#e67e22', jab: '#3498db' };

function buildCombatDeck() {
  const deck = [];
  let uid = 0;
  COMBAT_CARD_TYPES.forEach(type => {
    for (let i = 0; i < 12; i++) deck.push({ type, uid: uid++ });
  });
  return shuffle(deck);
}

// ── DISASTER SHEET ───────────────────────────────────────────
function getDisasterForRound(round) {
  let remove = round <= 6 ? 1 : round <= 13 ? 2 : 1;
  let freeItemTier = null;
  let freeItemCount = 0;
  if (round === 7)  { freeItemTier = 'bronze'; freeItemCount = 1; }
  if (round === 10) { freeItemTier = 'bronze'; freeItemCount = 2; }
  if (round === 13) { freeItemTier = 'silver'; freeItemCount = 3; }
  return { remove, freeItemTier, freeItemCount };
}

// ── HELPERS ──────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getAdjacentTileIds(tileId, tiles) {
  const t = tiles.find(x => x.id === tileId);
  if (!t) return [];
  return tiles
    .filter(o => !o.removed)
    .filter(o => {
      const dr = Math.abs(o.row - t.row), dc = Math.abs(o.col - t.col);
      return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    })
    .filter(o => {
      // Check wall blocking between t and o
      return !isWallBlocking(t, o);
    })
    .map(o => o.id);
}

function isWallBlocking(fromTile, toTile) {
  if (!fromTile.hasWalls) return false;
  const dr = toTile.row - fromTile.row;
  const dc = toTile.col - fromTile.col;
  // Wall sides relative to tile (pre-rotation): north, east, south, west
  // wallConfig is a bitmask: bit0=north, bit1=east, bit2=south, bit3=west
  const rot = (fromTile.wallRotation || 0);
  const sides = rotateWalls(fromTile.wallConfig || 0b0000, rot);
  // Check exit direction from fromTile
  if (dr === -1 && (sides & 0b0001)) return true; // north
  if (dc ===  1 && (sides & 0b0010)) return true; // east
  if (dr ===  1 && (sides & 0b0100)) return true; // south
  if (dc === -1 && (sides & 0b1000)) return true; // west
  return false;
}

function rotateWalls(config, rotation) {
  // rotation: 0=0°, 1=90°CW, 2=180°, 3=270°CW
  // Each 90° CW: N→E→S→W→N
  let c = config;
  for (let i = 0; i < (rotation % 4); i++) {
    // bit0(N) → bit1(E), bit1(E) → bit2(S), bit2(S) → bit3(W), bit3(W) → bit0(N)
    const n = (c & 0b0001) !== 0;
    const e = (c & 0b0010) !== 0;
    const s = (c & 0b0100) !== 0;
    const w = (c & 0b1000) !== 0;
    c = (w ? 0b0001 : 0) | (n ? 0b0010 : 0) | (e ? 0b0100 : 0) | (s ? 0b1000 : 0);
  }
  return c;
}

function getReachableTiles(startId, steps, tiles, throughWalls = false) {
  const visited = new Set([startId]);
  let frontier = [startId];
  for (let s = 0; s < steps; s++) {
    const next = [];
    frontier.forEach(tid => {
      const adj = throughWalls
        ? tiles.filter(o => !o.removed && o.id !== tid).filter(o => {
            const t = tiles.find(x => x.id === tid);
            const dr = Math.abs(o.row - t.row), dc = Math.abs(o.col - t.col);
            return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
          }).map(o => o.id)
        : getAdjacentTileIds(tid, tiles);
      adj.forEach(id => { if (!visited.has(id)) { visited.add(id); next.push(id); } });
    });
    frontier = next;
  }
  visited.delete(startId);
  return [...visited];
}
