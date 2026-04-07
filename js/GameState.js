// ============================================================
// GameState.js  –  Central game logic for Avaterra
// All game rules live here; no DOM/Phaser calls.
// Communicates out via GS.emit(event, data).
// ============================================================

const GS = (() => {
  // ── State ─────────────────────────────────────────────────
  let state = null;
  const listeners = {};

  // ── Event bus ─────────────────────────────────────────────
  function on(event, fn)  { (listeners[event] = listeners[event] || []).push(fn); }
  function emit(event, data) { (listeners[event] || []).forEach(fn => fn(data)); }

  // ── Accessors ─────────────────────────────────────────────
  function getState()  { return state; }
  function currentPlayer() { return state.players[state.currentPlayerIndex]; }
  function getPlayer(id)   { return state.players.find(p => p.id === id); }
  function getTile(id)     { return state.tiles.find(t => t.id === id); }

  // ── Setup ─────────────────────────────────────────────────
  function init(playerSetups) {
    // playerSetups: [{name, characterId}, ...]
    const types = shuffle([...TILE_TYPE_POOL]);
    const tiles = TILE_LAYOUT.map((pos, i) => {
      const type = types[i];
      const isWalled = WALLED_TILE_IDS.includes(pos.id);
      return {
        ...pos,
        type,
        hasWalls:     isWalled,
        wallConfig:   isWalled ? 0b0101 : 0, // default: north+south walls
        wallRotation: isWalled ? Math.floor(Math.random() * 4) : 0,
        removed:      false,
        drawCount:    0, // for fortress tiles
        hasMonster:   type === 'forest',
      };
    });

    // Build decks
    const bronzeItems = buildItemDeck().filter(i => i.tier === 'bronze');
    const silverItems = buildItemDeck().filter(i => i.tier === 'silver');
    const goldItems   = buildItemDeck().filter(i => i.tier === 'gold');
    const combatDeck  = buildCombatDeck();

    // Terrain chips bag: tile IDs shuffled
    const terrainBag = shuffle(tiles.map(t => t.id));

    // Create players
    const players = playerSetups.map((setup, idx) => {
      const char = CHARACTERS.find(c => c.id === setup.characterId);
      return {
        id:             idx,
        name:           setup.name,
        characterId:    char.id,
        hp:             char.hp,
        maxHp:          char.hp,
        damage:         char.damage,
        actionsPerTurn: char.actionsPerTurn,
        actionsLeft:    char.actionsPerTurn,
        combatCardCap:  char.combatCardCapacity,
        itemCap:        char.itemCapacity,
        xp:             0,
        resistance:     0,
        tileId:         null,   // set after placing
        combatCards:    [],
        items:          [],
        upgrades:       [],
        flags:          {},     // ability flags from upgrades
        towerUsed:      false,
        alive:          true,
        bonusDamageNext: 0,     // from Battle Surge / similar
        armorReduction: 0,      // active armor item
        sanguineActive: false,  // Vesper ritual this combat
      };
    });

    // Place players on random tiles (each on a different tile)
    const startTiles = shuffle(tiles.map(t => t.id)).slice(0, players.length);
    players.forEach((p, i) => { p.tileId = startTiles[i]; });

    // Deal starting combat cards (5 each)
    let deck = [...combatDeck];
    players.forEach(p => {
      p.combatCards = deck.splice(0, Math.min(p.combatCardCap, 5));
    });

    // Draw initial terrain chip
    const firstChip = terrainBag.pop();

    state = {
      phase:        'game',
      subphase:     'action_select', // action_select | move | target_select | combat | hunt | ability | upgrade | item_use | interact
      round:        1,
      currentPlayerIndex: 0,
      players,
      tiles,
      terrainBag,
      scheduledRemoval: [firstChip], // drawn chips → remove at END of current round / START of next
      fortressDrawn: {},             // tileId → true if drawn once already
      decks: {
        bronze:        bronzeItems,
        silver:        silverItems,
        gold:          goldItems,
        bronzeDiscard: [],
        silverDiscard: [],
        goldDiscard:   [],
        combat:        deck,
        combatDiscard: [],
      },
      combat: null,   // active combat state (see initiateCombat)
      pendingAction: null,
      log: [],
      freeItemTileId: null, // which tile has free item this round
    };

    _checkFreeItemRound();
    _drawCombatCardsForPlayer(currentPlayer());
    emit('state_changed', state);
    emit('log', `Round 1 begins. ${currentPlayer().name}'s turn. (${currentPlayer().actionsLeft} actions)`);
    emit('phase_changed', { subphase: 'action_select' });
  }

  // ── Round management ──────────────────────────────────────
  function _endTurnCleanup(player) {
    // Reset per-turn flags
    player.resistance = 0;
    player.armorReduction = 0;
    player.sanguineActive = false;
  }

  function endTurn() {
    const p = currentPlayer();
    _endTurnCleanup(p);
    emit('log', `${p.name} ends their turn.`);

    // Find next alive player
    let next = (state.currentPlayerIndex + 1) % state.players.length;
    let loops = 0;
    while (!state.players[next].alive) {
      next = (next + 1) % state.players.length;
      if (++loops > state.players.length) break;
    }

    // Check if round over (looped back to lowest index or first alive)
    const alive = state.players.filter(p => p.alive);
    if (alive.length <= 1) { _endGame(); return; }

    if (next <= state.currentPlayerIndex && alive.length > 1) {
      // New round
      _endRound();
      return;
    }

    state.currentPlayerIndex = next;
    _startPlayerTurn(currentPlayer());
  }

  function _startPlayerTurn(player) {
    player.actionsLeft = player.actionsPerTurn;
    _drawCombatCardsForPlayer(player);
    // Meadow: heal 1 HP at start of turn
    const standingTile = getTile(player.tileId);
    if (standingTile && standingTile.type === 'meadow' && !standingTile.removed) {
      player.hp = Math.min(player.maxHp, player.hp + 1);
      emit('log', `${player.name} rests in the Meadow and heals 1 HP.`);
    }
    state.subphase = 'action_select';
    emit('state_changed', state);
    emit('log', `${player.name}'s turn begins (${player.actionsLeft} actions).`);
    emit('phase_changed', { subphase: 'action_select' });
  }

  function _endRound() {
    // Remove terrain marked from previous draw
    const toRemove = [...state.scheduledRemoval];
    toRemove.forEach(tileId => _removeTile(tileId));
    state.scheduledRemoval = [];

    state.round++;
    emit('log', `--- Round ${state.round} begins ---`);

    const disaster = getDisasterForRound(state.round);

    // Draw chips for this round's removal
    for (let i = 0; i < disaster.remove; i++) {
      if (state.terrainBag.length === 0) break;
      let chipId = state.terrainBag.pop();
      // Fortress: must be drawn twice
      const tile = getTile(chipId);
      if (tile && tile.type === 'fortress' && !state.fortressDrawn[chipId]) {
        state.fortressDrawn[chipId] = true;
        // Put back and draw another
        state.terrainBag.unshift(chipId);
        chipId = state.terrainBag.length > 1 ? state.terrainBag.pop() : chipId;
      }
      const alreadyRemoved = getTile(chipId) && getTile(chipId).removed;
      if (!alreadyRemoved) state.scheduledRemoval.push(chipId);
    }

    _checkFreeItemRound();

    // Find first alive player
    const first = state.players.find(p => p.alive);
    if (!first) { _endGame(); return; }
    state.currentPlayerIndex = state.players.indexOf(first);

    emit('state_changed', state);
    emit('round_changed', { round: state.round, scheduledRemoval: state.scheduledRemoval });
    _startPlayerTurn(currentPlayer());
  }

  function _removeTile(tileId) {
    const tile = getTile(tileId);
    if (!tile || tile.removed) return;
    tile.removed = true;
    emit('log', `Tile ${tileId} (${tile.type}) has been removed from the board!`);
    emit('tile_removed', { tileId });
    // Kill players on removed tile
    state.players.forEach(p => {
      if (p.alive && p.tileId === tileId) {
        emit('log', `${p.name} was on removed tile and is eliminated!`);
        _killPlayer(p, null);
      }
    });
  }

  function _checkFreeItemRound() {
    const d = getDisasterForRound(state.round);
    state.freeItemRound = d.freeItemCount > 0;
    state.freeItemTier  = d.freeItemTier;
    state.freeItemCount = d.freeItemCount;
    if (state.freeItemRound) {
      // Mark vault/specific tile as having free item
      const vaults = state.tiles.filter(t => t.type === 'vault' && !t.removed);
      if (vaults.length > 0) state.freeItemTileId = vaults[0].id;
    }
  }

  // ── Drawing cards ─────────────────────────────────────────
  function _drawCombatCardsForPlayer(player, count) {
    const needed = count !== undefined ? count : (player.combatCardCap - player.combatCards.length);
    for (let i = 0; i < needed; i++) {
      if (state.decks.combat.length === 0) {
        if (state.decks.combatDiscard.length === 0) break;
        state.decks.combat = shuffle(state.decks.combatDiscard);
        state.decks.combatDiscard = [];
      }
      player.combatCards.push(state.decks.combat.pop());
    }
  }

  function actionDrawCards(xpAmount) {
    // Spend 1 AP + xpAmount XP to draw xpAmount cards
    const p = currentPlayer();
    if (p.actionsLeft < 1) { emit('error', 'Not enough actions.'); return; }
    if (p.xp < xpAmount)    { emit('error', 'Not enough XP.'); return; }
    const space = p.combatCardCap - p.combatCards.length;
    if (space === 0)         { emit('error', 'Combat card hand is already full.'); return; }
    const draw = Math.min(xpAmount, space);
    p.actionsLeft -= 1;
    p.xp -= draw;
    _drawCombatCardsForPlayer(p, draw);
    emit('log', `${p.name} spends 1 Action + ${draw} XP to draw ${draw} combat card(s).`);
    emit('state_changed', state);
    emit('phase_changed', { subphase: 'action_select' });
  }

  // ── Move action ───────────────────────────────────────────
  function beginMove() {
    const p = currentPlayer();
    if (p.actionsLeft < 1) { emit('error', 'Not enough actions.'); return; }
    state.subphase = 'move';
    const adj = getAdjacentTileIds(p.tileId, state.tiles);
    emit('phase_changed', { subphase: 'move', validTiles: adj });
  }

  function commitMove(tileId) {
    const p = currentPlayer();
    if (state.subphase !== 'move') return;
    const adj = getAdjacentTileIds(p.tileId, state.tiles);
    if (!adj.includes(tileId)) { emit('error', 'Cannot move there.'); return; }

    p.actionsLeft -= 1;
    const prevTile = p.tileId;
    p.tileId = tileId;
    emit('log', `${p.name} moves to tile ${tileId} (${getTile(tileId).type}).`);
    emit('player_moved', { playerId: p.id, fromTile: prevTile, toTile: tileId });

    _applyTileEffect(p, getTile(tileId));
    _checkAlive(p);

    state.subphase = 'action_select';
    emit('state_changed', state);
    emit('phase_changed', { subphase: 'action_select' });
  }

  function _applyTileEffect(player, tile) {
    if (!tile || tile.removed) return;
    switch (tile.type) {
      case 'swamp':
        if (player.actionsLeft > 0) {
          player.actionsLeft = Math.max(0, player.actionsLeft - 1);
          emit('log', `${player.name} enters swamp and loses 1 Action.`);
        }
        break;
      case 'vault':
        if (state.freeItemRound && tile.id === state.freeItemTileId) {
          for (let i = 0; i < state.freeItemCount; i++) {
            const item = _drawItem(state.freeItemTier);
            if (item) _giveItem(player, item);
          }
          emit('log', `${player.name} receives ${state.freeItemCount} free item(s) from the Vault!`);
          state.freeItemRound = false; // consumed
        } else {
          // Must pay 1 XP
          if (player.xp < 1) {
            emit('log', `${player.name} cannot afford the Vault entry cost (1 XP). Moving back is not allowed in this phase.`);
          } else {
            player.xp -= 1;
            emit('log', `${player.name} pays 1 XP to enter the Vault.`);
          }
        }
        break;
      case 'lava':
        _dealDamage(player, null, 1);
        emit('log', `${player.name} takes 1 damage from Lava!`);
        break;
      case 'desert':
        if (player.actionsLeft > 0) {
          player.actionsLeft = Math.max(0, player.actionsLeft - 1);
          emit('log', `${player.name} struggles through the Desert heat. Loses 1 Action.`);
        }
        break;
      case 'meadow':
        // Meadow heals at turn start (handled in _startPlayerTurn)
        emit('log', `${player.name} enters a peaceful Meadow.`);
        break;
      case 'curse':
        const discard = Math.min(2, player.combatCards.length);
        // For hotseat, auto-discard first N cards
        for (let i = 0; i < discard; i++) {
          const card = player.combatCards.pop();
          if (card) state.decks.combatDiscard.push(card);
        }
        if (discard > 0) emit('log', `${player.name} discards ${discard} combat card(s) from the Cursed tile.`);
        break;
    }
  }

  // ── Veil-Step ability (Zephyr) ────────────────────────────
  function beginVeilStep() {
    const p = currentPlayer();
    if (p.characterId !== 'zephyr') { emit('error', 'Only Zephyr can use Veil-Step.'); return; }
    if (p.actionsLeft < 1) { emit('error', 'Not enough actions.'); return; }
    const throughWalls = p.flags.throughWalls || false;
    const reachable = getReachableTiles(p.tileId, 2, state.tiles, throughWalls);
    state.subphase = 'ability';
    state.pendingAction = { type: 'veil_step' };
    emit('phase_changed', { subphase: 'ability', abilityName: 'Veil-Step', validTiles: reachable });
  }

  function commitVeilStep(tileId) {
    const p = currentPlayer();
    const throughWalls = p.flags.throughWalls || false;
    const reachable = getReachableTiles(p.tileId, 2, state.tiles, throughWalls);
    if (!reachable.includes(tileId)) { emit('error', 'Cannot Veil-Step there.'); return; }

    p.actionsLeft -= 1;
    const prev = p.tileId;
    p.tileId = tileId;
    emit('log', `${p.name} uses Veil-Step to jump to tile ${tileId}.`);
    emit('player_moved', { playerId: p.id, fromTile: prev, toTile: tileId });
    _applyTileEffect(p, getTile(tileId));
    _checkAlive(p);
    state.subphase = 'action_select';
    state.pendingAction = null;
    emit('state_changed', state);
    emit('phase_changed', { subphase: 'action_select' });
  }

  // ── Seeking Arrow (Soren) ─────────────────────────────────
  function beginSeekingArrow() {
    const p = currentPlayer();
    if (p.characterId !== 'soren') { emit('error', 'Only Soren can use Seeking Arrow.'); return; }
    if (p.actionsLeft < 2) { emit('error', 'Seeking Arrow costs 2 Actions.'); return; }
    const pierce = p.flags.pierce || false;
    const adjTiles = getAdjacentTileIds(p.tileId, state.tiles);
    const targets = state.players.filter(t =>
      t.alive && t.id !== p.id && adjTiles.includes(t.tileId)
    );
    if (targets.length === 0) { emit('error', 'No targets in range.'); return; }
    state.subphase = 'ability';
    state.pendingAction = { type: 'seeking_arrow' };
    emit('phase_changed', { subphase: 'ability', abilityName: 'Seeking Arrow', targets: targets.map(t => t.id) });
  }

  function commitSeekingArrow(targetId) {
    const p = currentPlayer();
    const target = getPlayer(targetId);
    if (!target || !target.alive) return;
    p.actionsLeft -= 2;

    // Special combat: attacker fires arrow for 4 damage. Defender can only block, not counter.
    emit('log', `${p.name} fires a Seeking Arrow at ${target.name} for 4 damage!`);
    state.combat = {
      type:       'seeking_arrow',
      attackerId: p.id,
      defenderId: targetId,
      round:      1,
      arrowDamage: 4 + (p.bonusDamageNext || 0),
      attackerCard: null,
      defenderCard: null,
      attackerPhase: true,
      defenderPhase: false,
    };
    p.bonusDamageNext = 0;
    state.subphase = 'combat';
    emit('state_changed', state);
    // If defender has no cards, resolve immediately
    if (target.combatCards.length === 0) {
      _resolveSeekingArrow();
      return;
    }
    // Attacker picks which of defender's cards to destroy / block with
    emit('combat_start', { ...state.combat, defenderHand: target.combatCards });
  }

  // ── Mind-Link (Lyra) ─────────────────────────────────────
  function beginMindLink() {
    const p = currentPlayer();
    if (p.characterId !== 'lyra') { emit('error', 'Only Lyra can use Mind-Link.'); return; }
    if (p.combatCards.length < 1) { emit('error', 'No combat cards to spend.'); return; }
    const twoTargets = p.flags.twoTargets || false;
    const otherPlayers = state.players.filter(t => t.alive && t.id !== p.id);
    if (otherPlayers.length === 0) { emit('error', 'No opponents.'); return; }
    state.subphase = 'ability';
    state.pendingAction = { type: 'mind_link', twoTargets };
    emit('phase_changed', { subphase: 'ability', abilityName: 'Mind-Link', targets: otherPlayers.map(t => t.id), twoTargets });
  }

  function commitMindLink(targetIds) {
    const p = currentPlayer();
    const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
    // Discard 1 combat card
    const card = p.combatCards.pop();
    state.decks.combatDiscard.push(card);
    // Reveal hand(s)
    const reveals = ids.map(id => ({ playerId: id, hand: getPlayer(id).combatCards }));
    // Apply resistance penalty
    ids.forEach(id => { getPlayer(id).resistance = (getPlayer(id).resistance || 0) + 1; });
    emit('log', `${p.name} uses Mind-Link on ${ids.map(id => getPlayer(id).name).join(', ')}.`);
    emit('mind_link_reveal', { reveals });
    state.subphase = 'action_select';
    state.pendingAction = null;
    emit('state_changed', state);
    emit('phase_changed', { subphase: 'action_select' });
  }

  // ── Shadow-Plunder (Kael) ─────────────────────────────────
  function beginShadowPlunder() {
    const p = currentPlayer();
    if (p.characterId !== 'kael') { emit('error', 'Only Kael can use Shadow-Plunder.'); return; }
    if (p.combatCards.length < 1) { emit('error', 'No combat cards to spend.'); return; }
    const targets = state.players.filter(t => t.alive && t.id !== p.id && t.tileId === p.tileId && t.items.length > 0);
    if (targets.length === 0) { emit('error', 'No opponents with items on your tile.'); return; }
    state.subphase = 'ability';
    state.pendingAction = { type: 'shadow_plunder' };
    emit('phase_changed', { subphase: 'ability', abilityName: 'Shadow-Plunder', targets: targets.map(t => t.id) });
  }

  function commitShadowPlunder(targetId) {
    const p  = currentPlayer();
    const tgt = getPlayer(targetId);
    // Discard 1 combat card
    const card = p.combatCards.pop();
    state.decks.combatDiscard.push(card);

    // Target can "block" – for now: if target has a combat card, they may spend it to block
    // In hotseat: prompt target player
    state.pendingAction = { type: 'shadow_plunder_block', attackerId: p.id, defenderId: targetId };
    emit('shadow_plunder_prompt', { attackerId: p.id, defenderId: targetId, targetName: tgt.name });
  }

  function resolveShadowPlunder(blocked) {
    const { attackerId, defenderId } = state.pendingAction;
    const attacker = getPlayer(attackerId);
    const defender = getPlayer(defenderId);
    state.pendingAction = null;

    if (blocked && defender.combatCards.length > 0) {
      const card = defender.combatCards.pop();
      state.decks.combatDiscard.push(card);
      emit('log', `${defender.name} blocks Shadow-Plunder!`);
    } else {
      const steals = attacker.flags.steals2 ? 2 : 1;
      for (let i = 0; i < steals && defender.items.length > 0; i++) {
        const idx = Math.floor(Math.random() * defender.items.length);
        const item = defender.items.splice(idx, 1)[0];
        _giveItem(attacker, item);
        emit('log', `${attacker.name} steals ${item.name} from ${defender.name}!`);
      }
      // Draw 1 combat card on success
      _drawCombatCardsForPlayer(attacker, 1);
    }
    state.subphase = 'action_select';
    emit('state_changed', state);
    emit('phase_changed', { subphase: 'action_select' });
  }

  // ── Sanguine Ritual (Vesper) ──────────────────────────────
  function activateSanguineRitual() {
    const p = currentPlayer();
    if (p.characterId !== 'vesper') { emit('error', 'Only Vesper can use Sanguine Ritual.'); return; }
    if (p.actionsLeft < 2) { emit('error', 'Sanguine Ritual costs 2 Actions.'); return; }
    p.actionsLeft -= 2;
    p.sanguineActive = true;
    emit('log', `${p.name} activates Sanguine Ritual! (+2 HP if combat won)`);
    emit('state_changed', state);
  }

  // ── Berserker activation (Mason) ─────────────────────────
  function activateBerserker(choice) {
    // choice: 'damage' | 'resistance'
    const p = currentPlayer();
    if (!p.flags.berserker) { emit('error', 'Berserker not unlocked.'); return; }
    if (p.xp < 2) { emit('error', 'Need 2 XP.'); return; }
    p.xp -= 2;
    if (choice === 'damage')     { p.damage += 1; emit('log', `${p.name} spends 2 XP for +1 Damage.`); }
    else                         { p.resistance += 1; emit('log', `${p.name} spends 2 XP for +1 Resistance.`); }
    emit('state_changed', state);
  }

  // ── Hunt (PvM) ────────────────────────────────────────────
  function beginHunt() {
    const p = currentPlayer();
    if (p.actionsLeft < 1)  { emit('error', 'Not enough actions.'); return; }
    const tile = getTile(p.tileId);
    if (!tile.hasMonster) { emit('error', 'No monsters on this tile.'); return; }
    state.subphase = 'combat';
    state.combat = {
      type:          'hunt',
      attackerId:    p.id,
      defenderId:    null,
      round:         1,
      maxRounds:     3,
      attackerCard:  null,
      monsterRoll:   null,
      phase:         'attacker_select', // attacker_select | monster_roll | resolve | counter_choice
    };
    p.actionsLeft -= 1;
    emit('log', `${p.name} hunts a monster!`);
    emit('state_changed', state);
    emit('combat_start', state.combat);
  }

  // ── PvP Combat ────────────────────────────────────────────
  function beginAttack() {
    const p = currentPlayer();
    if (p.actionsLeft < 1) { emit('error', 'Not enough actions.'); return; }
    const targets = state.players.filter(t => t.alive && t.id !== p.id && t.tileId === p.tileId);
    if (targets.length === 0) { emit('error', 'No opponents on your tile.'); return; }
    state.subphase = 'target_select';
    emit('phase_changed', { subphase: 'target_select', targets: targets.map(t => t.id) });
  }

  function commitAttack(targetId) {
    const p   = currentPlayer();
    const tgt = getPlayer(targetId);
    if (!tgt || !tgt.alive || tgt.tileId !== p.tileId) { emit('error', 'Invalid target.'); return; }

    // Emergency draw for defender with 0 cards
    if (tgt.combatCards.length === 0 && tgt.xp >= 1) {
      // Will be handled in UI (prompt defender before combat starts)
      emit('emergency_draw_prompt', { defenderId: targetId });
      state.pendingAction = { type: 'pvp_start', attackerId: p.id, defenderId: targetId };
      return;
    }

    _startPvP(p.id, targetId);
  }

  function resolveEmergencyDraw(accept) {
    if (!state.pendingAction || state.pendingAction.type !== 'pvp_start') return;
    const { attackerId, defenderId } = state.pendingAction;
    state.pendingAction = null;
    if (accept) {
      const def = getPlayer(defenderId);
      def.xp -= 1;
      _drawCombatCardsForPlayer(def, 1);
      emit('log', `${def.name} spends 1 XP to draw 1 combat card for defense.`);
    }
    _startPvP(attackerId, defenderId);
  }

  function _startPvP(attackerId, defenderId) {
    const atk = getPlayer(attackerId);
    atk.actionsLeft -= 1;
    state.combat = {
      type:         'pvp',
      attackerId,
      defenderId,
      round:        1,
      maxRounds:    3,
      attackerCard: null,
      defenderCard: null,
      phase:        'attacker_select',  // attacker_select | defender_select | reveal | counter_choice
      sanguineActive: atk.sanguineActive,
    };
    atk.sanguineActive = false;
    state.subphase = 'combat';
    emit('log', `${atk.name} attacks ${getPlayer(defenderId).name}!`);
    emit('state_changed', state);
    emit('combat_start', state.combat);
  }

  function selectCombatCard(playerId, cardUid) {
    const c = state.combat;
    if (!c) return;

    if (c.type === 'hunt') {
      if (c.phase !== 'attacker_select') return;
      c.attackerCard = cardUid;
      c.phase = 'monster_roll';
      emit('combat_update', c);
      return;
    }

    if (c.type === 'seeking_arrow') {
      // Attacker picks which card from defender's hand to destroy (blocking arrow), or null for full damage
      if (playerId !== c.attackerId) return;
      if (cardUid !== null) {
        const def = getPlayer(c.defenderId);
        const cardExists = def.combatCards.find(x => x.uid === cardUid);
        if (!cardExists) return; // invalid card uid
      }
      c.defenderCard = cardUid; // null = no block
      _resolveSeekingArrow();
      return;
    }

    if (c.type === 'pvp') {
      if (c.phase === 'attacker_select' && playerId === c.attackerId) {
        c.attackerCard = cardUid;
        c.phase = 'defender_select';
        emit('combat_update', c);
      } else if (c.phase === 'defender_select' && playerId === c.defenderId) {
        c.defenderCard = cardUid;
        c.phase = 'reveal';
        emit('combat_update', c);
        // Auto-resolve after brief delay
        _resolvePvPRound();
      }
    }
  }

  function rollMonsterDie() {
    if (!state.combat || state.combat.type !== 'hunt') return;
    const c = state.combat;
    const faces = ['slash','slash','smash','smash','jab','jab'];
    c.monsterRoll = faces[Math.floor(Math.random() * 6)];
    c.phase = 'reveal';
    emit('combat_update', c);
    _resolveHuntRound();
  }

  function _resolveHuntRound() {
    const c    = state.combat;
    const atk  = getPlayer(c.attackerId);
    const atkCard = atk.combatCards.find(x => x.uid === c.attackerCard);

    if (!atkCard) { _endCombat(false); return; }

    // Remove attacker's card from hand
    atk.combatCards = atk.combatCards.filter(x => x.uid !== c.attackerCard);
    state.decks.combatDiscard.push(atkCard);

    if (atkCard.type !== c.monsterRoll) {
      // Player wins
      emit('log', `${atk.name} wins the hunt! Gains 1 item.`);
      const item = _drawItem('bronze');
      if (item) _giveItem(atk, item);
      // Mason gains XP
      if (atk.characterId === 'mason') { atk.xp += 1; emit('log', `${atk.name}'s Battle Hunger: +1 XP`); }
      _endCombat(true);
    } else {
      // Monster counters
      if (c.round >= c.maxRounds || atk.combatCards.length === 0) {
        emit('log', `Monster blocks! Hunt ends.`);
        _endCombat(false);
      } else {
        c.round++;
        // Now player defends (roles swap: monster attacks, player must match to block)
        c.phase = 'attacker_select';
        c.attackerCard = null;
        c.monsterRoll  = null;
        emit('log', `Monster counters! Round ${c.round}.`);
        emit('combat_update', c);
      }
    }
  }

  function _resolvePvPRound() {
    const c    = state.combat;
    const atk  = getPlayer(c.attackerId);
    const def  = getPlayer(c.defenderId);
    const atkCard = atk.combatCards.find(x => x.uid === c.attackerCard);
    const defCard = def.combatCards.find(x => x.uid === c.defenderCard);

    if (!atkCard || !defCard) {
      if (atkCard && !defCard) {
        // Defender concedes (no card) — attacker wins by default
        atk.xp += 1;
        if (atk.characterId === 'mason') { atk.xp += 1; emit('log', `${atk.name}'s Battle Hunger: +1 XP`); }
        emit('log', `${def.name} has no combat card — ${atk.name} wins by default! +1 XP`);
      }
      _endCombat(false);
      return;
    }

    // Remove from hands
    atk.combatCards = atk.combatCards.filter(x => x.uid !== c.attackerCard);
    def.combatCards = def.combatCards.filter(x => x.uid !== c.defenderCard);
    state.decks.combatDiscard.push(atkCard, defCard);

    if (atkCard.type !== defCard.type) {
      // Attacker wins
      const dmg = Math.max(0, atk.damage + (atk.bonusDamageNext || 0) - (def.resistance || 0) - (def.armorReduction || 0));
      atk.bonusDamageNext = 0;
      atk.xp += 1;
      if (atk.characterId === 'mason') { atk.xp += 1; emit('log', `${atk.name}'s Battle Hunger: +1 XP`); }
      if (c.sanguineActive || atk.sanguineActive) {
        // Heal on win
        atk.hp = Math.min(atk.maxHp, atk.hp + 2);
        if (atk.flags.bonusAction) atk.actionsLeft += 1;
        emit('log', `${atk.name}'s Sanguine Ritual pays off! +2 HP`);
      }
      emit('log', `${atk.name} wins the round! ${def.name} takes ${dmg} damage.`);
      _dealDamage(def, atk, dmg);
      _checkAlive(def);
      _endCombat(true, true);
    } else {
      // Defender blocks
      emit('log', `${def.name} blocks! Round tie.`);
      if (c.round >= c.maxRounds) {
        emit('log', 'Combat ends — 3-round limit reached.');
        _endCombat(false);
      } else {
        c.phase = 'counter_choice';
        emit('combat_update', c);
        emit('counter_choice_prompt', { defenderId: c.defenderId });
      }
    }
  }

  function defenderCounterChoice(choice) {
    const c = state.combat;
    if (!c || c.phase !== 'counter_choice') return;
    if (choice === 'retreat') {
      emit('log', `${getPlayer(c.defenderId).name} retreats. Combat ends.`);
      _endCombat(false);
    } else {
      // Counter: swap roles
      const tmp = c.attackerId;
      c.attackerId = c.defenderId;
      c.defenderId = tmp;
      c.round++;
      c.attackerCard = null;
      c.defenderCard = null;
      c.phase = 'attacker_select';
      emit('log', `${getPlayer(c.attackerId).name} counter-attacks! Round ${c.round}.`);
      emit('combat_update', c);
    }
  }

  function _resolveSeekingArrow() {
    const c   = state.combat;
    const atk = getPlayer(c.attackerId);
    const def = getPlayer(c.defenderId);
    const defCard = def.combatCards.find(x => x.uid === c.defenderCard);

    if (!defCard) {
      // Defender has no card → takes full damage
      emit('log', `${def.name} cannot block! Takes ${c.arrowDamage} damage.`);
      _dealDamage(def, atk, c.arrowDamage);
      _checkAlive(def);
    } else {
      def.combatCards = def.combatCards.filter(x => x.uid !== c.defenderCard);
      state.decks.combatDiscard.push(defCard);
      // Defender blocks if they play any card (Seeking Arrow can't be countered)
      emit('log', `${def.name} blocks the Seeking Arrow!`);
    }
    _endCombat(false);
  }

  function _endCombat(attackerWon, defenderDead) {
    const c   = state.combat;
    if (!c) return;

    if (defenderDead) {
      // Check if defender was actually killed
      const def = getPlayer(c.defenderId);
      if (def && !def.alive) {
        _onPlayerKilled(getPlayer(c.attackerId), def);
      }
    }
    state.combat    = null;
    state.subphase  = 'action_select';
    state.pendingAction = null;
    emit('combat_end', { attackerWon });
    emit('state_changed', state);
    emit('phase_changed', { subphase: 'action_select' });
  }

  function _dealDamage(target, source, amount) {
    if (!target || !target.alive) return;
    target.hp -= amount;
    emit('damage_dealt', { targetId: target.id, amount });
    if (target.hp <= 0) {
      target.hp = 0;
      _killPlayer(target, source);
    }
  }

  function _killPlayer(player, killer) {
    player.alive = false;
    emit('log', `${player.name} has been eliminated!`);
    emit('player_eliminated', { playerId: player.id });
    const alive = state.players.filter(p => p.alive);
    if (alive.length === 1) _endGame();
  }

  function _onPlayerKilled(killer, victim) {
    // Killer takes victim's items (up to 3)
    const itemsToTake = Math.max(0, 3 - killer.items.length);
    const taken = victim.items.splice(0, itemsToTake);
    taken.forEach(item => _giveItem(killer, item));
    // Fill remaining from deck
    const needed = 3 - killer.items.length;
    for (let i = 0; i < needed; i++) {
      const item = _drawItem('bronze') || _drawItem('silver');
      if (item) _giveItem(killer, item);
    }
    // Killer takes victim's combat cards (up to 3)
    const cardsToTake = Math.max(0, 3 - killer.combatCards.length);
    const takenCards = victim.combatCards.splice(0, cardsToTake);
    killer.combatCards.push(...takenCards);
    if (takenCards.length < 3) {
      _drawCombatCardsForPlayer(killer, 3 - killer.combatCards.length);
    }
    emit('log', `${killer.name} claims ${taken.length} item(s) and ${takenCards.length} combat card(s) from ${victim.name}.`);
  }

  // ── Tile interaction ──────────────────────────────────────
  function beginInteract() {
    const p    = currentPlayer();
    const tile = getTile(p.tileId);
    if (p.actionsLeft < 1) { emit('error', 'Not enough actions.'); return; }
    if (tile.type === 'tower') {
      emit('tower_prompt', { tileId: tile.id, towerUsed: p.towerUsed });
    } else if (tile.hasWalls) {
      state.subphase = 'interact';
      emit('phase_changed', { subphase: 'interact', type: 'rotate', tileId: tile.id });
    } else {
      emit('error', 'Nothing to interact with here.');
    }
  }

  function commitRotateTile(tileId, direction) {
    const p = currentPlayer();
    const tile = getTile(tileId);
    if (!tile || !tile.hasWalls) { emit('error', 'No walls to rotate.'); return; }
    if (p.actionsLeft < 1) { emit('error', 'Not enough actions.'); return; }
    p.actionsLeft -= 1;
    tile.wallRotation = ((tile.wallRotation || 0) + (direction === 'cw' ? 1 : 3)) % 4;
    emit('log', `${p.name} rotates tile ${tileId}.`);
    state.subphase = 'action_select';
    emit('state_changed', state);
    emit('phase_changed', { subphase: 'action_select' });
  }

  function commitTowerAction(action) {
    const p    = currentPlayer();
    const tile = getTile(p.tileId);
    if (!tile || tile.type !== 'tower') return;
    if (p.actionsLeft < 1) { emit('error', 'Not enough actions.'); return; }
    p.actionsLeft -= 1;
    if (action === 'teleport') {
      const otherTower = state.tiles.find(t => t.type === 'tower' && t.id !== tile.id && !t.removed);
      if (!otherTower) { emit('error', 'Other tower has been removed.'); return; }
      const prev = p.tileId;
      p.tileId = otherTower.id;
      emit('player_moved', { playerId: p.id, fromTile: prev, toTile: otherTower.id });
      emit('log', `${p.name} teleports to the other Tower.`);
    } else if (action === 'heal') {
      if (p.towerUsed) { emit('error', 'You have already used a Tower to heal this game.'); return; }
      p.hp = Math.min(p.maxHp, p.hp + 3);
      p.towerUsed = true;
      emit('log', `${p.name} heals 3 HP at the Tower (once per game).`);
    }
    state.subphase = 'action_select';
    emit('state_changed', state);
    emit('phase_changed', { subphase: 'action_select' });
  }

  // ── Upgrades ──────────────────────────────────────────────
  function buyUpgrade(upgradeId) {
    const p    = currentPlayer();
    const char = CHARACTERS.find(c => c.id === p.characterId);
    const upg  = char.upgrades.find(u => u.id === upgradeId);
    if (!upg) { emit('error', 'Unknown upgrade.'); return; }
    if (p.upgrades.includes(upgradeId)) { emit('error', 'Already purchased.'); return; }
    if (p.xp < upg.cost) { emit('error', `Need ${upg.cost} XP.`); return; }
    p.xp -= upg.cost;
    p.upgrades.push(upgradeId);
    _applyUpgradeEffect(p, upg);
    emit('log', `${p.name} unlocks ${upg.name}!`);
    state.subphase = 'action_select';
    emit('state_changed', state);
    emit('phase_changed', { subphase: 'action_select' });
  }

  function _applyUpgradeEffect(player, upg) {
    const e = upg.effect;
    if (e.actions)        { player.actionsPerTurn  += e.actions; }
    if (e.combatCardCap)  { player.combatCardCap   += e.combatCardCap; }
    if (e.itemCap)        { player.itemCap         += e.itemCap; }
    if (e.damage)         { player.damage          += e.damage; }
    if (e.flag)           { player.flags[e.flag]    = true; }
    if (e.itemCapDelta)   { player.itemCap = Math.max(1, player.itemCap + e.itemCapDelta); }
  }

  // ── Item usage ────────────────────────────────────────────
  function useItem(playerId, itemUid, targetId, extraData) {
    const p = getPlayer(playerId);
    const itemIdx = p.items.findIndex(i => i.uid === itemUid);
    if (itemIdx === -1) { emit('error', 'Item not found.'); return; }
    const item = p.items[itemIdx];

    // Check timing
    const isOwnTurn = playerId === currentPlayer().id;
    if (item.timing === 'own_turn' && !isOwnTurn) { emit('error', 'Can only use this on your own turn.'); return; }

    p.items.splice(itemIdx, 1);
    _discardItem(item);

    _applyItemEffect(p, item, targetId, extraData);
    emit('log', `${p.name} uses ${item.name}.`);
    emit('state_changed', state);
  }

  function _applyItemEffect(player, item, targetId, extra) {
    const tgt = targetId ? getPlayer(targetId) : null;
    switch (item.effect) {
      case 'heal': {
        let amount = item.value;
        if (player.characterId === 'vesper') amount = Math.floor(amount * 2 / 3); // 3→2, 6→4
        player.hp = Math.min(player.maxHp, player.hp + amount);
        emit('log', `${player.name} heals ${amount} HP.`);
        break;
      }
      case 'gain_xp':
        player.xp += item.value;
        break;
      case 'battle_surge':
        player.bonusDamageNext = (player.bonusDamageNext || 0) + item.value;
        break;
      case 'extra_action':
        player.actionsLeft += item.value;
        break;
      case 'shield':
        // Handled in combat resolution
        player.flags.shieldActive = true;
        break;
      case 'smoke_bomb':
        if (state.combat) {
          emit('log', `${player.name} uses Smoke Bomb — combat cancelled!`);
          _endCombat(false);
        }
        break;
      case 'iron_armor':
        player.armorReduction = (player.armorReduction || 0) + item.value;
        break;
      case 'counter_stance':
        if (state.combat && state.combat.type === 'pvp') {
          const c = state.combat;
          [c.attackerId, c.defenderId] = [c.defenderId, c.attackerId];
          c.phase = 'attacker_select';
          c.attackerCard = null;
          c.defenderCard = null;
          emit('log', `${player.name} uses Counter Stance — roles swapped!`);
          emit('combat_update', c);
        }
        break;
      case 'mind_drain':
        if (tgt && tgt.combatCards.length > 0) {
          emit('mind_drain_prompt', { attackerId: player.id, defenderId: tgt.id });
        }
        break;
      case 'push':
        if (tgt) {
          const adjIds = state.tiles.filter(t => !t.removed).filter(t => {
            const dt = state.tiles.find(x => x.id === tgt.tileId);
            return dt && Math.abs(t.row - dt.row) + Math.abs(t.col - dt.col) === 1;
          }).map(t => t.id);
          emit('push_target_prompt', { pushedId: tgt.id, validTiles: adjIds });
        }
        break;
      case 'free_move':
        player.actionsLeft += 0; // move handled separately – flag pending free move
        player.flags.freeMoveActive = true;
        emit('phase_changed', { subphase: 'move', validTiles: getAdjacentTileIds(player.tileId, state.tiles), free: true });
        return; // don't reset subphase yet
      case 'teleport':
        emit('teleport_prompt', { playerId: player.id, validTiles: state.tiles.filter(t => !t.removed).map(t => t.id) });
        break;
      case 'displace':
        if (tgt) emit('displace_prompt', { targetId: tgt.id, validTiles: state.tiles.filter(t => !t.removed).map(t => t.id) });
        break;
      case 'rotate_tile':
        emit('rotate_prompt', { playerId: player.id });
        break;
      case 'destroy_item':
        if (tgt && tgt.items.length > 0) {
          const idx = Math.floor(Math.random() * tgt.items.length);
          const destroyed = tgt.items.splice(idx, 1)[0];
          _discardItem(destroyed);
          emit('log', `${tgt.name}'s ${destroyed.name} is destroyed!`);
        }
        break;
      case 'peek_hand':
        if (tgt) emit('peek_reveal', { viewerId: player.id, targetId: tgt.id, hand: tgt.combatCards });
        break;
      case 'salvage':
        if (state.decks.bronzeDiscard.length > 0) {
          emit('salvage_prompt', { discard: state.decks.bronzeDiscard });
        } else { emit('log', 'Bronze discard pile is empty.'); }
        break;
      case 'world_shaper':
        emit('world_shaper_prompt', { tiles: state.tiles });
        break;
      case 'time_stop':
        if (tgt && tgt.id !== currentPlayer().id) {
          emit('log', `${tgt.name}'s turn ends immediately!`);
          // Force-end their turn next if it's their turn
          if (state.players[state.currentPlayerIndex].id === tgt.id) {
            endTurn();
          }
        }
        break;
      case 'ranged_attack': {
        const adjTiles = getAdjacentTileIds(player.tileId, state.tiles);
        const targets = state.players.filter(t => t.alive && t.id !== player.id && adjTiles.includes(t.tileId));
        emit('ranged_attack_prompt', { attackerId: player.id, targets: targets.map(t => t.id) });
        break;
      }
      case 'mass_confusion':
        state.players.filter(p2 => p2.alive && p2.id !== player.id && p2.tileId === player.tileId).forEach(p2 => {
          if (p2.combatCards.length > 0) {
            const c = p2.combatCards.pop();
            state.decks.combatDiscard.push(c);
          }
        });
        break;
      case 'free_draw':
        _drawCombatCardsForPlayer(player);
        break;
      case 'void_rift':
        emit('void_rift_prompt', { playerId: player.id, others: state.players.filter(p => p.alive && p.id !== player.id).map(p => p.id) });
        break;
      case 'chaos_orb':
        state.players.filter(p2 => p2.alive && p2.id !== player.id).forEach(p2 => {
          state.decks.combatDiscard.push(...p2.combatCards);
          p2.combatCards = [];
        });
        emit('log', 'Chaos Orb! All opponents discard their entire Combat Card hands!');
        break;
      case 'blink_strike': {
        const allTargets = state.players.filter(t => t.alive && t.id !== player.id);
        emit('blink_strike_prompt', { attackerId: player.id, targets: allTargets.map(t => t.id) });
        break;
      }
    }
    emit('state_changed', state);
  }

  // ── Item prompt resolutions ───────────────────────────────
  function resolveDisplace(targetId, newTileId) {
    const tgt = getPlayer(targetId);
    if (!tgt) return;
    const prev = tgt.tileId;
    tgt.tileId = newTileId;
    emit('player_moved', { playerId: tgt.id, fromTile: prev, toTile: newTileId });
    emit('log', `${tgt.name} is displaced to tile ${newTileId}.`);
    emit('state_changed', state);
  }

  function resolveTeleport(playerId, newTileId) {
    const p = getPlayer(playerId);
    const prev = p.tileId;
    p.tileId = newTileId;
    emit('player_moved', { playerId: p.id, fromTile: prev, toTile: newTileId });
    emit('log', `${p.name} teleports to tile ${newTileId}.`);
    emit('state_changed', state);
  }

  function resolvePush(pushedId, newTileId) {
    const p = getPlayer(pushedId);
    const prev = p.tileId;
    p.tileId = newTileId;
    emit('player_moved', { playerId: p.id, fromTile: prev, toTile: newTileId });
    emit('log', `${p.name} is pushed to tile ${newTileId}.`);
    emit('state_changed', state);
  }

  function resolveMindDrain(attackerId, cardUid) {
    const def = state.players.find(p => p.combatCards.some(c => c.uid === cardUid));
    if (!def) return;
    const card = def.combatCards.find(c => c.uid === cardUid);
    def.combatCards = def.combatCards.filter(c => c.uid !== cardUid);
    state.decks.combatDiscard.push(card);
    emit('log', `${def.name} discards ${card.type}.`);
    emit('state_changed', state);
  }

  function resolveWorldShaper(action, tileId) {
    if (action === 'remove') {
      _removeTile(tileId);
    } else if (action === 'restore') {
      const tile = getTile(tileId);
      if (tile) {
        tile.removed = false;
        emit('log', `Tile ${tileId} restored.`);
        emit('tile_restored', { tileId });
      }
    }
    emit('state_changed', state);
  }

  function resolveSalvage(itemUid) {
    const idx = state.decks.bronzeDiscard.findIndex(i => i.uid === itemUid);
    if (idx === -1) return;
    const item = state.decks.bronzeDiscard.splice(idx, 1)[0];
    _giveItem(currentPlayer(), item);
    emit('log', `${currentPlayer().name} salvages ${item.name}.`);
    emit('state_changed', state);
  }

  // ── Helpers ───────────────────────────────────────────────
  function _drawItem(tier) {
    const deckKey = tier;
    if (state.decks[deckKey].length === 0) return null;
    return state.decks[deckKey].pop();
  }

  function _giveItem(player, item) {
    if (player.items.length >= player.itemCap) {
      // Auto-discard oldest item
      const old = player.items.shift();
      _discardItem(old);
      emit('log', `${player.name}'s inventory full — discards ${old.name}.`);
    }
    player.items.push(item);
    emit('item_gained', { playerId: player.id, item });
  }

  function _discardItem(item) {
    const key = item.tier + 'Discard';
    if (state.decks[key]) state.decks[key].push(item);
  }

  function _checkAlive(player) {
    if (player.hp <= 0 && player.alive) {
      player.alive = false;
      emit('player_eliminated', { playerId: player.id });
      emit('log', `${player.name} has been eliminated!`);
      const alive = state.players.filter(p => p.alive);
      if (alive.length === 1) _endGame();
    }
  }

  function _endGame() {
    state.phase = 'gameover';
    const winner = state.players.find(p => p.alive);
    emit('log', winner ? `${winner.name} wins Avaterra!` : 'Game over — no survivors.');
    emit('game_over', { winner: winner ? winner.id : null });
  }

  // ── Buy item from deck (all upgrades unlocked) ─────────────
  function buyItemFromDeck(tier) {
    const p    = currentPlayer();
    const char = CHARACTERS.find(c => c.id === p.characterId);
    const allUpgrades = char.upgrades.map(u => u.id);
    const hasAll = allUpgrades.every(id => p.upgrades.includes(id));
    if (!hasAll) { emit('error', 'Must unlock all character upgrades first.'); return; }
    if (p.xp < 2) { emit('error', 'Need 2 XP to buy an item.'); return; }
    if (p.actionsLeft < 1) { emit('error', 'Not enough actions.'); return; }
    const item = _drawItem(tier || 'bronze');
    if (!item) { emit('error', 'No items left in that deck.'); return; }
    p.xp -= 2;
    p.actionsLeft -= 1;
    _giveItem(p, item);
    emit('log', `${p.name} buys a ${tier} item: ${item.name}.`);
    emit('state_changed', state);
  }

  // ── Public API ────────────────────────────────────────────
  return {
    on, emit, getState, currentPlayer, getPlayer, getTile,
    init, endTurn,
    beginMove, commitMove,
    beginAttack, commitAttack,
    resolveEmergencyDraw,
    selectCombatCard, rollMonsterDie,
    defenderCounterChoice,
    beginHunt,
    beginVeilStep, commitVeilStep,
    beginSeekingArrow, commitSeekingArrow,
    beginMindLink, commitMindLink,
    beginShadowPlunder, commitShadowPlunder, resolveShadowPlunder,
    activateSanguineRitual,
    activateBerserker,
    beginInteract, commitRotateTile, commitTowerAction,
    buyUpgrade,
    actionDrawCards,
    useItem,
    resolveDisplace, resolveTeleport, resolvePush,
    resolveMindDrain, resolveWorldShaper, resolveSalvage,
    buyItemFromDeck,
  };
})();
