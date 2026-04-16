// ============================================================
// Multiplayer.js  –  Firebase Realtime Database room system
// ============================================================

const Multiplayer = (() => {

  let _db             = null;
  let _roomId         = null;
  let _myIndex        = null;   // which player slot I own (0-based)
  let _isHost         = false;
  let _applyingRemote = false;  // prevents push loops when applying incoming state
  let _onPlayersChangedCb = null;
  let _onGameStartCb      = null;

  // ── Config check ─────────────────────────────────────────
  function isConfigured() {
    return (
      typeof FIREBASE_CONFIG !== 'undefined' &&
      FIREBASE_CONFIG.databaseURL &&
      !FIREBASE_CONFIG.databaseURL.includes('PASTE')
    );
  }

  // ── Firebase init ─────────────────────────────────────────
  function _init() {
    if (_db) return true;
    if (!isConfigured()) return false;
    try {
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      _db = firebase.database();
      return true;
    } catch (e) {
      console.error('[Multiplayer] Firebase init failed:', e);
      return false;
    }
  }

  // ── Accessors ─────────────────────────────────────────────
  function isActive()         { return _roomId !== null; }
  function getMyIndex()       { return _myIndex; }
  function isApplyingRemote() { return _applyingRemote; }

  function isMyTurn() {
    if (!isActive()) return true;
    const s = GS.getState();
    return s && s.currentPlayerIndex === _myIndex;
  }

  function isMyPlayer(playerIndex) {
    if (!isActive()) return true;   // hotseat: always "mine"
    return playerIndex === _myIndex;
  }

  // ── Room code ─────────────────────────────────────────────
  function _genCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  // ── Create room ───────────────────────────────────────────
  async function createRoom(playerCount, myName, myCharId) {
    if (!_init()) throw new Error('Firebase not configured — fill in firebase-config.js');
    _roomId  = _genCode();
    _myIndex = 0;
    _isHost  = true;

    await _db.ref(`rooms/${_roomId}`).set({
      created:     Date.now(),
      hostIndex:   0,
      playerCount,
      status:      'waiting',
      players:     { 0: { name: myName, characterId: myCharId } },
    });

    _listenPlayers();
    return _roomId;
  }

  // ── Join room ─────────────────────────────────────────────
  async function joinRoom(roomId, myName, myCharId) {
    if (!_init()) throw new Error('Firebase not configured — fill in firebase-config.js');

    const snap = await _db.ref(`rooms/${roomId}`).get();
    if (!snap.exists()) throw new Error('Room not found. Check the code and try again.');

    const room = snap.val();
    if (room.status !== 'waiting') throw new Error('This game has already started.');

    const taken = Object.keys(room.players || {}).map(Number);
    let slot = 0;
    while (taken.includes(slot)) slot++;
    if (slot >= room.playerCount) throw new Error('Room is full.');

    _roomId  = roomId.toUpperCase();
    _myIndex = slot;
    _isHost  = false;

    await _db.ref(`rooms/${_roomId}/players/${slot}`).set({ name: myName, characterId: myCharId });
    _listenPlayers();
    return slot;
  }

  // ── Listen for player list changes ───────────────────────
  function _listenPlayers() {
    _db.ref(`rooms/${_roomId}/players`).on('value', snap => {
      if (_onPlayersChangedCb) _onPlayersChangedCb(snap.val() || {});
    });
  }

  function onPlayersChanged(cb) { _onPlayersChangedCb = cb; }

  // ── Host starts the game ─────────────────────────────────
  async function startGame(playerSetups) {
    if (!_isHost) return;
    GS.init(playerSetups);
    const rawState = GS.getState();
    await _db.ref(`rooms/${_roomId}`).update({
      status: 'playing',
      state:  _serialize(rawState),
    });
    _listenState();
  }

  // ── Joiner listens for game start ─────────────────────────
  function onGameStart(cb) {
    _onGameStartCb = cb;
    if (!_db || !_roomId) return;
    _db.ref(`rooms/${_roomId}/status`).on('value', snap => {
      if (snap.val() === 'playing') {
        _listenState();
        if (_onGameStartCb) _onGameStartCb();
      }
    });
  }

  // ── Listen for remote state changes ──────────────────────
  function _listenState() {
    _db.ref(`rooms/${_roomId}/state`).on('value', snap => {
      if (!snap.exists()) return;
      const raw = snap.val();
      if (!raw) return;
      _applyingRemote = true;
      GS.setState(_deserialize(raw));
      _applyingRemote = false;
    });
  }

  // ── Push local state to Firebase ─────────────────────────
  function pushState(state) {
    if (!isActive() || _applyingRemote || !_db) return;
    _db.ref(`rooms/${_roomId}/state`).set(_serialize(state));
  }

  // ── Serialize / deserialize ───────────────────────────────
  // Firebase stores arrays as objects with numeric keys when there are gaps.
  // We must convert them back.

  function _ensureArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'object') return Object.values(val);
    return [];
  }

  function _serialize(state) {
    // Strip undefined values which Firebase rejects
    return JSON.parse(JSON.stringify(state));
  }

  function _deserialize(raw) {
    if (!raw) return raw;
    const s = { ...raw };
    s.players         = _ensureArray(raw.players).map(p => p ? ({
      ...p,
      combatCards:  _ensureArray(p.combatCards),
      items:        _ensureArray(p.items),
      upgrades:     _ensureArray(p.upgrades),
    }) : p);
    s.tiles           = _ensureArray(raw.tiles);
    s.terrainBag      = _ensureArray(raw.terrainBag);
    s.scheduledRemoval= _ensureArray(raw.scheduledRemoval);
    s.log             = _ensureArray(raw.log);
    s.fortressDrawn   = raw.fortressDrawn || {};
    if (raw.decks) {
      s.decks = { ...raw.decks };
      ['bronze','silver','gold','bronzeDiscard','silverDiscard','goldDiscard','combat','combatDiscard'].forEach(k => {
        s.decks[k] = _ensureArray(raw.decks[k]);
      });
    }
    return s;
  }

  // ── Get shareable invite URL ──────────────────────────────
  function getInviteUrl() {
    if (!_roomId) return null;
    const base = location.href.split('?')[0];
    return `${base}?room=${_roomId}`;
  }

  function getRoomId() { return _roomId; }

  return {
    isConfigured,
    isActive,
    isMyTurn,
    isMyPlayer,
    isApplyingRemote,
    getMyIndex,
    getRoomId,
    getInviteUrl,
    createRoom,
    joinRoom,
    onPlayersChanged,
    onGameStart,
    startGame,
    pushState,
  };
})();
