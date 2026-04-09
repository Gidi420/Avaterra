// ============================================================
// data.js  –  All static game data for Avaterra
// ============================================================

// ── CHARACTERS ──────────────────────────────────────────────
const CHARACTERS = [
  {
    id: 'cyan', name: 'Cyan', lore: 'The Scout',
    hp: 30, damage: 3, actionsPerTurn: 4,
    combatCardCapacity: 5, itemCapacity: 5,
    color: '#00bcd4', hexColor: 0x00bcd4,
    abilityName: 'Veil-Step',
    abilityDesc: 'Spend 1 Action to move exactly 2 tiles through connected paths (walls still apply unless upgraded).',
    abilityType: 'active', abilityCost: { actions: 1 },
    limitation: 'Cannot cross walls or removed tiles without upgrade.',
    upgrades: [
      { id: 'swift_step',  tier: 1, name: 'Swift Step',   desc: '+1 Action per turn.',            cost: 3, effect: { actions: 1 } },
      { id: 'card_master', tier: 2, name: 'Card Mastery', desc: '+1 Combat Card Capacity.',        cost: 4, effect: { combatCardCap: 1 } },
      { id: 'phase_walk',  tier: 3, name: 'Spirit Walk',  desc: 'Veil-Step can now move through walls and removed tiles.', cost: 6, effect: { flag: 'throughWalls' } },
    ],
  },
  {
    id: 'indigo', name: 'Indigo', lore: 'The Tactician',
    hp: 27, damage: 3, actionsPerTurn: 4,
    combatCardCapacity: 5, itemCapacity: 5,
    color: '#5c6bc0', hexColor: 0x5c6bc0,
    abilityName: 'Mind-Link',
    abilityDesc: 'Discard 1 Combat Card to peek at an opponent\'s hand. They gain 1 resistance vs. you this round.',
    abilityType: 'active', abilityCost: { combatCards: 1 },
    limitation: 'Target gains 1 resistance against you for the round.',
    upgrades: [
      { id: 'clarity',    tier: 1, name: 'Clarity',           desc: '+1 Action per turn.',           cost: 3, effect: { actions: 1 } },
      { id: 'collector',  tier: 2, name: 'Collector',         desc: '+1 Item Capacity.',              cost: 4, effect: { itemCap: 1 } },
      { id: 'deep_probe', tier: 3, name: 'Greater Communion', desc: 'Mind-Link can now target two players for 1 Combat Card.', cost: 6, effect: { flag: 'twoTargets' } },
    ],
  },
  {
    id: 'gold', name: 'Gold', lore: 'The Rogue',
    hp: 33, damage: 2, actionsPerTurn: 4,
    combatCardCapacity: 5, itemCapacity: 5,
    color: '#ffd700', hexColor: 0xffd700,
    abilityName: 'Shadow-Plunder',
    abilityDesc: 'Discard 1 Combat Card to steal 1 random item from an opponent on your tile. On success, draw 1 Combat Card. Opponent may block.',
    abilityType: 'active', abilityCost: { combatCards: 1 },
    limitation: 'Opponents can block this ability.',
    upgrades: [
      { id: 'nimble',      tier: 1, name: 'Nimble',           desc: '+1 Action per turn.',      cost: 3, effect: { actions: 1 } },
      { id: 'brutality',   tier: 2, name: 'Brutality',        desc: '+1 Damage.',               cost: 4, effect: { damage: 1 } },
      { id: 'grand_theft', tier: 3, name: 'Grand Usurpation', desc: 'Shadow-Plunder now steals 2 random items.', cost: 6, effect: { flag: 'steals2' } },
    ],
  },
  {
    id: 'walnut', name: 'Walnut', lore: 'The Warrior',
    hp: 30, damage: 3, actionsPerTurn: 4,
    combatCardCapacity: 5, itemCapacity: 4,
    color: '#8d6e63', hexColor: 0x8d6e63,
    abilityName: 'Rites of Discipline',
    abilityDesc: 'Passive: Gain +1 XP from winning PvP combat and +1 XP from winning a hunt.',
    abilityType: 'passive', abilityCost: {},
    limitation: 'Gaining "Ascendant Mastery" upgrade reduces item capacity to 3.',
    upgrades: [
      { id: 'warriors_path', tier: 1, name: "Warrior's Path",    desc: '+1 Action per turn.',           cost: 3, effect: { actions: 1 } },
      { id: 'extra_slot',    tier: 2, name: 'Extra Slot',        desc: '+1 Combat Card Capacity.',       cost: 4, effect: { combatCardCap: 1 } },
      { id: 'berserker',     tier: 3, name: 'Ascendant Mastery', desc: 'Spend 2 XP at combat start for +1 Dmg or +1 Res (stackable). Item cap → 3.', cost: 6, effect: { flag: 'berserker', itemCapDelta: -1 } },
    ],
  },
  {
    id: 'red', name: 'Red', lore: 'The Vampire',
    hp: 25, damage: 3, actionsPerTurn: 4,
    combatCardCapacity: 5, itemCapacity: 4,
    color: '#f44336', hexColor: 0xf44336,
    abilityName: 'Sanguine Ritual',
    abilityDesc: 'Spend 2 Actions at the start of combat. If you win that combat, recover 2 HP.',
    abilityType: 'pre-combat', abilityCost: { actions: 2 },
    limitation: 'Cannot exceed starting Max HP. Small Potion gives 2 HP; Super Potion gives 4 HP.',
    upgrades: [
      { id: 'bloodlust',   tier: 1, name: 'Bloodlust',       desc: '+1 Combat Card Capacity.',   cost: 3, effect: { combatCardCap: 1 } },
      { id: 'vitality',    tier: 2, name: 'Vitality',        desc: '+1 Action per turn.',         cost: 4, effect: { actions: 1 } },
      { id: 'blood_feast', tier: 3, name: 'Blood Awakening', desc: 'Winning after Sanguine Ritual grants +1 Action this turn in addition to the 2 HP.', cost: 6, effect: { flag: 'bonusAction' } },
    ],
  },
  {
    id: 'green', name: 'Green', lore: 'The Marksman',
    hp: 30, damage: 2, actionsPerTurn: 4,
    combatCardCapacity: 5, itemCapacity: 4,
    color: '#4caf50', hexColor: 0x4caf50,
    abilityName: 'Seeking Arrow',
    abilityDesc: 'Spend 2 Actions to fire at a player on an adjacent tile for 4 damage. They may block but cannot counter.',
    abilityType: 'active', abilityCost: { actions: 2 },
    limitation: 'Takes +1 damage from close-range PvP attacks. Deals only 2 damage in close-range PvP.',
    upgrades: [
      { id: 'fleet_foot',   tier: 1, name: 'Fleet Foot',   desc: '+1 Action per turn.',                                     cost: 3, effect: { actions: 1 } },
      { id: 'precision',    tier: 2, name: 'Point-Blank',  desc: '+1 Damage to attacks on your current tile.',               cost: 4, effect: { flag: 'pointBlank' } },
      { id: 'pierce_arrow', tier: 3, name: 'Phantom Bolt', desc: 'Seeking Arrow can now fire through walls and target two opponents on the same tile at once.', cost: 6, effect: { flag: 'pierce' } },
    ],
  },
];

// ── TILE TYPES ───────────────────────────────────────────────
// Tile counts: forest×3, swamp×3, desert×3, meadow×3, mountains×2, frozen_tundra×2, city×2, tower×2, wasteland×2, cave×2 = 24
const TILE_TYPE_DATA = {
  // Standard terrains (3 each, huntable)
  forest:        { label: 'Forest',        color: 0x1a5c2a, textColor: '#7dff9b', icon: '🌲', hasMonsters: true,  desc: 'Spend 1 Action to Hunt a monster and earn an item.' },
  swamp:         { label: 'Swamp',         color: 0x1a3a30, textColor: '#66ffcc', icon: '🌿', hasMonsters: true,  desc: 'Spend 1 Action to Hunt a monster and earn an item.' },
  desert:        { label: 'Desert',        color: 0x7a5a20, textColor: '#ffe599', icon: '🏜', hasMonsters: true,  desc: 'Spend 1 Action to Hunt a monster and earn an item.' },
  meadow:        { label: 'Meadow',        color: 0x2a5c1a, textColor: '#ccff88', icon: '🌸', hasMonsters: true,  desc: 'Spend 1 Action to Hunt. Recover 1 HP at the start of your turn if standing here.' },
  // Special terrains
  mountains:     { label: 'Mountains',     color: 0x3a3a4a, textColor: '#aaaacc', icon: '⛰',  hasMonsters: false, desc: 'Must be drawn from the bag TWICE before it can be removed.' },
  frozen_tundra: { label: 'Frozen Tundra', color: 0x2a3a5c, textColor: '#aaccff', icon: '❄',  hasMonsters: false, desc: 'Lose 1 Action immediately when you move onto this tile.' },
  city:          { label: 'City',          color: 0x3a1a5c, textColor: '#cc88ff', icon: '🏙',  hasMonsters: false, desc: 'Pay 1 XP to enter. On rounds 7, 10, 13: entering grants a free item.' },
  tower:         { label: 'Magic Tower',   color: 0x8b6914, textColor: '#ffe066', icon: '🏛',  hasMonsters: false, desc: 'Spend 1 Action: teleport to other Tower, or heal 3 HP (once per game).' },
  wasteland:     { label: 'Wasteland',     color: 0x5c1a1a, textColor: '#ff6666', icon: '💀', hasMonsters: false, desc: 'Lose 1 HP immediately upon entering.' },
  cave:          { label: 'Cave',          color: 0x4a1a4a, textColor: '#ff88ff', icon: '🕳',  hasMonsters: false, desc: 'Discard 1 Combat Card of your choice upon entering.' },
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

// Tiles that always have walls (by type). Standard terrains: 1 of each type gets walls during init.
const ALWAYS_WALLED_TYPES = ['city', 'tower', 'wasteland', 'cave'];
const STANDARD_TERRAIN_TYPES = ['forest', 'swamp', 'desert', 'meadow'];

// Tile type distribution (shuffled at game start)
const TILE_TYPE_POOL = [
  'forest','forest','forest',
  'swamp','swamp','swamp',
  'desert','desert','desert',
  'meadow','meadow','meadow',
  'mountains','mountains',
  'frozen_tundra','frozen_tundra',
  'city','city',
  'tower','tower',
  'wasteland','wasteland',
  'cave','cave',
]; // 24 total

// ── ITEMS ────────────────────────────────────────────────────
const ITEMS = [
  // ── Bronze (6 types × 6 copies = 36) ───────────────────────
  { id: 'disarm',          tier: 'bronze', name: 'Disarm',          icon: '⚔',  desc: 'Force an opponent to discard 1 Combat Card of your choice.',                       timing: 'own_turn',  effect: 'mind_drain' },
  { id: 'small_potion',    tier: 'bronze', name: 'Small Potion',    icon: '🧪', desc: 'Restore 3 HP. (Red: only 2 HP).',                                                   timing: 'own_turn',  effect: 'heal',         value: 3 },
  { id: 'push',            tier: 'bronze', name: 'Push',            icon: '💥', desc: 'Push a player on your tile to any adjacent tile (ignores walls).',                  timing: 'own_turn',  effect: 'push' },
  { id: 'freestep',        tier: 'bronze', name: 'Freestep',        icon: '👟', desc: 'Move 1 space in any legal direction for free (no Action cost).',                    timing: 'own_turn',  effect: 'free_move' },
  { id: 'shield',          tier: 'bronze', name: 'Shield',          icon: '🛡', desc: 'Defensive: play when attacked to block the hit. Combat ends immediately, no damage.', timing: 'reaction', effect: 'shield',       defensive: true },
  { id: 'rotate_tile',     tier: 'bronze', name: 'Rotate Tile',     icon: '🔄', desc: 'Rotate a walled tile in any direction to change the board\'s paths.',              timing: 'own_turn',  effect: 'rotate_tile' },
  // ── Silver (9 types × 4 copies = 36) ───────────────────────
  { id: 'vandalism',       tier: 'silver', name: 'Vandalism',       icon: '🔨', desc: 'Destroy one of an opponent\'s items at random.',                                    timing: 'own_turn',  effect: 'destroy_item' },
  { id: 'peek',            tier: 'silver', name: 'Peek',            icon: '👁',  desc: 'Look at an opponent\'s Combat Card hand.',                                          timing: 'own_turn',  effect: 'peek_hand' },
  { id: 'damage_modifier', tier: 'silver', name: 'Damage Modifier', icon: '🗡',  desc: 'Add +2 Damage to your next successful attack.',                                    timing: 'own_turn',  effect: 'battle_surge', value: 2 },
  { id: 'growth',          tier: 'silver', name: 'Growth',          icon: '🌱', desc: 'Instantly gain 2 XP.',                                                              timing: 'own_turn',  effect: 'gain_xp',      value: 2 },
  { id: 'teleport',        tier: 'silver', name: 'Teleport',        icon: '🌀', desc: 'Move your character to any available tile on the board instantly.',                 timing: 'own_turn',  effect: 'teleport' },
  { id: 'swap_roles',      tier: 'silver', name: 'Swap Roles',      icon: '🔀', desc: 'Defensive: play when attacked to immediately swap roles and become the Attacker.',  timing: 'reaction',  effect: 'counter_stance', defensive: true },
  { id: 'armor',           tier: 'silver', name: 'Armor',           icon: '🧲', desc: 'Take -2 damage from all sources until the start of your next turn.',               timing: 'reaction',  effect: 'iron_armor',   value: 2, defensive: true },
  { id: 'long_range_strike',tier: 'silver',name: 'Long-Range Strike',icon: '🏹', desc: 'Attack an opponent 1 tile away. They cannot counter; can only block or take damage.', timing: 'own_turn', effect: 'ranged_attack' },
  { id: 'trash',           tier: 'silver', name: 'Trash',           icon: '⛏',  desc: 'Pick up any Bronze item from the discard pile.',                                   timing: 'own_turn',  effect: 'salvage' },
  // ── Gold (4 types × 3 copies = 12) ─────────────────────────
  { id: 'super_potion',    tier: 'gold',   name: 'Super Potion',    icon: '🔮', desc: 'Restore 6 HP. (Red: only 4 HP).',                                                   timing: 'own_turn',  effect: 'heal',         value: 6 },
  { id: 'kidnapping',      tier: 'gold',   name: 'Kidnapping',      icon: '🌪',  desc: 'Move an opponent from their current tile to any other tile on the board.',         timing: 'own_turn',  effect: 'displace' },
  { id: 'terrain_mod',     tier: 'gold',   name: 'Terrain Mod',     icon: '🗺',  desc: 'Remove a tile from the board OR restore a previously removed tile.',              timing: 'own_turn',  effect: 'world_shaper' },
  { id: 'stun',            tier: 'gold',   name: 'Stun',            icon: '⏱',  desc: "End an opponent's turn immediately (can be used on any player's turn).",         timing: 'reaction',  effect: 'time_stop' },
];

// IDs that get extra copies so totals match rulebook (bronze=36, silver=36, gold=12)
const ITEM_EXTRA_COPIES = {
  // Bronze: base 3, need 6 total → +3 each
  disarm: 3, small_potion: 3, push: 3, freestep: 3, shield: 3, rotate_tile: 3,
  // Silver: base 3, need 4 total → +1 each
  vandalism: 1, peek: 1, damage_modifier: 1, growth: 1, teleport: 1, swap_roles: 1, armor: 1, long_range_strike: 1, trash: 1,
  // Gold: base 2, need 3 total → +1 each
  super_potion: 1, kidnapping: 1, terrain_mod: 1, stun: 1,
};

function buildItemDeck() {
  const deck = [];
  let uid = 0;
  ITEMS.forEach(template => {
    const base = template.tier === 'bronze' ? 3 : template.tier === 'silver' ? 3 : 2;
    const copies = base + (ITEM_EXTRA_COPIES[template.id] || 0);
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
  const dr = toTile.row - fromTile.row;
  const dc = toTile.col - fromTile.col;
  // Check fromTile's exit side
  if (fromTile.hasWalls) {
    const sides = rotateWalls(fromTile.wallConfig || 0b0000, fromTile.wallRotation || 0);
    if (dr === -1 && (sides & 0b0001)) return true; // north exit
    if (dc ===  1 && (sides & 0b0010)) return true; // east exit
    if (dr ===  1 && (sides & 0b0100)) return true; // south exit
    if (dc === -1 && (sides & 0b1000)) return true; // west exit
  }
  // Check toTile's entry side (walls block both directions)
  if (toTile.hasWalls) {
    const sides = rotateWalls(toTile.wallConfig || 0b0000, toTile.wallRotation || 0);
    if (dr === -1 && (sides & 0b0100)) return true; // entering from south of toTile
    if (dc ===  1 && (sides & 0b1000)) return true; // entering from west of toTile
    if (dr ===  1 && (sides & 0b0001)) return true; // entering from north of toTile
    if (dc === -1 && (sides & 0b0010)) return true; // entering from east of toTile
  }
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
