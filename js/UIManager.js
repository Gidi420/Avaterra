// ============================================================
// UIManager.js  –  All HTML overlay/panel management
// ============================================================

const UI = (() => {

  // ── Helpers ───────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const show = id => $(id) && ($(id).classList.remove('hidden'));
  const hide = id => $(id) && ($(id).classList.add('hidden'));

  let _pendingTileClick = null; // callback waiting for tile click
  let _pendingPlayerClick = null;

  // ── Init ──────────────────────────────────────────────────
  function init() {
    _buildCharSelectScreen();
    GS.on('state_changed',         _onStateChanged);
    GS.on('phase_changed',         _onPhaseChanged);
    GS.on('combat_start',          _onCombatStart);
    GS.on('combat_update',         _onCombatUpdate);
    GS.on('combat_end',            _onCombatEnd);
    GS.on('counter_choice_prompt', _onCounterChoice);
    GS.on('log',                   _appendLog);
    GS.on('error',                 msg => _toast(msg, 'error'));
    GS.on('game_over',             _onGameOver);
    GS.on('round_changed',         _onRoundChanged);
    GS.on('mind_link_reveal',      _onMindLinkReveal);
    GS.on('shadow_plunder_prompt', _onShadowPlunderPrompt);
    GS.on('emergency_draw_prompt', _onEmergencyDraw);
    GS.on('tower_prompt',          _onTowerPrompt);
    GS.on('peek_reveal',           _onPeekReveal);
    GS.on('push_target_prompt',    d => _awaitTileForItem('push', d));
    GS.on('teleport_prompt',       d => _awaitTileForItem('teleport', d));
    GS.on('displace_prompt',       d => _awaitTileForItem('displace', d));
    GS.on('world_shaper_prompt',   _onWorldShaper);
    GS.on('salvage_prompt',        _onSalvage);
    GS.on('ranged_attack_prompt',  _onRangedAttack);
    GS.on('blink_strike_prompt',   _onBlinkStrike);
    GS.on('void_rift_prompt',      _onVoidRift);
    GS.on('player_eliminated',     _onPlayerEliminated);
    GS.on('mind_drain_prompt',     _onMindDrainPrompt);
    GS.on('rotate_prompt',         _onRotatePrompt);
    GS.on('cave_discard_prompt',   _onCaveDiscardPrompt);
    GS.on('vandalism_prompt',      _onVandalismPrompt);
    GS.on('sanguine_prompt',       _onSanguinePrompt);
    GS.on('rotate_tile_pick_prompt', _onRotateTilePickPrompt);
  }

  // ══════════════════════════════════════════════════════════
  //  CHARACTER SELECTION SCREEN
  // ══════════════════════════════════════════════════════════
  function _buildCharSelectScreen() {
    show('char-select');
    const container = $('char-select-content');
    container.innerHTML = '';

    // Step 1: how many players
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.textContent = 'AVATERRA';
    container.appendChild(header);

    const sub = document.createElement('div');
    sub.className = 'panel-sub';
    sub.textContent = 'Battle Royale Turn-Based Board Game';
    container.appendChild(sub);

    const countDiv = document.createElement('div');
    countDiv.className = 'player-count-row';
    countDiv.innerHTML = '<label>Number of Players:</label>';
    const countSel = document.createElement('select');
    countSel.id = 'player-count';
    [2,3,4,5,6].forEach(n => {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      countSel.appendChild(o);
    });
    countDiv.appendChild(countSel);
    container.appendChild(countDiv);

    const setupDiv = document.createElement('div');
    setupDiv.id = 'player-setup-area';
    container.appendChild(setupDiv);

    const randomBtn = document.createElement('button');
    randomBtn.className = 'btn btn-secondary';
    randomBtn.textContent = '🔀 Randomize Player Order';
    randomBtn.style.marginBottom = '8px';
    randomBtn.onclick = () => {
      const count = parseInt($('player-count').value);
      const rows  = [...$('player-setup-area').querySelectorAll('.player-setup-row')];
      const names = rows.map(r => r.querySelector('.player-name-input').value);
      const chars = rows.map(r => r.querySelector('.char-select-dropdown').value);
      // Fisher-Yates shuffle
      for (let i = count - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [names[i], names[j]] = [names[j], names[i]];
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      rows.forEach((r, i) => {
        r.querySelector('.player-name-input').value = names[i];
        r.querySelector('.char-select-dropdown').value = chars[i];
        const prev = r.querySelector('.char-preview');
        if (prev) _updateCharPreview(i, chars[i], prev);
      });
    };
    container.appendChild(randomBtn);

    const startBtn = document.createElement('button');
    startBtn.className = 'btn btn-primary big-btn';
    startBtn.textContent = 'START GAME';
    startBtn.onclick = _startGame;
    container.appendChild(startBtn);

    countSel.onchange = () => _renderPlayerSetup(parseInt(countSel.value));
    _renderPlayerSetup(2);
  }

  function _renderPlayerSetup(count) {
    const area = $('player-setup-area');
    area.innerHTML = '';
    const usedChars = new Set();

    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'player-setup-row';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = `Player ${i + 1}`;
      nameInput.value = `Player ${i + 1}`;
      nameInput.className = 'player-name-input';
      nameInput.id = `player-name-${i}`;

      const charSel = document.createElement('select');
      charSel.className = 'char-select-dropdown';
      charSel.id = `char-sel-${i}`;
      CHARACTERS.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.name} — ${c.lore} (HP:${c.hp} DMG:${c.damage})`;
        charSel.appendChild(o);
      });
      // Default: stagger selections
      charSel.value = CHARACTERS[i % CHARACTERS.length].id;

      // Character card preview
      const preview = document.createElement('div');
      preview.className = 'char-preview';
      preview.id = `char-preview-${i}`;

      charSel.onchange = () => _updateCharPreview(i, charSel.value, preview);
      _updateCharPreview(i, charSel.value, preview);

      row.appendChild(nameInput);
      row.appendChild(charSel);
      row.appendChild(preview);
      area.appendChild(row);
    }
  }

  function _updateCharPreview(idx, charId, el) {
    const c = CHARACTERS.find(x => x.id === charId);
    if (!c) return;
    el.innerHTML = `
      <div class="char-card" style="border-color:${c.color}">
        <div class="char-name" style="color:${c.color}">${c.name}</div>
        <div class="char-lore">${c.lore}</div>
        <div class="char-stats">
          ❤ ${c.hp} HP &nbsp;⚔ ${c.damage} DMG &nbsp;⚡ ${c.actionsPerTurn} AP
          <br>🃏 ${c.combatCardCapacity} Cards &nbsp;🎒 ${c.itemCapacity} Items
        </div>
        <div class="char-ability"><b>${c.abilityName}</b><br><span>${c.abilityDesc}</span></div>
      </div>`;
  }

  function _startGame() {
    const count = parseInt($('player-count').value);
    const setups = [];
    for (let i = 0; i < count; i++) {
      const name   = ($(`player-name-${i}`) || {}).value || `Player ${i+1}`;
      const charId = ($(`char-sel-${i}`)    || {}).value || CHARACTERS[0].id;
      setups.push({ name, characterId: charId });
    }
    hide('char-select');
    show('hud');
    GS.init(setups);
    _buildHUD();
  }

  // ══════════════════════════════════════════════════════════
  //  HUD
  // ══════════════════════════════════════════════════════════
  function _buildHUD() {
    _updateHUD();
    _updateActionButtons();
  }

  function _updateHUD() {
    const s = GS.getState();
    if (!s) return;
    const cp = GS.currentPlayer();

    // Round indicator
    const ri = $('round-indicator');
    if (ri) ri.textContent = `Round ${s.round}`;

    // Scheduled removal warning
    const sr = $('removal-warning');
    if (sr) {
      if (s.scheduledRemoval.length > 0) {
        sr.textContent = `⚠ Tile${s.scheduledRemoval.length > 1 ? 's' : ''} ${s.scheduledRemoval.join(', ')} removed next round`;
        sr.style.display = 'block';
      } else {
        sr.style.display = 'none';
      }
    }

    // Current player banner
    const cpb = $('current-player-banner');
    if (cpb) {
      const char = CHARACTERS.find(c => c.id === cp.characterId);
      cpb.innerHTML = `<span style="color:${char ? char.color : '#fff'}">${cp.name}</span>'s Turn — <span class="ap-display">${cp.actionsLeft} ⚡</span>`;
    }

    // Item deck counters
    const deckBar = $('deck-counters');
    if (deckBar && s.decks) {
      deckBar.innerHTML =
        `<span class="deck-count tier-bronze">🟤 ${s.decks.bronze.length}</span>` +
        `<span class="deck-count tier-silver">⚪ ${s.decks.silver.length}</span>` +
        `<span class="deck-count tier-gold">🟡 ${s.decks.gold.length}</span>`;
    }

    // Player info list
    _renderPlayerList();
    _renderCurrentHand();
    _renderCurrentInventory();
  }

  function _renderPlayerList() {
    const s   = GS.getState();
    const el  = $('player-list');
    if (!el) return;
    el.innerHTML = '';
    s.players.forEach(p => {
      const char  = CHARACTERS.find(c => c.id === p.characterId);
      const isCur = p.id === s.currentPlayerIndex;
      const div   = document.createElement('div');
      div.className = `player-info-card${p.alive ? '' : ' dead'}${isCur ? ' current' : ''}`;
      div.style.borderColor = char ? char.color : '#555';
      // Show character name prominently; show player name as subtitle if different
      const charName = char ? char.name : '';
      const showSub  = p.name !== charName && !p.name.match(/^Player \d+$/i);
      // Reaction items for this player
      const reactItems = p.items.filter(i => i.timing === 'reaction');
      const reactHtml  = reactItems.length > 0
        ? '<div class="pi-reactions">' +
            reactItems.map(i =>
              `<button class="item-btn-mini tier-${i.tier}" title="${i.desc}"
                onclick="UI._useReactionItem(${p.id}, ${i.uid})">${i.icon}</button>`
            ).join('') +
          '</div>'
        : '';
      div.innerHTML = `
        <div class="pi-name" style="color:${char ? char.color : '#fff'}">${isCur ? '▶ ' : ''}${charName || p.name}${p.alive ? '' : ' ☠'}</div>
        ${showSub ? `<div class="pi-char-name" style="font-size:0.7em;opacity:0.75">${p.name}</div>` : ''}
        <div class="pi-stats">
          <span class="pi-hp">❤ ${p.hp}/${p.maxHp}</span>
          <span class="pi-xp">✨ ${p.xp} XP</span>
          <span class="pi-ap">⚡ ${p.actionsLeft}</span>
        </div>
        <div class="hp-bar-wrap"><div class="hp-bar" style="width:${Math.max(0,(p.hp/p.maxHp)*100)}%;background:${p.hp/p.maxHp > 0.5 ? '#2ecc71' : p.hp/p.maxHp > 0.25 ? '#e67e22' : '#e74c3c'}"></div></div>
        <div class="pi-mini">🃏${p.combatCards.length}/${p.combatCardCap} &nbsp;🎒${p.items.length}/${p.itemCap}</div>
        ${reactHtml}`;
      el.appendChild(div);
    });
  }

  function _renderCurrentHand() {
    const p  = GS.currentPlayer();
    const el = $('hand-display');
    if (!el) return;
    el.innerHTML = '<div class="hand-label">Combat Hand:</div>';
    if (p.combatCards.length === 0) {
      el.innerHTML += '<span class="empty-hand">— empty —</span>';
      return;
    }
    p.combatCards.forEach(card => {
      const cd = document.createElement('div');
      cd.className = 'combat-card-mini';
      cd.style.background = COMBAT_CARD_COLORS[card.type];
      cd.innerHTML = `${COMBAT_CARD_ICONS[card.type]}<br><span>${card.type}</span>`;
      el.appendChild(cd);
    });
  }

  function _renderCurrentInventory() {
    const p  = GS.currentPlayer();
    const el = $('inventory-display');
    if (!el) return;
    el.innerHTML = '<div class="inv-label">Inventory:</div>';
    if (p.items.length === 0) {
      el.innerHTML += '<span class="empty-inv">— empty —</span>';
      return;
    }
    p.items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = `item-btn tier-${item.tier}`;
      btn.innerHTML = `${item.icon} ${item.name}`;
      btn.title = item.desc;
      btn.onclick = () => _promptUseItem(p, item);
      el.appendChild(btn);
    });
  }

  // ── Action buttons ────────────────────────────────────────
  function _updateActionButtons() {
    const s  = GS.getState();
    const p  = GS.currentPlayer();
    if (!s || !p) return;

    const actions = [
      { id: 'btn-move',    label: '🚶 Move',           onclick: () => GS.beginMove(),       enabled: p.actionsLeft >= 1 },
      { id: 'btn-hunt',    label: '🗡 Hunt',            onclick: () => GS.beginHunt(),       enabled: p.actionsLeft >= 1 && (GS.getTile(p.tileId)||{}).hasMonster },
      { id: 'btn-attack',  label: '⚔ Attack',          onclick: () => GS.beginAttack(),     enabled: p.actionsLeft >= 1 && _playersOnSameTile(p) },
      { id: 'btn-ability', label: `✨ ${CHARACTERS.find(c=>c.id===p.characterId)?.abilityName||'Ability'}`, onclick: () => _useAbility(p), enabled: _canUseAbility(p), tooltip: p.characterId === 'red' ? 'Auto-activates: prompts when you attack' : (CHARACTERS.find(c=>c.id===p.characterId)?.abilityDesc||'') },
      { id: 'btn-upgrade', label: '⬆ Upgrades',        onclick: () => _showUpgrades(p),    enabled: true },
      { id: 'btn-draw',    label: '🃏 Draw Cards',       onclick: () => _promptDrawCards(p), enabled: p.actionsLeft >= 1 && p.xp > 0 && p.combatCards.length < p.combatCardCap },
      { id: 'btn-interact',label: '🔧 Interact Tile',   onclick: () => GS.beginInteract(),  enabled: p.actionsLeft >= 1 && _canInteract(p) },
      { id: 'btn-buy',     label: '💰 Buy Item',         onclick: () => _promptBuyItem(p),   enabled: _canBuyItem(p) },
      { id: 'btn-end',     label: '✅ End Turn',          onclick: () => _confirmEndTurn(),   enabled: true },
    ];

    const bar = $('action-bar');
    if (!bar) return;
    bar.innerHTML = '';
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.id = a.id;
      btn.className = `action-btn${a.enabled ? '' : ' disabled'}`;
      btn.innerHTML = a.label;
      if (a.enabled) btn.onclick = a.onclick;
      if (a.tooltip) btn.title = a.tooltip;
      bar.appendChild(btn);
    });
  }

  function _playersOnSameTile(p) {
    const s = GS.getState();
    return s.players.some(t => t.alive && t.id !== p.id && t.tileId === p.tileId);
  }

  function _canUseAbility(p) {
    const char = CHARACTERS.find(c => c.id === p.characterId);
    if (!char) return false;
    if (char.abilityType === 'passive') {
      // Walnut with Ascendant Mastery active can spend XP
      if (p.characterId === 'walnut' && p.flags && p.flags.berserker && p.xp >= 2) return true;
      return false;
    }
    if (p.characterId === 'cyan')   return p.actionsLeft >= 1;
    if (p.characterId === 'indigo') return p.combatCards.length >= 1;
    if (p.characterId === 'gold')   return p.combatCards.length >= 1 && _playersOnSameTile(p);
    if (p.characterId === 'red')    return false; // auto-prompts at combat start
    if (p.characterId === 'green')  return p.actionsLeft >= 2 && _adjacentEnemies(p).length > 0;
    return false;
  }

  function _adjacentEnemies(p) {
    const s = GS.getState();
    const adjIds = getAdjacentTileIds(p.tileId, s.tiles);
    return s.players.filter(t => t.alive && t.id !== p.id && adjIds.includes(t.tileId));
  }

  function _canInteract(p) {
    const tile = GS.getTile(p.tileId);
    return tile && (tile.type === 'tower' || tile.hasWalls);
  }

  function _canBuyItem(p) {
    const char = CHARACTERS.find(c => c.id === p.characterId);
    if (!char) return false;
    const allUnlocked = char.upgrades.every(u => p.upgrades.includes(u.id));
    return allUnlocked && p.xp >= 2 && p.actionsLeft >= 1;
  }

  function _useAbility(p) {
    if (p.characterId === 'cyan')        GS.beginVeilStep();
    else if (p.characterId === 'indigo') GS.beginMindLink();
    else if (p.characterId === 'gold')   GS.beginShadowPlunder();
    else if (p.characterId === 'red')    GS.activateSanguineRitual();
    else if (p.characterId === 'green')  GS.beginSeekingArrow();
    else if (p.characterId === 'walnut') {
      _showModal('⚔ Ascendant Mastery', `<p>Spend 2 XP for a combat boost? (${p.xp} XP available, stackable)</p>`, [
        { label: '+1 Damage (2 XP)',     cls: 'btn-primary', onclick: () => { GS.activateBerserker('damage');     _closeModal(); }},
        { label: '+1 Resistance (2 XP)', cls: 'btn-primary', onclick: () => { GS.activateBerserker('resistance'); _closeModal(); }},
        { label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal },
      ]);
    }
  }

  function _confirmEndTurn() {
    GS.endTurn();
  }

  function _promptDrawCards(p) {
    const space = p.combatCardCap - p.combatCards.length;
    const max   = Math.min(space, p.xp);
    if (max === 0) { _toast('Nothing to draw.', 'info'); return; }
    _showModal('Draw Combat Cards', `
      <p>Spend 1 Action + <b>N XP</b> to draw N cards (max: ${max}).</p>
      <input type="range" id="draw-slider" min="1" max="${max}" value="${max}">
      <div id="draw-val">Draw ${max} cards</div>
    `, [
      { label: 'Draw', cls: 'btn-primary', onclick: () => {
        const n = parseInt($('draw-slider').value);
        GS.actionDrawCards(n);
        _closeModal();
      }},
      { label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal },
    ]);
    const sl = $('draw-slider');
    if (sl) sl.oninput = () => { $('draw-val').textContent = `Draw ${sl.value} cards`; };
  }

  function _promptBuyItem(p) {
    _showModal('Buy Item from Deck', `<p>Spend 1 Action + 2 XP to draw an item. Choose tier:</p>`, [
      { label: '🟤 Bronze', cls: 'btn-bronze', onclick: () => { GS.buyItemFromDeck('bronze'); _closeModal(); }},
      { label: '⚪ Silver', cls: 'btn-silver', onclick: () => { GS.buyItemFromDeck('silver'); _closeModal(); }},
      { label: '🟡 Gold',   cls: 'btn-gold',   onclick: () => { GS.buyItemFromDeck('gold');   _closeModal(); }},
      { label: 'Cancel',    cls: 'btn-cancel',  onclick: _closeModal },
    ]);
  }

  function _promptUseItem(p, item) {
    const s = GS.getState();
    const isCurrent = p.id === GS.currentPlayer().id;
    const inCombat  = !!s.combat;

    // Reaction items and defensive items can be used anytime
    if (!isCurrent && !item.defensive && item.timing !== 'reaction') {
      _toast('Can only use this on your own turn.', 'info'); return;
    }

    if (item.effect === 'mind_drain' || item.effect === 'destroy_item' || item.effect === 'peek_hand' ||
        item.effect === 'push' || item.effect === 'displace' || item.effect === 'time_stop') {
      // Needs target (push requires same tile)
      const others = item.effect === 'push'
        ? s.players.filter(t => t.alive && t.id !== p.id && t.tileId === p.tileId)
        : s.players.filter(t => t.alive && t.id !== p.id);
      if (others.length === 0) { _toast('No valid targets.', 'info'); return; }
      _showPlayerPicker(`Use: ${item.icon} ${item.name}`, others, targetId => {
        _closeModal(); // close picker BEFORE calling GS (which may open new modal)
        GS.useItem(p.id, item.uid, targetId);
      });
    } else if (item.effect === 'teleport') {
      const tpValid = s.tiles.filter(t => !t.removed && t.id !== p.tileId).map(t => t.id);
      _toast('Select any tile to teleport to.', 'info');
      const tpScene = window._gameScene;
      if (tpScene) tpScene.highlightTiles(tpValid, 0x00aaff);
      _awaitTileClick(tileId => {
        if (tpScene) tpScene.clearHighlights();
        GS.useItem(p.id, item.uid, null, { tileId });
      });
    } else if (item.effect === 'free_move') {
      const fmValid = getAdjacentTileIds(p.tileId, s.tiles);
      if (fmValid.length === 0) { _toast('No adjacent tiles to move to.', 'info'); return; }
      _toast('Select an adjacent tile (free, no AP cost).', 'info');
      const fmScene = window._gameScene;
      if (fmScene) fmScene.highlightTiles(fmValid, 0x00ff88);
      _awaitTileClick(tileId => {
        if (fmScene) fmScene.clearHighlights();
        if (!fmValid.includes(tileId)) { _toast('Not a valid free-move destination.', 'error'); return; }
        GS.useItem(p.id, item.uid, null, { tileId });
      });
    } else if (item.effect === 'rotate_tile') {
      const walledTiles = s.tiles.filter(t => !t.removed && t.hasWalls);
      if (walledTiles.length === 0) { _toast('No walled tiles on the board.', 'info'); return; }
      let rtHtml = '<p>Choose a walled tile to rotate:</p><div class="tile-grid">';
      walledTiles.forEach(t => {
        const td = TILE_TYPE_DATA[t.type] || {};
        rtHtml += `<button class="tile-pick-btn" onclick="UI._pickRotateTileItem(${p.id}, ${item.uid}, ${t.id})">${td.icon || ''} T${t.id} (${td.label || t.type})</button>`;
      });
      rtHtml += '</div>';
      _showModal('Rotate Tile', rtHtml, [{ label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal }]);
    } else if (item.effect === 'world_shaper') {
      const wsActive  = s.tiles.filter(t => !t.removed);
      const wsRemoved = s.tiles.filter(t => t.removed);
      let wsHtml = '<div class="tile-picker"><div><b>Remove an active tile:</b><div class="tile-grid">';
      wsActive.forEach(t => {
        const td = TILE_TYPE_DATA[t.type] || {};
        wsHtml += `<button class="tile-pick-btn" onclick="UI._useWorldShaperItem(${p.id}, ${item.uid}, 'remove', ${t.id})">${td.icon || ''} T${t.id}</button>`;
      });
      wsHtml += '</div></div>';
      if (wsRemoved.length > 0) {
        wsHtml += '<div><b>Restore a removed tile:</b><div class="tile-grid">';
        wsRemoved.forEach(t => {
          const td = TILE_TYPE_DATA[t.type] || {};
          wsHtml += `<button class="tile-pick-btn" onclick="UI._useWorldShaperItem(${p.id}, ${item.uid}, 'restore', ${t.id})">${td.icon || ''} T${t.id}</button>`;
        });
        wsHtml += '</div></div>';
      }
      wsHtml += '</div>';
      _showModal('Terrain Mod', wsHtml, [{ label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal }]);
    } else if (item.effect === 'salvage') {
      const salvDiscard = s.decks.bronzeDiscard;
      if (salvDiscard.length === 0) { _toast('Bronze discard pile is empty.', 'info'); return; }
      let salvHtml = '<p>Choose a Bronze item to salvage:</p><div class="item-grid">';
      salvDiscard.forEach(it => {
        salvHtml += `<button class="item-btn tier-bronze" onclick="UI._useSalvageItem(${p.id}, ${item.uid}, ${it.uid})">${it.icon} ${it.name}</button>`;
      });
      salvHtml += '</div>';
      _showModal('Trash — Salvage', salvHtml, [{ label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal }]);
    } else if (item.effect === 'ranged_attack' || item.effect === 'blink_strike') {
      const adjTiles = getAdjacentTileIds(p.tileId, s.tiles);
      const rangedTargets = s.players.filter(t => t.alive && t.id !== p.id && adjTiles.includes(t.tileId));
      if (rangedTargets.length === 0) { _toast('No targets on adjacent tiles.', 'info'); return; }
      _showPlayerPicker('Long-Range Strike — Choose target', rangedTargets, targetId => {
        _closeModal();
        GS.useItem(p.id, item.uid, targetId);
      });
    } else if (item.effect === 'void_rift') {
      GS.useItem(p.id, item.uid, null);
    } else {
      // Self-use item
      GS.useItem(p.id, item.uid, null);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  COMBAT UI
  // ══════════════════════════════════════════════════════════
  function _onCombatStart(combat) {
    _updateHUD();
    if (combat.type === 'hunt') {
      _showHuntCombat(combat);
    } else if (combat.type === 'seeking_arrow') {
      _showSeekingArrow(combat);
    } else {
      _showPvPCombat(combat);
    }
  }

  function _onCombatUpdate(combat) {
    if (combat.type === 'hunt')    _showHuntCombat(combat);
    else if (combat.type === 'seeking_arrow') _showSeekingArrow(combat);
    else                           _showPvPCombat(combat);
  }

  function _onCombatEnd() {
    hide('combat-overlay');
    _updateHUD();
    _updateActionButtons();
  }

  function _onCounterChoice({ defenderId }) {
    const def = GS.getPlayer(defenderId);
    _showModal(`${def.name}: Block or Counter?`, `
      <p>You successfully blocked! Choose your response:</p>
    `, [
      { label: '🛡 Retreat (end combat, no damage)', cls: 'btn-cancel', onclick: () => {
        GS.defenderCounterChoice('retreat'); _closeModal();
      }},
      { label: '⚔ Counter-Attack (swap roles)', cls: 'btn-primary', onclick: () => {
        GS.defenderCounterChoice('counter'); _closeModal();
      }},
    ]);
  }

  function _buildCardSelector(player, titleHtml, onSelect) {
    const el = $('combat-overlay');
    el.innerHTML = '';
    el.classList.remove('hidden');

    const box = document.createElement('div');
    box.className = 'combat-box';

    box.innerHTML = `<div class="combat-title">${titleHtml}</div>`;

    const hand = document.createElement('div');
    hand.className = 'combat-hand';

    if (player.combatCards.length === 0) {
      hand.innerHTML = '<div class="no-cards">No combat cards in hand!</div>';
      box.appendChild(hand);
      const btn = document.createElement('button');
      btn.className = 'btn btn-cancel';
      btn.textContent = 'Concede / Skip';
      btn.onclick = () => onSelect(null);
      box.appendChild(btn);
    } else {
      player.combatCards.forEach(card => {
        const btn = document.createElement('button');
        btn.className = `combat-card-big type-${card.type}`;
        btn.innerHTML = `<span class="card-icon">${COMBAT_CARD_ICONS[card.type]}</span><span class="card-name">${card.type.toUpperCase()}</span>`;
        btn.onclick = () => onSelect(card.uid);
        hand.appendChild(btn);
      });
      box.appendChild(hand);
    }

    // Show reactive items (shield, armor, swap) usable during combat
    const reactiveItems = (player.items || []).filter(i => i.timing === 'reaction');
    if (reactiveItems.length > 0) {
      const reactDiv = document.createElement('div');
      reactDiv.style.cssText = 'margin-top:8px;border-top:1px solid #333;padding-top:6px;';
      reactDiv.innerHTML = '<div class="hand-label">⚡ Reaction Items (use before picking card):</div>';
      const reactBtns = document.createElement('div');
      reactBtns.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;';
      reactiveItems.forEach(item => {
        const btn = document.createElement('button');
        btn.className = `item-btn tier-${item.tier}`;
        btn.innerHTML = `${item.icon} ${item.name}`;
        btn.title = item.desc;
        btn.onclick = () => { GS.useItem(player.id, item.uid, null); };
        reactBtns.appendChild(btn);
      });
      reactDiv.appendChild(reactBtns);
      box.appendChild(reactDiv);
    }

    el.appendChild(box);
  }

  function _showPvPCombat(combat) {
    const atk = GS.getPlayer(combat.attackerId);
    const def = GS.getPlayer(combat.defenderId);
    const s   = GS.getState();

    const el = $('combat-overlay');
    el.innerHTML = '';
    el.classList.remove('hidden');

    if (combat.phase === 'attacker_select') {
      // Show cover message first
      _buildPassDeviceScreen(atk.name, 'select your attack card', () => {
        _buildCardSelector(atk,
          `Round ${combat.round}/3 — <b>${atk.name}</b> attacks <b>${def.name}</b><br><small>Choose your card</small>`,
          uid => { GS.selectCombatCard(atk.id, uid); });
      });
    } else if (combat.phase === 'defender_select') {
      _buildPassDeviceScreen(def.name, 'select your defense card', () => {
        _buildCardSelector(def,
          `Round ${combat.round}/3 — <b>${def.name}</b> defends<br><small>Match the attacker's card to block</small>`,
          uid => { GS.selectCombatCard(def.id, uid); });
      });
    } else if (combat.phase === 'reveal') {
      const atkCard = _getCardObj(atk, combat.attackerCard);
      const defCard = _getCardObj(def, combat.defenderCard);
      const box = document.createElement('div');
      box.className = 'combat-box';
      box.innerHTML = `
        <div class="combat-title">REVEAL — Round ${combat.round}/3</div>
        <div class="reveal-row">
          <div class="reveal-player">
            <div class="reveal-name">${atk.name} (Attacker)</div>
            <div class="combat-card-big type-${atkCard ? atkCard.type : 'none'}">
              <span class="card-icon">${atkCard ? COMBAT_CARD_ICONS[atkCard.type] : '?'}</span>
              <span class="card-name">${atkCard ? atkCard.type.toUpperCase() : 'NONE'}</span>
            </div>
          </div>
          <div class="vs-text">VS</div>
          <div class="reveal-player">
            <div class="reveal-name">${def.name} (Defender)</div>
            <div class="combat-card-big type-${defCard ? defCard.type : 'none'}">
              <span class="card-icon">${defCard ? COMBAT_CARD_ICONS[defCard.type] : '?'}</span>
              <span class="card-name">${defCard ? defCard.type.toUpperCase() : 'NONE'}</span>
            </div>
          </div>
        </div>
        <div class="reveal-result" id="reveal-result-text">...</div>`;
      el.innerHTML = '';
      el.appendChild(box);

      // Result text
      const atkT = atkCard ? atkCard.type : null;
      const defT = defCard ? defCard.type : null;
      const txt  = $('reveal-result-text');
      if (!atkCard || !defCard) {
        txt.textContent = 'A player has no cards.';
      } else if (atkT !== defT) {
        const dmg = Math.max(0, atk.damage + (atk.bonusDamageNext || 0) - (def.resistance || 0) - (def.armorReduction || 0));
        txt.innerHTML = `<span class="win">${atk.name} wins! ${def.name} takes ${dmg} damage.</span>`;
      } else {
        txt.innerHTML = `<span class="tie">${def.name} blocks! Cards matched.</span>`;
      }
    }
  }

  function _showHuntCombat(combat) {
    const atk = GS.getPlayer(combat.attackerId);
    const el  = $('combat-overlay');
    el.innerHTML = '';
    el.classList.remove('hidden');

    if (combat.phase === 'attacker_select') {
      _buildCardSelector(atk,
        `Round ${combat.round}/3 — <b>${atk.name}</b> hunts a Monster<br><small>Different card = win; Same = monster counters</small>`,
        uid => GS.selectCombatCard(atk.id, uid));
    } else if (combat.phase === 'monster_roll') {
      const box = document.createElement('div');
      box.className = 'combat-box';
      box.innerHTML = `
        <div class="combat-title">Roll Monster Die</div>
        <p>Another player rolls for the monster…</p>`;
      const rollBtn = document.createElement('button');
      rollBtn.className = 'btn btn-primary big-btn';
      rollBtn.textContent = '🎲 Roll Monster Die';
      rollBtn.onclick = () => GS.rollMonsterDie();
      box.appendChild(rollBtn);
      el.appendChild(box);
    } else if (combat.phase === 'reveal') {
      const atkCard = _getCardObj(atk, combat.attackerCard);
      const box = document.createElement('div');
      box.className = 'combat-box';
      const result = atkCard && combat.monsterRoll && atkCard.type !== combat.monsterRoll;
      box.innerHTML = `
        <div class="combat-title">Hunt Result</div>
        <div class="reveal-row">
          <div class="reveal-player">
            <div class="reveal-name">${atk.name}</div>
            <div class="combat-card-big type-${atkCard ? atkCard.type : 'none'}">
              ${atkCard ? COMBAT_CARD_ICONS[atkCard.type] : '?'}<br>${atkCard ? atkCard.type.toUpperCase() : 'NONE'}
            </div>
          </div>
          <div class="vs-text">VS</div>
          <div class="reveal-player">
            <div class="reveal-name">Monster</div>
            <div class="combat-card-big type-${combat.monsterRoll || 'none'}">
              ${combat.monsterRoll ? COMBAT_CARD_ICONS[combat.monsterRoll] : '?'}<br>
              ${combat.monsterRoll ? combat.monsterRoll.toUpperCase() : '?'}
            </div>
          </div>
        </div>
        <div class="reveal-result">${result ? '<span class="win">You win! +1 Item</span>' : '<span class="lose">Monster counters!</span>'}</div>`;
      el.appendChild(box);
    }
  }

  function _showSeekingArrow(combat) {
    const atk = GS.getPlayer(combat.attackerId);
    const def = GS.getPlayer(combat.defenderId);

    if (combat.phase === 'attacker_select') {
      _buildPassDeviceScreen(atk.name, `play an attack card for Seeking Arrow`, () => {
        _buildCardSelector(atk,
          `🏹 Seeking Arrow — <b>${atk.name}</b> fires at <b>${def.name}</b><br>
           <small>Pick your card. Defender must match it to block. No counter if blocked.</small>`,
          uid => GS.selectCombatCard(atk.id, uid));
      });
    } else if (combat.phase === 'defender_select') {
      _buildPassDeviceScreen(def.name, `try to block the Seeking Arrow`, () => {
        _buildCardSelector(def,
          `🏹 Seeking Arrow — <b>${def.name}</b> is targeted!<br>
           <small>Match attacker's card type to block. No counter-attack possible.</small>`,
          uid => GS.selectCombatCard(def.id, uid));
      });
    } else if (combat.phase === 'reveal') {
      const atkCard = _getCardObj(atk, combat.attackerCard);
      const defCard = _getCardObj(def, combat.defenderCard);
      const blocked = atkCard && defCard && atkCard.type === defCard.type;
      const el = $('combat-overlay');
      el.innerHTML = '';
      el.classList.remove('hidden');
      const box = document.createElement('div');
      box.className = 'combat-box';
      box.innerHTML = `
        <div class="combat-title">🏹 Seeking Arrow — Result</div>
        <div class="reveal-row">
          <div class="reveal-player">
            <div class="reveal-name">${atk.name} (Attacker)</div>
            <div class="combat-card-big type-${atkCard ? atkCard.type : 'none'}">
              <span class="card-icon">${atkCard ? COMBAT_CARD_ICONS[atkCard.type] : '?'}</span>
              <span class="card-name">${atkCard ? atkCard.type.toUpperCase() : 'NONE'}</span>
            </div>
          </div>
          <div class="vs-text">VS</div>
          <div class="reveal-player">
            <div class="reveal-name">${def.name} (Defender)</div>
            <div class="combat-card-big type-${defCard ? defCard.type : 'none'}">
              <span class="card-icon">${defCard ? COMBAT_CARD_ICONS[defCard.type] : '?'}</span>
              <span class="card-name">${defCard ? defCard.type.toUpperCase() : 'NONE'}</span>
            </div>
          </div>
        </div>
        <div class="reveal-result">
          ${blocked
            ? `<span class="tie">${def.name} blocks! (matched ${defCard.type})</span>`
            : `<span class="win">${atk.name} hits! ${def.name} takes ${combat.arrowDamage} damage.</span>`}
        </div>`;
      el.appendChild(box);
    }
  }

  function _buildPassDeviceScreen(playerName, action, onReady) {
    const el = $('combat-overlay');
    el.innerHTML = '';
    el.classList.remove('hidden');
    const box = document.createElement('div');
    box.className = 'combat-box pass-device';
    box.innerHTML = `
      <div class="pass-icon">📱</div>
      <div class="pass-title">Pass the device to</div>
      <div class="pass-name">${playerName}</div>
      <div class="pass-action">to ${action}</div>`;
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary big-btn';
    btn.textContent = `I'm ${playerName} — Ready`;
    btn.onclick = onReady;
    box.appendChild(btn);
    el.appendChild(box);
  }

  function _getCardObj(player, uid) {
    return player.combatCards.find(c => c.uid === uid) || null;
  }

  // ══════════════════════════════════════════════════════════
  //  UPGRADES
  // ══════════════════════════════════════════════════════════
  function _showUpgrades(p) {
    const char = CHARACTERS.find(c => c.id === p.characterId);
    let html = `<h3 style="color:${char.color}">${char.name}'s Upgrades</h3><p>You have ${p.xp} XP</p><div class="upgrade-list">`;
    char.upgrades.forEach(u => {
      const owned   = p.upgrades.includes(u.id);
      const canAfford = p.xp >= u.cost;
      html += `
        <div class="upgrade-card${owned ? ' owned' : ''}">
          <div class="upg-name">${u.name} <span class="upg-cost">${u.cost} XP</span></div>
          <div class="upg-desc">${u.desc}</div>
          ${!owned ? `<button class="btn btn-primary${canAfford ? '' : ' disabled'}"
            ${canAfford ? `onclick="GS.buyUpgrade('${u.id}'); UI._closeUpgradePanel();"` : 'disabled'}>
            Buy (${u.cost} XP)</button>` : '<div class="owned-badge">✓ Owned</div>'}
        </div>`;
    });
    html += '</div>';
    _showModal('Upgrades', html, [
      { label: 'Close', cls: 'btn-cancel', onclick: _closeModal },
    ]);
  }

  function _closeUpgradePanel() { _closeModal(); _updateHUD(); _updateActionButtons(); }

  // ══════════════════════════════════════════════════════════
  //  MISC PROMPTS
  // ══════════════════════════════════════════════════════════
  function _onMindLinkReveal({ reveals }) {
    let html = '<div class="reveal-hands">';
    reveals.forEach(r => {
      const target = GS.getPlayer(r.playerId);
      html += `<div><b>${target.name}'s hand:</b><div class="hand-reveal">`;
      r.hand.forEach(card => {
        html += `<span class="combat-card-mini" style="background:${COMBAT_CARD_COLORS[card.type]}">${COMBAT_CARD_ICONS[card.type]} ${card.type}</span>`;
      });
      html += '</div></div>';
    });
    html += '</div>';
    _showModal('Mind-Link Reveal', html, [{ label: 'OK', cls: 'btn-primary', onclick: _closeModal }]);
  }

  function _onShadowPlunderPrompt({ attackerId, defenderId, targetName }) {
    const def = GS.getPlayer(defenderId);
    const canBlock = def.combatCards.length > 0;
    _buildPassDeviceScreen(targetName, `respond to Shadow-Plunder`, () => {
      _showModal(`${targetName}: Shadow-Plunder!`, `
        <p>${GS.getPlayer(attackerId).name} is stealing from you!</p>
        ${canBlock ? '<p>You can spend 1 Combat Card to block.</p>' : '<p>You have no cards to block with.</p>'}
      `, [
        canBlock ? { label: '🛡 Block (spend 1 Combat Card)', cls: 'btn-primary', onclick: () => { GS.resolveShadowPlunder(true); _closeModal(); }} : null,
        { label: '😞 Allow', cls: 'btn-cancel', onclick: () => { GS.resolveShadowPlunder(false); _closeModal(); }},
      ].filter(Boolean));
    });
  }

  function _onEmergencyDraw({ defenderId }) {
    const def = GS.getPlayer(defenderId);
    _buildPassDeviceScreen(def.name, `respond to incoming attack`, () => {
      _showModal(`${def.name}: Emergency Draw?`, `
        <p>You have 0 Combat Cards and are being attacked.</p>
        <p>Spend 1 XP (you have ${def.xp}) to draw 1 Combat Card for defense?</p>
      `, [
        def.xp >= 1 ? { label: '💫 Yes, spend 1 XP', cls: 'btn-primary', onclick: () => { GS.resolveEmergencyDraw(true); _closeModal(); }} : null,
        { label: 'No, fight without', cls: 'btn-cancel', onclick: () => { GS.resolveEmergencyDraw(false); _closeModal(); }},
      ].filter(Boolean));
    });
  }

  function _onTowerPrompt({ tileId, towerUsed }) {
    _showModal('Magic Tower', `
      <p>You are on a Magic Tower. Choose an action:</p>
      ${towerUsed ? '<p><em>Healing power already used this game.</em></p>' : ''}
    `, [
      { label: '🌀 Teleport to other Tower (1 AP)', cls: 'btn-primary', onclick: () => { GS.commitTowerAction('teleport'); _closeModal(); }},
      !towerUsed ? { label: '❤ Heal 3 HP (1 AP, once per game)', cls: 'btn-primary', onclick: () => { GS.commitTowerAction('heal'); _closeModal(); }} : null,
      { label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal },
    ].filter(Boolean));
  }

  function _onCaveDiscardPrompt({ playerId, hand }) {
    const p = GS.getPlayer(playerId);
    let html = `<p><b>${p.name}</b> enters the Cave! Discard 1 Combat Card of your choice:</p><div class="hand-reveal">`;
    hand.forEach(card => {
      html += `<button class="combat-card-mini selectable" style="background:${COMBAT_CARD_COLORS[card.type]};cursor:pointer;padding:6px 10px;"
        onclick="GS.resolveCaveDiscard(${card.uid}); UI._closeModal();">
        ${COMBAT_CARD_ICONS[card.type]} ${card.type}</button>`;
    });
    html += '</div>';
    _showModal('⛰ Cave', html, []);
  }

  function _onVandalismPrompt({ attackerId, defenderId, items }) {
    const atk = GS.getPlayer(attackerId);
    const def = GS.getPlayer(defenderId);
    let html = `<p><b>${atk.name}</b> uses Vandalism on <b>${def.name}</b>!</p>
      <p>Pick one of ${def.name}'s ${items.length} item(s) to destroy (blind pick):</p>
      <div class="hand-reveal">`;
    items.forEach((item, i) => {
      html += `<button style="background:#3a2a1a;border:2px solid #8b5a2a;border-radius:6px;padding:10px 14px;cursor:pointer;color:#ffcc88;font-size:13px;margin:3px;"
        onclick="UI._resolveVandalism(${attackerId}, ${defenderId}, ${item.uid})">
        📦 Item ${i + 1}</button>`;
    });
    html += '</div>';
    _showModal('Vandalism', html, [
      { label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal },
    ]);
  }

  function _resolveVandalism(attackerId, defenderId, itemUid) {
    _closeModal();
    GS.resolveVandalism(attackerId, defenderId, itemUid);
  }

  function _onSanguinePrompt({ attackerId, defenderId, actionsLeft }) {
    const atk = GS.getPlayer(attackerId);
    _showModal(`🩸 Sanguine Ritual?`, `
      <p><b>${atk.name}</b> is about to attack!</p>
      <p>Activate Sanguine Ritual? (costs 2 AP — you have ${actionsLeft} remaining)</p>
      <p>If you win this combat, recover <b>2 HP</b>.</p>
    `, [
      { label: '🩸 Yes, activate (2 AP)', cls: 'btn-primary', onclick: () => { _closeModal(); GS.resolveSanguineChoice(true);  }},
      { label: 'No, skip',                cls: 'btn-cancel',  onclick: () => { _closeModal(); GS.resolveSanguineChoice(false); }},
    ]);
  }

  function _onRotateTilePickPrompt({ playerId, tileIds }) {
    let html = '<p>Choose a tile to rotate:</p><div class="tile-grid">';
    tileIds.forEach(id => {
      const t  = GS.getTile(id);
      const td = TILE_TYPE_DATA[t.type] || {};
      html += `<button class="tile-pick-btn" onclick="UI._pickInteractTile(${id})">${td.icon || ''} T${id} (${td.label || t.type})</button>`;
    });
    html += '</div>';
    _showModal('Rotate Walled Tile', html, [
      { label: 'Cancel', cls: 'btn-cancel', onclick: () => { GS.cancelInteract(); _closeModal(); } },
    ]);
  }

  function _onMindDrainPrompt({ attackerId, defenderId }) {
    const atk = GS.getPlayer(attackerId);
    const def = GS.getPlayer(defenderId);
    let html = `<p><b>${atk.name}</b> uses Disarm on <b>${def.name}</b>!</p>
      <p>Choose one of ${def.name}'s ${def.combatCards.length} card(s) to discard (blind pick):</p>
      <div class="hand-reveal">`;
    def.combatCards.forEach((card, i) => {
      html += `<button style="background:#2a2a4a;border:2px solid #555;border-radius:6px;padding:12px 16px;cursor:pointer;color:#fff;font-size:14px;margin:3px;"
        onclick="GS.resolveMindDrain(${attackerId}, ${card.uid}); UI._closeModal();">
        🂠<br><small>Card ${i + 1}</small></button>`;
    });
    html += '</div>';
    _showModal('Disarm', html, [
      { label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal },
    ]);
  }

  function _onRotatePrompt({ playerId }) {
    const p    = GS.getPlayer(playerId);
    const tile = GS.getTile(p.tileId);
    if (!tile || !tile.hasWalls) { _toast('No walled tile here to rotate.', 'error'); return; }
    _showModal(`Rotate Tile ${tile.id}`, `<p>Use the Terrain Rotator to spin the walled tile:</p>`, [
      { label: '↻ Clockwise',         cls: 'btn-primary', onclick: () => { GS.commitRotateTile(tile.id, 'cw');  _closeModal(); }},
      { label: '↺ Counter-Clockwise', cls: 'btn-primary', onclick: () => { GS.commitRotateTile(tile.id, 'ccw'); _closeModal(); }},
      { label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal },
    ]);
  }

  function _onPeekReveal({ viewerId, targetId, hand }) {
    const tgt = GS.getPlayer(targetId);
    let html = `<b>${tgt.name}'s Combat Hand:</b><div class="hand-reveal">`;
    if (hand.length === 0) html += '<em>Empty</em>';
    hand.forEach(card => {
      html += `<span class="combat-card-mini" style="background:${COMBAT_CARD_COLORS[card.type]}">${COMBAT_CARD_ICONS[card.type]} ${card.type}</span>`;
    });
    html += '</div>';
    _showModal('Crystal Eye', html, [{ label: 'OK', cls: 'btn-primary', onclick: _closeModal }]);
  }

  function _onWorldShaper({ tiles }) {
    const activeTiles   = tiles.filter(t => !t.removed);
    const removedTiles  = tiles.filter(t => t.removed);
    let html = '<p>Choose action:</p><div class="tile-picker">';

    html += '<div><b>Remove an active tile:</b><div class="tile-grid">';
    activeTiles.forEach(t => {
      html += `<button class="tile-pick-btn" onclick="GS.resolveWorldShaper('remove', ${t.id}); UI._closeModal();">${TILE_TYPE_DATA[t.type].icon} T${t.id}</button>`;
    });
    html += '</div></div>';

    if (removedTiles.length > 0) {
      html += '<div><b>Restore a removed tile:</b><div class="tile-grid">';
      removedTiles.forEach(t => {
        html += `<button class="tile-pick-btn" onclick="GS.resolveWorldShaper('restore', ${t.id}); UI._closeModal();">${TILE_TYPE_DATA[t.type].icon} T${t.id}</button>`;
      });
      html += '</div></div>';
    }
    html += '</div>';
    _showModal('World Shaper', html, [{ label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal }]);
  }

  function _onSalvage({ discard }) {
    let html = '<p>Choose a Bronze item from the discard pile:</p><div class="item-grid">';
    discard.forEach(item => {
      html += `<button class="item-btn tier-bronze" onclick="GS.resolveSalvage(${item.uid}); UI._closeModal();">${item.icon} ${item.name}</button>`;
    });
    html += '</div>';
    _showModal('Archaeologist — Salvage', html, [{ label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal }]);
  }

  function _onRangedAttack({ attackerId, targets }) {
    _showPlayerPicker('Phantom Strike — Choose target', targets.map(id => GS.getPlayer(id)), targetId => {
      // Initiate seeking-arrow-style combat via item
      const atk = GS.getPlayer(attackerId);
      GS.commitSeekingArrow(targetId);
      _closeModal();
    });
  }

  function _onBlinkStrike({ attackerId, targets }) {
    _showPlayerPicker('Blink Strike — Choose target', targets.map(id => GS.getPlayer(id)), targetId => {
      GS.commitSeekingArrow(targetId);
      _closeModal();
    });
  }

  function _onVoidRift({ playerId, others }) {
    const s = GS.getState();
    // Step 1: pick where self goes
    _showModal('Void Rift — Teleport self', '<p>Select a tile to teleport to (click on the board), then pick a target.</p>',
      [{ label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal }]);
    _awaitTileClick(newTileId => {
      GS.resolveTeleport(playerId, newTileId);
      // Step 2: pick a target player to displace
      _showPlayerPicker('Void Rift — Displace opponent', others.map(id => GS.getPlayer(id)), targetId => {
        _awaitTileClick(destTile => {
          GS.resolveDisplace(targetId, destTile);
          _closeModal();
        });
        _closeModal();
        _toast('Select destination tile for opponent', 'info');
      });
    });
    _closeModal();
    _toast('Select your destination tile', 'info');
  }

  // ── Tile-click await ───────────────────────────────────────
  function onTileClicked(tileId) {
    const s = GS.getState();
    if (!s) return;

    if (_pendingTileClick) {
      const cb = _pendingTileClick;
      _pendingTileClick = null;
      cb(tileId);
      return;
    }

    const sub = s.subphase;
    if (sub === 'move') {
      GS.commitMove(tileId);
    } else if (sub === 'ability') {
      const pa = s.pendingAction;
      if (pa && pa.type === 'veil_step')   GS.commitVeilStep(tileId);
    }
    _updateActionButtons();
  }

  function _awaitTileClick(cb) {
    _pendingTileClick = cb;
  }

  function _awaitTileForItem(type, data) {
    const validTiles = data.validTiles;
    // Highlight valid tiles (GameScene handles via phase_changed)
    if (type === 'push') {
      _toast('Select a tile to push the player to.', 'info');
      _awaitTileClick(tileId => {
        if (!validTiles.includes(tileId)) { _toast('Invalid tile.', 'error'); return; }
        GS.resolvePush(data.pushedId, tileId);
      });
    } else if (type === 'teleport') {
      _toast('Select a tile to teleport to.', 'info');
      _awaitTileClick(tileId => GS.resolveTeleport(data.playerId, tileId));
    } else if (type === 'displace') {
      _toast('Select a tile to displace the opponent to.', 'info');
      _awaitTileClick(tileId => GS.resolveDisplace(data.targetId, tileId));
    }
    // Highlight valid tiles on the board
    const scene = window._gameScene;
    if (scene) scene.highlightTiles(validTiles, 0xffaa00);
  }

  // ── Player picker ─────────────────────────────────────────
  function _showPlayerPicker(title, players, onPick) {
    let html = '<div class="player-pick-list">';
    players.filter(Boolean).forEach(p => {
      const char = CHARACTERS.find(c => c.id === p.characterId);
      html += `<button class="player-pick-btn" style="border-color:${char ? char.color : '#fff'}"
        onclick="UI._pickPlayer(${p.id})">${p.name}<br><small>❤ ${p.hp}/${p.maxHp}</small></button>`;
    });
    html += '</div>';
    _showModal(title, html, [{ label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal }]);
    window._playerPickCallback = onPick;
  }

  function _pickPlayer(id) {
    if (window._playerPickCallback) {
      const cb = window._playerPickCallback;
      window._playerPickCallback = null;
      cb(id);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  GAME OVER
  // ══════════════════════════════════════════════════════════
  function _onGameOver({ winner }) {
    hide('hud');
    const p = winner !== null ? GS.getPlayer(winner) : null;
    const char = p ? CHARACTERS.find(c => c.id === p.characterId) : null;
    const el = $('gameover-overlay');
    if (!el) return;
    el.innerHTML = `
      <div class="gameover-box">
        <div class="gameover-crown">👑</div>
        <div class="gameover-title">${p ? 'VICTORY!' : 'GAME OVER'}</div>
        <div class="gameover-winner" style="color:${char ? char.color : '#fff'}">${p ? p.name : 'No survivors'}</div>
        ${p ? `<div class="gameover-char">${char ? char.lore : ''}</div>` : ''}
        <button class="btn btn-primary big-btn" onclick="location.reload()">Play Again</button>
      </div>`;
    show('gameover-overlay');
  }

  function _onPlayerEliminated({ playerId }) {
    const p    = GS.getPlayer(playerId);
    const char = CHARACTERS.find(c => c.id === p.characterId);
    _toast(`☠ ${p.name} (${char ? char.name : ''}) has been eliminated!`, 'warning');
    _updateHUD();
  }

  function _onRoundChanged({ round, scheduledRemoval }) {
    _toast(`⚠ Round ${round} — Tiles ${scheduledRemoval.join(', ')} removed!`, 'warning');
    _updateHUD();
    _updateActionButtons();
  }

  // ══════════════════════════════════════════════════════════
  //  TOOLTIP
  // ══════════════════════════════════════════════════════════
  function showTileTooltip(tile) {
    const el = $('tile-tooltip');
    if (!el) return;
    const td = TILE_TYPE_DATA[tile.type] || {};
    const playersHere = GS.getState().players.filter(p => p.alive && p.tileId === tile.id);
    let html = `<b>${td.icon} ${td.label} (T${tile.id})</b><br>${td.desc || ''}`;
    if (tile.removed) html = `<b>Removed tile (T${tile.id})</b>`;
    if (playersHere.length > 0) {
      html += '<br><small>Players: ' + playersHere.map(p => p.name).join(', ') + '</small>';
    }
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  function hideTileTooltip() {
    const el = $('tile-tooltip');
    if (el) el.classList.add('hidden');
  }

  // ══════════════════════════════════════════════════════════
  //  MODAL / TOAST
  // ══════════════════════════════════════════════════════════
  function _showModal(title, body, buttons) {
    const el = $('modal-overlay');
    if (!el) return;
    el.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">${title}</div>
        <div class="modal-body">${body}</div>
        <div class="modal-buttons">${
          buttons.map((b, i) =>
            `<button class="btn ${b.cls}" id="modal-btn-${i}">${b.label}</button>`
          ).join('')
        }</div>
      </div>`;
    el.classList.remove('hidden');
    buttons.forEach((b, i) => {
      const btn = $(`modal-btn-${i}`);
      if (btn) btn.onclick = b.onclick;
    });
  }

  function _closeModal() {
    hide('modal-overlay');
    _updateHUD();
    _updateActionButtons();
  }

  function _toast(msg, type = 'info') {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast toast-${type} show`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  function _appendLog(msg) {
    const el = $('game-log');
    if (!el) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = msg;
    el.insertBefore(entry, el.firstChild);
    // Keep log to 50 entries
    while (el.children.length > 50) el.removeChild(el.lastChild);
  }

  // ── State change handler ──────────────────────────────────
  function _onStateChanged() {
    _updateHUD();
    _updateActionButtons();
  }

  function _onPhaseChanged({ subphase }) {
    if (subphase === 'action_select') {
      _updateActionButtons();
      // Hide combat overlay if no active combat (e.g. after Shadow Plunder resolves)
      const s = GS.getState();
      if (s && !s.combat) hide('combat-overlay');
    }
    if (subphase === 'target_select') {
      // Handled in GameScene highlights
    }
  }

  // ── Seeking arrow from action bar ────────────────────────
  function commitSeekingArrowTarget(targetId) {
    GS.commitSeekingArrow(targetId);
  }

  // ── Mind-Link target UI ───────────────────────────────────
  GS.on('phase_changed', ({ subphase, targets, abilityName, twoTargets }) => {
    if (subphase === 'ability') {
      if (abilityName === 'Mind-Link' && targets) {
        if (twoTargets) {
          // Show picker for two targets
          const s = GS.getState();
          const players = targets.map(id => GS.getPlayer(id));
          let html = '<p>Select up to 2 targets:</p><div class="player-pick-list" id="ml-pick">';
          players.forEach(p => {
            const char = CHARACTERS.find(c => c.id === p.characterId);
            html += `<button class="player-pick-btn toggle-btn" data-id="${p.id}" style="border-color:${char ? char.color : '#fff'}"
              onclick="this.classList.toggle('selected')">${p.name}</button>`;
          });
          html += '</div>';
          _showModal('Mind-Link Targets', html, [
            { label: 'Confirm', cls: 'btn-primary', onclick: () => {
              const sel = [...document.querySelectorAll('.toggle-btn.selected')].map(b => parseInt(b.dataset.id));
              if (sel.length === 0) { _toast('Select at least 1 target.', 'error'); return; }
              _closeModal();
              GS.commitMindLink(sel);
            }},
            { label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal },
          ]);
        } else {
          _showPlayerPicker('Mind-Link — Choose target', targets.map(id => GS.getPlayer(id)), targetId => {
            _closeModal();
            GS.commitMindLink(targetId);
          });
        }
      } else if (abilityName === 'Shadow-Plunder' && targets) {
        _showPlayerPicker('Shadow-Plunder — Choose target', targets.map(id => GS.getPlayer(id)), targetId => {
          _closeModal();
          GS.commitShadowPlunder(targetId);
        });
      } else if (abilityName === 'Seeking Arrow' && targets) {
        _showPlayerPicker('Seeking Arrow — Choose target', targets.map(id => GS.getPlayer(id)), targetId => {
          _closeModal();
          GS.commitSeekingArrow(targetId);
        });
      }
    } else if (subphase === 'target_select') {
      if (targets) {
        _showPlayerPicker('Choose target to attack', targets.map(id => GS.getPlayer(id)), targetId => {
          _closeModal();
          GS.commitAttack(targetId);
        });
      }
    }
  });

  function _useReactionItem(playerId, itemUid) {
    itemUid = parseInt(itemUid);
    const p = GS.getPlayer(playerId);
    if (!p) return;
    const item = p.items.find(i => i.uid === itemUid);
    if (!item) { _toast('Item not found.', 'error'); return; }
    if (item.timing !== 'reaction') { _toast('Can only use this as a reaction.', 'info'); return; }
    GS.useItem(playerId, itemUid, null);
  }

  function _pickRotateTileItem(playerId, itemUid, tileId) {
    _closeModal();
    _showModal(`Rotate Tile T${tileId}`, '<p>Choose rotation direction:</p>', [
      { label: '↻ Clockwise',         cls: 'btn-primary', onclick: () => { _closeModal(); GS.useItem(playerId, itemUid, null, { tileId, direction: 'cw'  }); }},
      { label: '↺ Counter-Clockwise', cls: 'btn-primary', onclick: () => { _closeModal(); GS.useItem(playerId, itemUid, null, { tileId, direction: 'ccw' }); }},
      { label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal },
    ]);
  }

  function _useWorldShaperItem(playerId, itemUid, action, tileId) {
    _closeModal();
    GS.useItem(playerId, itemUid, null, { action, tileId });
  }

  function _useSalvageItem(playerId, itemUid, salvageUid) {
    _closeModal();
    GS.useItem(playerId, itemUid, null, { salvageUid });
  }

  function _pickInteractTile(tileId) {
    _closeModal();
    _showModal(`Rotate Tile T${tileId}`, '<p>Choose rotation direction:</p>', [
      { label: '↻ Clockwise',         cls: 'btn-primary', onclick: () => { GS.commitRotateTile(tileId, 'cw');  _closeModal(); }},
      { label: '↺ Counter-Clockwise', cls: 'btn-primary', onclick: () => { GS.commitRotateTile(tileId, 'ccw'); _closeModal(); }},
      { label: 'Cancel', cls: 'btn-cancel', onclick: () => { GS.cancelInteract(); _closeModal(); }},
    ]);
  }

  // ── Expose some internals for inline onclick ───────────────
  return {
    init,
    onTileClicked,
    showTileTooltip,
    hideTileTooltip,
    _closeModal,
    _closeUpgradePanel,
    _pickPlayer,
    _useReactionItem,
    _pickRotateTileItem,
    _useWorldShaperItem,
    _useSalvageItem,
    _pickInteractTile,
    _resolveVandalism,
  };
})();
