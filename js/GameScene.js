// ============================================================
// GameScene.js  –  Phaser 3 Scene: board rendering
// ============================================================

class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  // ── Constants ─────────────────────────────────────────────
  get TILE_W()   { return 88; }
  get TILE_H()   { return 88; }
  get TILE_PAD() { return 6; }
  get BOARD_ORIGIN_X() { return 60; }
  get BOARD_ORIGIN_Y() { return 40; }

  // ── Lifecycle ─────────────────────────────────────────────
  create() {
    this.tileObjects  = {}; // tileId → { bg, label, icon, walls }
    this.playerTokens = {}; // playerId → container
    this.highlights   = []; // active highlight graphics
    this.removalMarkers = {}; // tileId → graphics (warning indicator)
    this.boardBuilt   = false;

    // Store reference immediately so UI can access this scene
    window._gameScene = this;

    // Camera pan: drag with right-click or middle-click
    this.input.on('pointermove', pointer => {
      if (pointer.isDown && (pointer.rightButtonDown() || pointer.middleButtonDown())) {
        this.cameras.main.scrollX -= pointer.velocity.x / 2;
        this.cameras.main.scrollY -= pointer.velocity.y / 2;
      }
    });
    // Zoom with scroll wheel
    this.input.on('wheel', (pointer, objs, dx, dy) => {
      const cam = this.cameras.main;
      cam.zoom = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.5, 2.0);
    });

    this._subscribeToEvents();
  }

  _ensureBoardBuilt() {
    if (this.boardBuilt) return;
    const s = GS.getState();
    if (!s) return;
    this.boardBuilt = true;
    this._buildBoard();
    this._buildPlayerTokens();
  }

  // ── Board construction ────────────────────────────────────
  _buildBoard() {
    const s = GS.getState();
    s.tiles.forEach(tile => this._createTileObject(tile));
  }

  _tileXY(tile) {
    const step = this.TILE_W + this.TILE_PAD;
    const x = this.BOARD_ORIGIN_X + tile.col * step + this.TILE_W / 2;
    const y = this.BOARD_ORIGIN_Y + tile.row * step + this.TILE_H / 2;
    return { x, y };
  }

  _createTileObject(tile) {
    const { x, y } = this._tileXY(tile);
    const td = TILE_TYPE_DATA[tile.type] || TILE_TYPE_DATA.plain;
    const container = this.add.container(x, y);

    // Background rectangle
    const bg = this.add.rectangle(0, 0, this.TILE_W, this.TILE_H, td.color)
      .setStrokeStyle(2, 0x555577)
      .setInteractive()
      .on('pointerover', () => this._onTileHover(tile.id, true))
      .on('pointerout',  () => this._onTileHover(tile.id, false))
      .on('pointerup',   () => this._onTileClick(tile.id));

    // Icon text
    const icon = this.add.text(0, -16, td.icon, { fontSize: '22px' }).setOrigin(0.5);
    // Label
    const label = this.add.text(0, 12, td.label, {
      fontSize: '9px', color: td.textColor, fontFamily: 'monospace',
    }).setOrigin(0.5);
    // Tile id (small)
    const idText = this.add.text(this.TILE_W / 2 - 6, -this.TILE_H / 2 + 4, String(tile.id), {
      fontSize: '7px', color: '#888899',
    }).setOrigin(1, 0);

    // Wall indicators (thin lines)
    const wallGfx = this.add.graphics();
    if (tile.hasWalls) this._drawWalls(wallGfx, tile);

    container.add([bg, icon, label, idText, wallGfx]);
    container.setDepth(0);
    this.tileObjects[tile.id] = { container, bg, icon, label, wallGfx };
  }

  _drawWalls(gfx, tile) {
    gfx.clear();
    gfx.lineStyle(4, 0xff4444, 1);
    const w = this.TILE_W / 2, h = this.TILE_H / 2;
    const sides = rotateWalls(tile.wallConfig || 0, tile.wallRotation || 0);
    if (sides & 0b0001) gfx.lineBetween(-w, -h, w, -h); // north
    if (sides & 0b0010) gfx.lineBetween(w, -h, w, h);   // east
    if (sides & 0b0100) gfx.lineBetween(-w, h, w, h);   // south
    if (sides & 0b1000) gfx.lineBetween(-w, -h, -w, h); // west
  }

  // ── Player tokens ─────────────────────────────────────────
  _buildPlayerTokens() {
    const s = GS.getState();
    s.players.forEach(player => this._createPlayerToken(player));
    this._repositionTokens();
  }

  _createPlayerToken(player) {
    const char  = CHARACTERS.find(c => c.id === player.characterId);
    const color = char ? char.hexColor : 0xffffff;

    const container = this.add.container(0, 0).setDepth(10);
    const circle = this.add.arc(0, 0, 16, 0, 360, false, color)
      .setStrokeStyle(2, 0xffffff);
    const charData = CHARACTERS.find(c => c.id === player.characterId);
    const tokenLabel = charData ? charData.name[0].toUpperCase() : player.name[0].toUpperCase();
    const initial = this.add.text(0, 0, tokenLabel, {
      fontSize: '13px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    // HP bar (small, below circle)
    const hpBg  = this.add.rectangle(0, 22, 32, 5, 0x333333);
    const hpBar = this.add.rectangle(-16, 22, 32, 5, 0x2ecc71).setOrigin(0, 0.5);
    hpBar.name = 'hpBar';

    container.add([circle, initial, hpBg, hpBar]);
    this.playerTokens[player.id] = { container, circle, hpBar };
  }

  _repositionTokens() {
    const s = GS.getState();
    // Group players by tile, offset them slightly so they don't overlap
    const byTile = {};
    s.players.filter(p => p.alive).forEach(p => {
      if (!byTile[p.tileId]) byTile[p.tileId] = [];
      byTile[p.tileId].push(p.id);
    });

    s.players.forEach(player => {
      const t = this.playerTokens[player.id];
      if (!t) return;
      if (!player.alive) { t.container.setVisible(false); return; }
      t.container.setVisible(true);

      const tile = GS.getTile(player.tileId);
      if (!tile) return;
      const { x, y } = this._tileXY(tile);
      const group = byTile[player.tileId] || [];
      const idx   = group.indexOf(player.id);
      const offsets = [
        { dx: 0,   dy: 0  },
        { dx: 16,  dy: -8 },
        { dx: -16, dy: 8  },
        { dx: 8,   dy: 16 },
        { dx: -8,  dy:-16 },
        { dx: 0,   dy: 16 },
      ];
      const off = offsets[Math.min(idx, offsets.length - 1)] || { dx: 0, dy: 0 };
      t.container.setPosition(x + off.dx, y + off.dy);

      // Update HP bar
      const playerData = s.players.find(p => p.id === player.id);
      const ratio = Math.max(0, playerData.hp / playerData.maxHp);
      t.hpBar.setScale(ratio, 1);
      t.hpBar.setFillStyle(ratio > 0.5 ? 0x2ecc71 : ratio > 0.25 ? 0xe67e22 : 0xe74c3c);
    });
  }

  // ── Highlights ────────────────────────────────────────────
  clearHighlights() {
    this.highlights.forEach(h => h.destroy());
    this.highlights = [];
    Object.values(this.tileObjects).forEach(obj => {
      if (obj.bg) obj.bg.setStrokeStyle(2, 0x555577);
    });
  }

  highlightTiles(tileIds, hexColor) {
    this.clearHighlights();
    tileIds.forEach(id => {
      const obj = this.tileObjects[id];
      if (!obj) return;
      obj.bg.setStrokeStyle(3, hexColor);
      // Glow pulse tween
      const tween = this.tweens.add({
        targets: obj.bg,
        alpha: { from: 0.7, to: 1.0 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
      this.highlights.push({ destroy: () => { tween.stop(); obj.bg.setAlpha(1); } });
    });
  }

  highlightPlayers(playerIds, hexColor) {
    playerIds.forEach(id => {
      const tok = this.playerTokens[id];
      if (!tok) return;
      tok.circle.setStrokeStyle(3, hexColor);
      const tween = this.tweens.add({
        targets: tok.circle,
        scaleX: { from: 1, to: 1.2 },
        scaleY: { from: 1, to: 1.2 },
        duration: 400,
        yoyo: true,
        repeat: -1,
      });
      this.highlights.push({ destroy: () => { tween.stop(); tok.circle.setStrokeStyle(2, 0xffffff).setScale(1); } });
    });
  }

  // ── Animation: player moves ───────────────────────────────
  animatePlayerMove(playerId, toTileId) {
    const tok  = this.playerTokens[playerId];
    const tile = GS.getTile(toTileId);
    if (!tok || !tile) return;
    const { x, y } = this._tileXY(tile);
    this.tweens.add({
      targets: tok.container,
      x, y,
      duration: 250,
      ease: 'Power2',
      onComplete: () => this._repositionTokens(),
    });
  }

  // ── Animation: tile removed ───────────────────────────────
  animateTileRemoved(tileId) {
    const obj = this.tileObjects[tileId];
    if (!obj) return;
    this.tweens.add({
      targets: obj.container,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        obj.container.setVisible(false);
        obj.container.setAlpha(1);
        // Draw an "X" or grey out
        const tile = GS.getTile(tileId);
        const { x, y } = this._tileXY(tile);
        const gfx = this.add.graphics().setDepth(1);
        gfx.lineStyle(2, 0x222233, 1);
        gfx.strokeRect(x - this.TILE_W / 2, y - this.TILE_H / 2, this.TILE_W, this.TILE_H);
        gfx.lineStyle(1, 0x333344, 0.5);
        gfx.lineBetween(x - this.TILE_W / 2, y - this.TILE_H / 2, x + this.TILE_W / 2, y + this.TILE_H / 2);
        gfx.lineBetween(x + this.TILE_W / 2, y - this.TILE_H / 2, x - this.TILE_W / 2, y + this.TILE_H / 2);
      }
    });
  }

  // ── Update tiles (type or wall rotation changed) ──────────
  refreshTile(tileId) {
    const obj  = this.tileObjects[tileId];
    const tile = GS.getTile(tileId);
    if (!obj || !tile) return;
    if (tile.hasWalls) this._drawWalls(obj.wallGfx, tile);
  }

  // ── Tile click router ─────────────────────────────────────
  _onTileClick(tileId) {
    const s = GS.getState();
    if (!s || s.phase !== 'game') return;
    UI.onTileClicked(tileId);
  }

  _onTileHover(tileId, entering) {
    const obj  = this.tileObjects[tileId];
    const tile = GS.getTile(tileId);
    if (!obj || !tile) return;
    if (entering) {
      UI.showTileTooltip(tile);
    } else {
      UI.hideTileTooltip();
    }
  }

  // ── Full refresh (called after state changes) ─────────────
  fullRefresh() {
    this._repositionTokens();
  }

  // ── GS event subscriptions ────────────────────────────────
  _subscribeToEvents() {
    GS.on('player_moved', ({ playerId, fromTile, toTile }) => {
      this._ensureBoardBuilt();
      this.animatePlayerMove(playerId, toTile);
    });

    GS.on('tile_removed', ({ tileId }) => {
      this._ensureBoardBuilt();
      this.animateTileRemoved(tileId);
    });

    GS.on('tile_restored', ({ tileId }) => {
      const obj = this.tileObjects[tileId];
      if (obj) { obj.container.setVisible(true); obj.container.setAlpha(1); }
    });

    GS.on('state_changed', () => {
      this._ensureBoardBuilt();
      this._repositionTokens();
      const s = GS.getState();
      if (s) {
        this._updateRemovalMarkers(s.scheduledRemoval || []);
        this._updateCityMarkers(s);
      }
    });

    GS.on('player_eliminated', ({ playerId }) => {
      const tok = this.playerTokens[playerId];
      if (tok) {
        this.tweens.add({
          targets: tok.container,
          alpha: 0,
          duration: 500,
          onComplete: () => tok.container.setVisible(false),
        });
      }
    });

    GS.on('phase_changed', ({ subphase, validTiles, targets }) => {
      this.clearHighlights();
      if (subphase === 'move' || subphase === 'ability') {
        if (validTiles && validTiles.length > 0) {
          this.highlightTiles(validTiles, 0x00aaff);
        }
      }
      if (subphase === 'target_select' && targets) {
        this.highlightPlayers(targets, 0xff4444);
      }
    });

    GS.on('round_changed', ({ scheduledRemoval }) => {
      this._updateRemovalMarkers(scheduledRemoval || []);
    });

    GS.on('tile_wall_rotated', ({ tileId }) => {
      this.refreshTile(tileId);
    });
  }

  // ── Scheduled-removal danger markers ─────────────────────
  _updateRemovalMarkers(scheduledIds) {
    // Clear old markers
    Object.values(this.removalMarkers).forEach(m => m.destroy());
    this.removalMarkers = {};

    scheduledIds.forEach(tileId => {
      const obj = this.tileObjects[tileId];
      if (!obj) return;
      const tile = GS.getTile(tileId);
      if (!tile || tile.removed) return;
      const { x, y } = this._tileXY(tile);
      const gfx = this.add.graphics().setDepth(5);
      // Pulsing orange border
      gfx.lineStyle(4, 0xff6600, 0.9);
      gfx.strokeRect(x - this.TILE_W / 2 + 2, y - this.TILE_H / 2 + 2, this.TILE_W - 4, this.TILE_H - 4);
      // Warning text
      const txt = this.add.text(x, y + this.TILE_H / 2 - 10, '⚠', {
        fontSize: '13px', color: '#ff6600',
      }).setOrigin(0.5).setDepth(6);
      // Pulse tween
      this.tweens.add({
        targets: [gfx, txt],
        alpha: { from: 1, to: 0.3 },
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
      this.removalMarkers[tileId] = { destroy: () => { gfx.destroy(); txt.destroy(); } };
    });
  }

  _updateCityMarkers(state) {
    if (this.cityMarkers) this.cityMarkers.forEach(m => m.destroy());
    this.cityMarkers = [];
    if (!state.freeItemRound) return;
    state.tiles.filter(t => t.type === 'city' && !t.removed).forEach(tile => {
      const { x, y } = this._tileXY(tile);
      const gfx = this.add.graphics().setDepth(7);
      gfx.lineStyle(3, 0xffd700, 1);
      gfx.strokeCircle(x, y, 42);
      const txt = this.add.text(x, y - 34, '🎁', { fontSize: '16px' }).setOrigin(0.5).setDepth(7);
      this.tweens.add({
        targets: [gfx, txt],
        alpha: { from: 1, to: 0.3 },
        duration: 900, yoyo: true, repeat: -1,
      });
      this.cityMarkers.push({ destroy: () => { gfx.destroy(); txt.destroy(); } });
    });
  }
}
