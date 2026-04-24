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
  let _charSelectDefaults = null;

  // ── Multiplayer gating helpers ────────────────────────────
  // Returns true if the current-turn event should show UI to me
  function _isMyTurnEvent() {
    if (!window.Multiplayer || !Multiplayer.isActive()) return true;
    return Multiplayer.isMyTurn();
  }
  // Returns true if a specific-player event should show UI to me
  function _isMyPlayerEvent(playerIndex) {
    if (!window.Multiplayer || !Multiplayer.isActive()) return true;
    return Multiplayer.isMyPlayer(playerIndex);
  }

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    // Set up all GS event listeners first (synchronous)
    GS.on('state_changed', s => {
      if (window.Multiplayer && Multiplayer.isActive() && !Multiplayer.isApplyingRemote()) {
        Multiplayer.pushState(s);
      }
    });
    GS.on('state_changed',         _onStateChanged);
    GS.on('phase_changed',         _onPhaseChanged);
    GS.on('combat_start',          _onCombatStart);
    GS.on('combat_update',         _onCombatUpdate);
    GS.on('combat_end',            _onCombatEnd);
    GS.on('counter_choice_prompt', _onCounterChoice);
    GS.on('log',                   () => _renderFullLog());  // re-render log on any new entry
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
    GS.on('shadow_plunder_reveal',   _onShadowPlunderReveal);
    GS.on('phantom_bolt_prompt',     _onPhantomBoltPrompt);

    // Check for saved multiplayer session (page refresh rejoin)
    if (window.Multiplayer && Multiplayer.getSavedSession()) {
      const contentEl = $('char-select-content');
      show('char-select');
      if (contentEl) contentEl.innerHTML =
        '<div style="text-align:center;padding:48px 24px;color:#aaa;font-size:15px;">🔄 Reconnecting to your game…</div>';
      try {
        const rejoined = await Multiplayer.rejoinRoom();
        if (rejoined) {
          hide('char-select');
          show('right-panel');
          _buildHUD();
          _toast('Reconnected to your game!', 'info');
          return;
        }
      } catch(e) {
        console.warn('[UI] Rejoin failed:', e);
      }
    }

    _buildCharSelectScreen();
  }

  // ══════════════════════════════════════════════════════════
  //  CHARACTER SELECTION SCREEN
  // ══════════════════════════════════════════════════════════
  function _buildCharSelectScreen() {
    show('char-select');
    const container = $('char-select-content');
    container.innerHTML = '';

    // ── Deep-link: auto-show join screen if ?room= is in URL ──
    const urlRoomCode = new URLSearchParams(location.search).get('room');
    if (urlRoomCode && window.Multiplayer && Multiplayer.isConfigured()) {
      _buildInstantJoinScreen(container, urlRoomCode.toUpperCase());
      return;
    }

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

    // ── Online Multiplayer section ────────────────────────
    if (window.Multiplayer && Multiplayer.isConfigured()) {
      const divider = document.createElement('div');
      divider.style.cssText = 'border-top:1px solid #2a2a5a;margin:18px 0 12px;text-align:center;color:#666;font-size:12px;padding-top:12px;';
      divider.textContent = '— or play online —';
      container.appendChild(divider);

      const onlineBtn = document.createElement('button');
      onlineBtn.className = 'btn btn-secondary big-btn';
      onlineBtn.textContent = '🌐 Play Online (Multiplayer)';
      onlineBtn.style.background = '#1a2a4a';
      onlineBtn.onclick = () => {
        const lobby = $('mp-lobby');
        if (lobby) lobby.classList.toggle('hidden');
      };
      container.appendChild(onlineBtn);

      _buildMpLobby(container);
      // Deep-link: auto-open lobby when ?room= param is in the URL
      const urlRoomParam = new URLSearchParams(location.search).get('room');
      if (urlRoomParam) {
        const lobby = $('mp-lobby');
        if (lobby) lobby.classList.remove('hidden');
      }
    } else if (window.Multiplayer) {
      const cfg = document.createElement('p');
      cfg.style.cssText = 'color:#555;font-size:11px;text-align:center;margin-top:16px;';
      cfg.textContent = '🌐 Online play: fill in firebase-config.js to enable.';
      container.appendChild(cfg);
    }

    countSel.onchange = () => _renderPlayerSetup(parseInt(countSel.value));
    _renderPlayerSetup(2);
  }

  // ── Instant-join screen (for invite-link players) ─────────
  function _buildInstantJoinScreen(container, roomCode) {
    container.innerHTML = `
      <div class="panel-header">AVATERRA</div>
      <div class="panel-sub" style="margin-bottom:18px;">You've been invited to join a game!</div>
      <div style="background:#0d0d22;border:1px solid #3a3a6a;border-radius:8px;padding:20px;">
        <div style="font-size:20px;font-weight:bold;letter-spacing:4px;color:#aaddff;text-align:center;margin-bottom:14px;">${roomCode}</div>
        <label style="color:#888;font-size:12px;">Your name:</label>
        <input id="ij-name" type="text" placeholder="Enter your name" autofocus
          style="width:100%;background:#1a1a3a;border:1px solid #3a3a6a;color:#ccc;border-radius:4px;
                 padding:8px;margin:6px 0 14px;font-size:14px;font-family:inherit;"
          onkeydown="if(event.key==='Enter') UI._instantJoin()">
        <button class="btn btn-primary big-btn" onclick="UI._instantJoin()">▶ Join Game</button>
        <button class="btn btn-secondary" style="width:100%;margin-top:8px;font-size:12px;"
          onclick="UI._buildCharSelectScreen()">← Back to Main Menu</button>
      </div>`;

    // Auto-focus the name field
    setTimeout(() => { const f = document.getElementById('ij-name'); if (f) f.focus(); }, 50);

    // Store the room code for _instantJoin to use
    container._pendingRoomCode = roomCode;
  }

  async function _instantJoin() {
    const container  = $('char-select-content');
    const roomCode   = container._pendingRoomCode || new URLSearchParams(location.search).get('room') || '';
    const nameInput  = document.getElementById('ij-name');
    const name       = (nameInput ? nameInput.value : '').trim() || 'Player';

    // Show loading state
    const btn = container.querySelector('.btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Joining…'; }

    try {
      const slot = await Multiplayer.joinRoom(roomCode.toUpperCase(), name);
      _mpShowWaiting(roomCode.toUpperCase(), slot, null, false);
    } catch (e) {
      _toast(e.message || 'Failed to join room.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '▶ Join Game'; }
    }
  }

  // ── Multiplayer lobby UI ─────────────────────────────────
  function _buildMpLobby(container) {
    const lobby = document.createElement('div');
    lobby.id = 'mp-lobby';
    lobby.className = 'hidden';
    lobby.style.cssText = 'background:#0d0d22;border:1px solid #3a3a6a;border-radius:8px;padding:16px;margin-top:10px;';

    const urlRoom = new URLSearchParams(location.search).get('room');

    lobby.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <button id="mp-tab-create" class="btn btn-primary" style="flex:1;opacity:${urlRoom?0.6:1}"
          onclick="UI._mpTab('create')">➕ Create Room</button>
        <button id="mp-tab-join" class="btn btn-secondary" style="flex:1;opacity:${urlRoom?1:0.6}"
          onclick="UI._mpTab('join')">🔗 Join Room</button>
      </div>

      <!-- CREATE pane -->
      <div id="mp-create-pane" style="display:${urlRoom?'none':'block'}">
        <label style="color:#888;font-size:12px;">Your name:</label>
        <input id="mp-host-name" type="text" placeholder="Your name" value="Host"
          style="width:100%;background:#1a1a3a;border:1px solid #3a3a6a;color:#ccc;border-radius:4px;padding:5px 8px;margin:4px 0 8px;">
        <label style="color:#888;font-size:12px;">Number of players:</label>
        <select id="mp-player-count" style="width:100%;background:#1a1a3a;border:1px solid #3a3a6a;color:#ccc;border-radius:4px;padding:5px 8px;margin:4px 0 8px;">
          ${[2,3,4,5,6].map(n=>`<option value="${n}">${n} Players</option>`).join('')}
        </select>
        <p style="color:#888;font-size:11px;margin-bottom:8px;">💡 Characters are chosen in the lobby after all players join.</p>
        <button class="btn btn-primary big-btn" style="margin-top:6px;"
          onclick="UI._mpCreateRoom()">Create Room</button>
      </div>

      <!-- JOIN pane -->
      <div id="mp-join-pane" style="display:${urlRoom?'block':'none'}">
        <label style="color:#888;font-size:12px;">Your name:</label>
        <input id="mp-join-name" type="text" placeholder="Your name" value="Player"
          style="width:100%;background:#1a1a3a;border:1px solid #3a3a6a;color:#ccc;border-radius:4px;padding:5px 8px;margin:4px 0 8px;">
        <label style="color:#888;font-size:12px;">Room Code:</label>
        <input id="mp-room-code" type="text" placeholder="6-char code" maxlength="6"
          style="width:100%;background:#1a1a3a;border:1px solid #3a3a6a;color:#ccc;border-radius:4px;padding:5px 8px;margin:4px 0 8px;text-transform:uppercase;"
          value="${urlRoom || ''}">
        <p style="color:#888;font-size:11px;margin-bottom:8px;">💡 Characters are chosen in the lobby after joining.</p>
        <button class="btn btn-primary big-btn" style="margin-top:6px;"
          onclick="UI._mpJoinRoom()">Join Room</button>
      </div>

      <!-- WAITING room (shown after create/join) -->
      <div id="mp-waiting" style="display:none">
        <div id="mp-room-info" style="text-align:center;margin-bottom:10px;"></div>
        <div id="mp-char-picker" style="margin-bottom:10px;"></div>
        <div id="mp-player-slots" style="margin-bottom:8px;"></div>
        <button id="mp-start-btn" class="btn btn-primary big-btn" style="display:none;margin-top:10px;"
          onclick="UI._mpStartGame()">▶ Start Game</button>
        <p id="mp-waiting-msg" style="color:#888;font-size:12px;text-align:center;margin-top:8px;"></p>
      </div>
    `;
    container.appendChild(lobby);
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
      // Default: random character per player (shuffled so no two start with same)
      if (!_charSelectDefaults) {
        _charSelectDefaults = [...CHARACTERS].sort(() => Math.random() - 0.5).map(c => c.id);
      }
      charSel.value = _charSelectDefaults[i % _charSelectDefaults.length];

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
    show('right-panel');
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
      const isOffTurn  = !isCur && p.alive;
      const canInterruptDraw = isOffTurn && p.combatCards.length < p.combatCardCap;
      const reactHtml  = (reactItems.length > 0 || canInterruptDraw)
        ? '<div class="pi-reactions">' +
            reactItems.map(i =>
              `<button class="item-btn-mini tier-${i.tier}" title="${i.desc}"
                onclick="UI._useReactionItem(${p.id}, ${i.uid})">${i.icon}</button>`
            ).join('') +
            (canInterruptDraw
              ? `<button class="item-btn-mini tier-bronze" title="Interrupt: draw 1 card (costs 1 AP next turn)"
                  onclick="GS.interruptDrawCard(${p.id})">🃏+</button>`
              : '') +
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
    // In multiplayer, always show MY player's hand (not the current turn player's)
    const isMP = window.Multiplayer && Multiplayer.isActive();
    const p    = isMP ? GS.getPlayer(Multiplayer.getMyIndex()) : GS.currentPlayer();
    const el   = $('hand-display');
    if (!el || !p) return;
    const label = isMP ? `Your Combat Hand (${p.name}):` : 'Combat Hand:';
    el.innerHTML = `<div class="hand-label">${label}</div>`;
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
    // In multiplayer, always show MY player's inventory
    const isMP = window.Multiplayer && Multiplayer.isActive();
    const p    = isMP ? GS.getPlayer(Multiplayer.getMyIndex()) : GS.currentPlayer();
    const el   = $('inventory-display');
    if (!el || !p) return;
    const label = isMP ? `Your Inventory (${p.name}):` : 'Inventory:';
    el.innerHTML = `<div class="inv-label">${label}</div>`;
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
      { id: 'btn-draw',    label: '🃏 Draw Cards',       onclick: () => _promptDrawCards(p), enabled: p.actionsLeft >= 1 && p.combatCards.length < p.combatCardCap },
      { id: 'btn-interact',label: '🔧 Interact Tile',   onclick: () => GS.beginInteract(),  enabled: p.actionsLeft >= 1 && _canInteract(p) },
      { id: 'btn-buy',     label: '💰 Buy Item',         onclick: () => _promptBuyItem(p),   enabled: _canBuyItem(p) },
      { id: 'btn-end',     label: '✅ End Turn',          onclick: () => _confirmEndTurn(),   enabled: true },
    ];

    const notMyTurn = Multiplayer.isActive() && !Multiplayer.isMyTurn();

    const bar = $('action-bar');
    if (!bar) return;
    bar.innerHTML = '';
    actions.forEach(a => {
      const enabled = a.enabled && !notMyTurn;
      const btn = document.createElement('button');
      btn.id = a.id;
      btn.className = `action-btn${enabled ? '' : ' disabled'}`;
      btn.innerHTML = a.label;
      if (enabled) btn.onclick = a.onclick;
      if (a.tooltip) btn.title = a.tooltip;
      if (notMyTurn) btn.title = "It's not your turn";
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
    const max   = Math.min(space, p.actionsLeft);
    if (max === 0) { _toast('Not enough actions or hand is full.', 'info'); return; }
    _showModal('Draw Combat Cards', `
      <p>Spend <b>1 AP per card</b> to draw cards (max: ${max}, you have ${p.actionsLeft} AP).</p>
      <input type="range" id="draw-slider" min="1" max="${max}" value="1">
      <div id="draw-val">Draw 1 card (costs 1 AP)</div>
    `, [
      { label: 'Draw', cls: 'btn-primary', onclick: () => {
        const n = parseInt($('draw-slider').value);
        _closeModal();
        GS.actionDrawCards(n);
      }},
      { label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal },
    ]);
    const sl = $('draw-slider');
    if (sl) sl.oninput = () => { $('draw-val').textContent = `Draw ${sl.value} card(s) (costs ${sl.value} AP)`; };
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
    if (!_isMyPlayerEvent(defenderId)) return;
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
      // Gate: only show card picker to the hunter; others see waiting screen
      _buildPassDeviceScreen(atk.name, 'pick your combat card', () => {
        _buildCardSelector(atk,
          `Round ${combat.round}/3 — <b>${atk.name}</b> hunts a Monster<br><small>Different card = win; Same = monster counters</small>`,
          uid => GS.selectCombatCard(atk.id, uid));
      });
    } else if (combat.phase === 'monster_roll') {
      const iAmAttacker = _isMyPlayerEvent(atk.id);
      const isMP = window.Multiplayer && Multiplayer.isActive();

      // In multiplayer: non-attacker clients show waiting screen
      if (isMP && !iAmAttacker) {
        const box = document.createElement('div');
        box.className = 'combat-box pass-device';
        box.innerHTML = `
          <div class="pass-icon">⏳</div>
          <div class="pass-title">Waiting for</div>
          <div class="pass-name">${atk.name}</div>
          <div class="pass-action">to roll the monster die…</div>`;
        el.appendChild(box);
        return;
      }

      // Attacker's client (or hotseat) — show roll UI
      const box = document.createElement('div');
      box.className = 'combat-box';
      box.innerHTML = `
        <div class="combat-title">Roll Monster Die</div>
        <p>${isMP ? 'Roll to see what the monster plays!' : 'Another player rolls for the monster…'}</p>
        <div id="roulette-display" class="roulette-die">🎲</div>`;
      const rollBtn = document.createElement('button');
      rollBtn.className = 'btn btn-primary big-btn';
      rollBtn.id = 'roll-monster-btn';
      rollBtn.textContent = '🎲 Roll Monster Die';
      rollBtn.onclick = () => {
        rollBtn.disabled = true;
        const types = Object.keys(COMBAT_CARD_ICONS);
        const display = document.getElementById('roulette-display');
        let ticks = 0;
        const totalTicks = 18 + Math.floor(Math.random() * 10);
        const interval = setInterval(() => {
          const t = types[Math.floor(Math.random() * types.length)];
          display.textContent = COMBAT_CARD_ICONS[t];
          display.className = `roulette-die type-${t}`;
          ticks++;
          if (ticks >= totalTicks) {
            clearInterval(interval);
            display.classList.add('roulette-done');
            setTimeout(() => GS.rollMonsterDie(), 200);
          }
        }, 80 + ticks * 4);
      };
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
    // In online multiplayer: if this player is me → skip the pass screen and act immediately;
    // if it's someone else → show a "waiting" screen instead.
    if (window.Multiplayer && Multiplayer.isActive()) {
      const myPlayer = GS.getPlayer(Multiplayer.getMyIndex());
      const isMe = myPlayer && myPlayer.name === playerName;
      if (isMe) {
        onReady();   // my turn — act immediately
        return;
      }
      // Another player's turn — show waiting screen
      const el = $('combat-overlay');
      el.innerHTML = '';
      el.classList.remove('hidden');
      const box = document.createElement('div');
      box.className = 'combat-box pass-device';
      box.innerHTML = `
        <div class="pass-icon">⏳</div>
        <div class="pass-title">Waiting for</div>
        <div class="pass-name">${playerName}</div>
        <div class="pass-action">to ${action}…</div>
        <p style="color:#666;font-size:11px;margin-top:12px">Their screen will update automatically.</p>`;
      el.appendChild(box);
      return;
    }
    // ── Hotseat (original behaviour) ──────────────────────
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

  function _onShadowPlunderPrompt({ attackerId, defenderId, phase }) {
    const atk = GS.getPlayer(attackerId);
    const def = GS.getPlayer(defenderId);
    if (phase === 'attacker_select') {
      _buildPassDeviceScreen(atk.name, 'play a card for Shadow-Plunder', () => {
        _buildCardSelector(atk,
          `🃏 Shadow-Plunder — <b>${atk.name}</b> attacks <b>${def.name}</b><br>
           <small>Play a card. Defender must match to protect their item.</small>`,
          uid => GS.selectShadowPlunderCard(atk.id, uid));
      });
    } else if (phase === 'defender_select') {
      _buildPassDeviceScreen(def.name, 'defend against Shadow-Plunder', () => {
        if (def.combatCards.length === 0) {
          _showModal('Shadow-Plunder!', `<p>${def.name} has no cards — item stolen!</p>`, [
            { label: 'OK', cls: 'btn-primary', onclick: () => { _closeModal(); GS.selectShadowPlunderCard(def.id, -1); }},
          ]);
        } else {
          _buildCardSelector(def,
            `🛡 Shadow-Plunder — <b>${def.name}</b> defends<br>
             <small>Match the attacker's card type to protect your item.</small>`,
            uid => GS.selectShadowPlunderCard(def.id, uid));
        }
      });
    }
  }

  function _onShadowPlunderReveal({ attackerId, defenderId, attackerCardType, defenderCardType, blocked }) {
    const atk = GS.getPlayer(attackerId);
    const def = GS.getPlayer(defenderId);
    const atkIcon = attackerCardType ? (COMBAT_CARD_ICONS[attackerCardType] || attackerCardType) : '?';
    const defIcon = defenderCardType ? (COMBAT_CARD_ICONS[defenderCardType] || defenderCardType) : '—';
    _showModal('Shadow-Plunder Result', `
      <div class="reveal-row">
        <div class="reveal-player"><div class="reveal-name">${atk.name}</div>
          <div class="combat-card-big type-${attackerCardType||'none'}">${atkIcon}<br>${(attackerCardType||'').toUpperCase()}</div></div>
        <div class="vs-text">VS</div>
        <div class="reveal-player"><div class="reveal-name">${def.name}</div>
          <div class="combat-card-big type-${defenderCardType||'none'}">${defIcon}<br>${(defenderCardType||'').toUpperCase()}</div></div>
      </div>
      <div class="reveal-result">${blocked
        ? `<span class="win">Blocked! ${def.name} keeps their item.</span>`
        : `<span class="lose">Stolen! ${atk.name} takes the item.</span>`}</div>
    `, [{ label: 'Continue', cls: 'btn-primary', onclick: _closeModal }]);
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

  function _onTowerPrompt({ tileId, towerUsed, rotatableTileIds }) {
    if (!_isMyTurnEvent()) return;
    const rotateBtn = (rotatableTileIds && rotatableTileIds.length > 0)
      ? { label: '🔄 Rotate Nearby Tile (1 AP)', cls: 'btn-primary', onclick: () => {
          _closeModal();
          _pickRotateTileItem(rotatableTileIds);
        }}
      : null;
    _showModal('Magic Tower', `
      <p>You are on a Magic Tower. Choose an action:</p>
      ${towerUsed ? '<p><em>Healing power already used this game.</em></p>' : ''}
    `, [
      { label: '🌀 Teleport to other Tower (1 AP)', cls: 'btn-primary', onclick: () => { _closeModal(); GS.commitTowerAction('teleport'); }},
      !towerUsed ? { label: '❤ Heal 3 HP (1 AP, once per game)', cls: 'btn-primary', onclick: () => { _closeModal(); GS.commitTowerAction('heal'); }} : null,
      rotateBtn,
      { label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal },
    ].filter(Boolean));
  }

  function _onCaveDiscardPrompt({ playerId, hand }) {
    if (!_isMyPlayerEvent(playerId)) return;
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
    if (!_isMyPlayerEvent(attackerId)) return;
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
    if (!_isMyPlayerEvent(attackerId)) return;
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
    if (!_isMyPlayerEvent(playerId)) return;
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
    if (!_isMyPlayerEvent(attackerId)) return;
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
    if (!_isMyPlayerEvent(playerId)) return;
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
    const viewer = GS.getPlayer(viewerId);
    const tgt    = GS.getPlayer(targetId);
    _buildPassDeviceScreen(viewer.name, `peek at ${tgt.name}'s hand`, () => {
      let html = `<p><b>${tgt.name}'s</b> full Combat Hand (${hand.length} card${hand.length !== 1 ? 's' : ''}):</p>
        <div class="hand-reveal">`;
      if (hand.length === 0) {
        html += '<em style="color:#888">— empty —</em>';
      } else {
        hand.forEach(card => {
          html += `<span class="combat-card-mini" style="background:${COMBAT_CARD_COLORS[card.type]};padding:8px 12px;font-size:14px">
            ${COMBAT_CARD_ICONS[card.type]} ${card.type.toUpperCase()}</span>`;
        });
      }
      html += '</div>';
      _showModal(`👁 Peek — ${viewer.name}`, html, [{ label: 'Done', cls: 'btn-primary', onclick: _closeModal }]);
    });
  }

  function _onWorldShaper({ tiles }) {
    if (!_isMyTurnEvent()) return;
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
    if (!_isMyTurnEvent()) return;
    let html = '<p>Choose a Bronze item from the discard pile:</p><div class="item-grid">';
    discard.forEach(item => {
      html += `<button class="item-btn tier-bronze" onclick="GS.resolveSalvage(${item.uid}); UI._closeModal();">${item.icon} ${item.name}</button>`;
    });
    html += '</div>';
    _showModal('Archaeologist — Salvage', html, [{ label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal }]);
  }

  function _onRangedAttack({ attackerId, targets }) {
    if (!_isMyPlayerEvent(attackerId)) return;
    _showPlayerPicker('Phantom Strike — Choose target', targets.map(id => GS.getPlayer(id)), targetId => {
      // Initiate seeking-arrow-style combat via item
      const atk = GS.getPlayer(attackerId);
      GS.commitSeekingArrow(targetId);
      _closeModal();
    });
  }

  function _onBlinkStrike({ attackerId, targets }) {
    if (!_isMyPlayerEvent(attackerId)) return;
    _showPlayerPicker('Blink Strike — Choose target', targets.map(id => GS.getPlayer(id)), targetId => {
      GS.commitSeekingArrow(targetId);
      _closeModal();
    });
  }

  function _onPhantomBoltPrompt({ attackerId, targets }) {
    if (!_isMyPlayerEvent(attackerId)) return;
    const atk      = GS.getPlayer(attackerId);
    const selected = [];
    function rebuild() {
      let h = `<p><b>${atk.name}</b> fires Phantom Bolt (ignores walls). Select up to 2 targets:</p>
        <div class="hand-reveal">`;
      targets.forEach(id => {
        const p   = GS.getPlayer(id);
        const sel = selected.includes(id);
        h += `<button style="background:${sel?'#4a1a3a':'#1a1a3a'};border:2px solid ${sel?'#ff44aa':'#5555aa'};
              color:#eee;border-radius:6px;padding:8px 14px;cursor:pointer;margin:3px;"
              onclick="UI._pbToggle(${id})">${p.name}${sel?' ✓':''}</button>`;
      });
      h += '</div>';
      return h;
    }
    UI._pbToggle = (id) => {
      const idx = selected.indexOf(id);
      if (idx === -1) { if (selected.length < 2) selected.push(id); }
      else selected.splice(idx, 1);
      const body = document.querySelector('#modal-overlay .modal-body');
      if (body) body.innerHTML = rebuild();
    };
    _showModal('⚡ Phantom Bolt', rebuild(), [
      { label: 'Fire!', cls: 'btn-primary', onclick: () => {
        if (selected.length === 0) { _toast('Select at least 1 target.', 'error'); return; }
        _closeModal();
        GS.resolvePhantomBolt(attackerId, selected);
      }},
      { label: 'Cancel', cls: 'btn-cancel', onclick: _closeModal },
    ]);
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
    hide('right-panel');
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
    // Log entries are pushed to state.log by GameState.emit; rendered via _renderFullLog
    _renderFullLog();
  }

  function _renderFullLog() {
    const el = $('game-log');
    const s  = GS.getState();
    if (!el || !s || !s.log) return;
    const entries = s.log;  // newest-last array
    el.innerHTML = '';
    // Render newest first
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      const msg = typeof e === 'string' ? e : (e.msg || '');
      const round = typeof e === 'object' ? (e.round || '') : '';
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.innerHTML = round
        ? `<span class="log-prefix">[R${round}]</span> ${msg}`
        : msg;
      el.appendChild(div);
    }
  }

  // ── State change handler ──────────────────────────────────
  function _onStateChanged() {
    const s = GS.getState();
    _updateHUD();
    _updateActionButtons();
    _updateSpectatorBar();
    _renderFullLog();
    // Close stale combat overlay when combat ends (received via remote state)
    if (s && !s.combat && s.subphase === 'action_select' && !s.pendingAction) {
      hide('combat-overlay');
    }
  }

  function _updateSpectatorBar() {
    const bar = $('mp-spectator-bar');
    if (!bar) return;
    if (!window.Multiplayer || !Multiplayer.isActive()) { bar.style.display = 'none'; return; }
    const s  = GS.getState();
    if (!s) { bar.style.display = 'none'; return; }
    const cp   = GS.currentPlayer();
    const char = cp ? CHARACTERS.find(c => c.id === cp.characterId) : null;
    if (Multiplayer.isMyTurn()) {
      bar.style.display = 'none';
    } else {
      bar.style.display = 'block';
      bar.innerHTML = `⏳ Waiting for <b style="color:${char?char.color:'#fff'}">${cp ? cp.name : '?'}</b> to take their turn…`;
    }
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

  // ══════════════════════════════════════════════════════════
  //  MULTIPLAYER LOBBY ACTIONS
  // ══════════════════════════════════════════════════════════

  function _mpTab(tab) {
    $('mp-create-pane').style.display = tab === 'create' ? 'block' : 'none';
    $('mp-join-pane').style.display   = tab === 'join'   ? 'block' : 'none';
    $('mp-tab-create').style.opacity  = tab === 'create' ? '1' : '0.6';
    $('mp-tab-join').style.opacity    = tab === 'join'   ? '1' : '0.6';
  }

  async function _mpCreateRoom() {
    const name  = ($('mp-host-name').value || 'Host').trim();
    const count = parseInt($('mp-player-count').value);
    try {
      const roomId = await Multiplayer.createRoom(count, name);
      _mpShowWaiting(roomId, 0, count, true);
    } catch (e) {
      _toast(e.message, 'error');
    }
  }

  async function _mpJoinRoom() {
    const name = ($('mp-join-name').value || 'Player').trim();
    const code = ($('mp-room-code').value || '').toUpperCase().trim();
    if (!code) { _toast('Enter a room code.', 'error'); return; }
    try {
      const slot = await Multiplayer.joinRoom(code, name);
      _mpShowWaiting(code, slot, null, false);
    } catch (e) {
      _toast(e.message, 'error');
    }
  }

  function _mpShowWaiting(roomId, mySlot, playerCount, isHost) {
    $('mp-create-pane').style.display = 'none';
    $('mp-join-pane').style.display   = 'none';
    $('mp-waiting').style.display     = 'block';

    const inviteUrl = Multiplayer.getInviteUrl();
    $('mp-room-info').innerHTML = `
      <div style="font-size:22px;font-weight:bold;letter-spacing:4px;color:#aaddff">${roomId}</div>
      <div style="font-size:11px;color:#666;margin-top:4px;">Share this link:</div>
      <input readonly value="${inviteUrl}" style="width:100%;background:#0a0a1a;border:1px solid #3a3a6a;color:#88aaff;border-radius:4px;padding:4px 8px;font-size:11px;margin-top:4px;"
        onclick="this.select()">
    `;

    // ── Firebase player listener ───────────────────────────
    Multiplayer.onPlayersChanged((players) => {
      // Info line: chars assigned randomly at start
      const picker = $('mp-char-picker');
      if (picker) picker.innerHTML = `<p style="color:#777;font-size:11px;text-align:center;margin:0;">
        🎲 Characters &amp; turn order are randomly assigned when the host starts.</p>`;

      // Render player slots
      const slots = $('mp-player-slots');
      if (!slots) return;
      slots.innerHTML = '';
      Object.entries(players).sort(([a],[b])=>parseInt(a)-parseInt(b)).forEach(([idx, p]) => {
        const me = parseInt(idx) === mySlot;
        slots.innerHTML += `<div style="padding:5px 8px;border-radius:4px;margin:3px 0;
          background:${me?'#1a2a4a':'#111120'};border:1px solid ${me?'#3355aa':'#2a2a4a'};
          font-size:13px;color:#ccc">
          ${me ? '▶ ' : ''}${p.name}
          ${me ? ' <span style="color:#666;font-size:11px">(you)</span>' : ''}
        </div>`;
      });

      // Start button logic (host only — enabled when all slots filled)
      const filled   = Object.keys(players).length;
      const startBtn = $('mp-start-btn');
      const waitMsg  = $('mp-waiting-msg');
      if (isHost && playerCount) {
        if (startBtn) startBtn.style.display = filled >= playerCount ? 'block' : 'none';
        if (waitMsg)  waitMsg.textContent = filled >= playerCount
          ? 'All players joined — start when ready!'
          : `Waiting for players… (${filled}/${playerCount} joined)`;
      } else if (waitMsg) {
        waitMsg.textContent = 'Waiting for the host to start the game…';
      }
    });

    // Non-host: listen for game start
    if (!isHost) {
      Multiplayer.onGameStart(() => {
        hide('char-select');
        show('right-panel');
        _buildHUD();
      });
    }
  }

  function _mpPickChar() { /* no-op — characters are assigned automatically */ }

  async function _mpStartGame() {
    try {
      const snap = await firebase.database().ref(`rooms/${Multiplayer.getRoomId()}/players`).get();
      const players = snap.val() || {};

      // Shuffle player slots → randomises turn order AND who gets which character
      const slots = Object.entries(players).sort(([a],[b]) => parseInt(a) - parseInt(b));
      const shuffledSlots = [...slots].sort(() => Math.random() - 0.5);

      // Assign unique random characters
      const charPool = [...CHARACTERS].sort(() => Math.random() - 0.5);

      // Build gsMapping: Firebase slot → GS player index
      const gsMapping = {};
      const playerSetups = shuffledSlots.map(([slot, p], gsIdx) => {
        gsMapping[parseInt(slot)] = gsIdx;
        return { name: p.name, characterId: charPool[gsIdx].id };
      });

      await Multiplayer.startGame(playerSetups, gsMapping);
    } catch (e) {
      _toast('Failed to start game: ' + e.message, 'error');
      console.error('[_mpStartGame]', e);
      return;
    }
    hide('char-select');
    show('right-panel');
    _buildHUD();
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
    _pbToggle: (id) => { /* set at runtime by _onPhantomBoltPrompt */ },
    // Multiplayer lobby actions (called from inline onclick)
    _mpTab, _mpCreateRoom, _mpJoinRoom, _mpStartGame, _mpPickChar,
    // Instant-join (called from inline onclick in invite-link screen)
    _instantJoin, _buildCharSelectScreen,
  };
})();
