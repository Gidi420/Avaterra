// ============================================================
// DebugPanel.js  –  God Mode sandbox for testing
// ============================================================

const DebugPanel = (() => {

  function toggle() {
    const panel = document.getElementById('debug-panel');
    if (!panel) return;
    const hidden = panel.classList.toggle('hidden');
    if (!hidden) _populate();
  }

  function _populate() {
    const s = GS.getState();
    if (!s) return;

    // Player selects
    ['dbg-player-sel', 'dbg-ability-player', 'dbg-stat-player'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = s.players.filter(p => p.alive).map(p =>
        `<option value="${p.id}">${p.name} (${(CHARACTERS.find(c=>c.id===p.characterId)||{}).name||p.characterId})</option>`
      ).join('');
    });

    // Tile select
    const tileSel = document.getElementById('dbg-tile-sel');
    if (tileSel) {
      tileSel.innerHTML = s.tiles.filter(t => !t.removed).map(t =>
        `<option value="${t.id}">${t.id}: ${t.type}</option>`
      ).join('');
    }

    // Terrain types
    const terrainSel = document.getElementById('dbg-terrain-sel');
    if (terrainSel) {
      const types = ['city','meadow','wasteland','frozen_tundra','cave','mountains','tower'];
      terrainSel.innerHTML = types.map(t => `<option value="${t}">${t}</option>`).join('');
    }
  }

  function spawnItem() {
    const s = GS.getState();
    if (!s) return;
    const playerId = parseInt(document.getElementById('dbg-player-sel').value);
    const tier     = document.getElementById('dbg-tier-sel').value;
    const player   = GS.getPlayer(playerId);
    if (!player) return;
    // Draw an item directly from the deck
    const deck = s.decks[tier];
    if (!deck || deck.length === 0) { alert(`No ${tier} items left in deck.`); return; }
    const item = deck.pop();
    if (player.items.length >= player.itemCap) {
      const old = player.items.shift();
      alert(`Inventory full — discarded ${old.name} to make room.`);
    }
    player.items.push(item);
    GS.emit('state_changed', s);
    GS.emit('log', `[DEBUG] Spawned ${item.name} (${tier}) for ${player.name}.`);
  }

  function swapTerrain() {
    const s = GS.getState();
    if (!s) return;
    const tileId  = parseInt(document.getElementById('dbg-tile-sel').value);
    const newType = document.getElementById('dbg-terrain-sel').value;
    const tile = s.tiles.find(t => t.id === tileId);
    if (!tile) return;
    const oldType = tile.type;
    tile.type = newType;
    GS.emit('state_changed', s);
    GS.emit('tile_removed', { tileId }); // force GameScene refresh
    GS.emit('log', `[DEBUG] Tile ${tileId} changed from ${oldType} → ${newType}.`);
  }

  function triggerAbility() {
    const s = GS.getState();
    if (!s) return;
    const playerId = parseInt(document.getElementById('dbg-ability-player').value);
    const player   = GS.getPlayer(playerId);
    if (!player) return;
    const charId = player.characterId;
    GS.emit('log', `[DEBUG] Triggering ability for ${player.name} (${charId}).`);
    if (charId === 'cyan')   GS.beginVeilStep();
    else if (charId === 'green')  GS.beginSeekingArrow();
    else if (charId === 'indigo') GS.beginMindLink();
    else if (charId === 'walnut') GS.activateBerserker();
    else if (charId === 'red')    GS.activateSanguineRitual();
    else GS.emit('error', 'No ability defined for this character in debug mode.');
  }

  function setStat() {
    const s = GS.getState();
    if (!s) return;
    const playerId = parseInt(document.getElementById('dbg-stat-player').value);
    const statType = document.getElementById('dbg-stat-type').value;
    const val      = parseInt(document.getElementById('dbg-stat-val').value);
    const player   = GS.getPlayer(playerId);
    if (!player || isNaN(val)) return;
    if (statType === 'hp') {
      player.hp = Math.min(val, player.maxHp);
    } else if (statType === 'xp') {
      player.xp = val;
    } else if (statType === 'ap') {
      player.actionsLeft = val;
    }
    GS.emit('state_changed', s);
    GS.emit('log', `[DEBUG] Set ${player.name}'s ${statType.toUpperCase()} to ${val}.`);
  }

  return { toggle, spawnItem, swapTerrain, triggerAbility, setStat };
})();
