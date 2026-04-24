// ============================================================
// Multiplayer.js  –  Firebase Realtime Database room system
// ============================================================

var Multiplayer = (() => {

  let _db             = null;
  let _roomId         = null;
  let _myIndex        = null;   // Firebase slot index (0 = first to join)
  let _myGsIndex      = null;   // GS players-array index (after turn-order shuffle)
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
  // Returns GS player array index (accounts for turn-order shuffle)
  function getMyIndex()       { return _myGsIndex !== null ? _myGsIndex : _myIndex; }
  function isApplyingRemote() { return _applyingRemote; }

  function isMyTurn() {
    if (!isActive()) return true;
    const s = GS.getState();
    return s && s.currentPlayerIndex === getMyIndex();
  }

  function isMyPlayer(playerIndex) {
    if (!isActive()) return true;
    return playerIndex === getMyIndex();
  }

  // ── Room code ─────────────────────────────────────────────
  function _genCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  // ── Session persistence (survives page refresh) ───────────
  function _saveSession() {
    if (!_roomId) return;
    try {
      sessionStorage.setItem('mp_session', JSON.stringify({
        roomId: _roomId, myIndex: _myIndex, isHost: _isHost,
        myGsIndex: _myGsIndex,
      }));
    } catch(e) {}
  }

  function _clearSession() {
    try { sessionStorage.removeItem('mp_session'); } catch(e) {}
  }

  function getSavedSession() {
    try { return JSON.parse(sessionStorage.getItem('mp_session')); } catch { return null; }
  }

  async function rejoinRoom() {
    const session = getSavedSession();
    if (!session || !session.roomId) return false;
    if (!_init()) return false;
    try {
      const snap = await _db.ref(`rooms/${session.roomId}`).get();
      if (!snap.exists()) { _clearSession(); return false; }
      const room = snap.val();
      if (room.status !== 'playing') { _clearSession(); return false; }

      _roomId  = session.roomId;
      _myIndex = session.myIndex;
      _isHost  = session.isHost;

      // Restore GS index from Firebase mapping or saved session
      if (room.gsMapping && room.gsMapping[_myIndex] !== undefined) {
        _myGsIndex = room.gsMapping[_myIndex];
      } else {
        _myGsIndex = session.myGsIndex !== null ? session.myGsIndex : _myIndex;
      }

      _listenState();
      return true;
    } catch(e) {
      console.warn('[Multiplayer] rejoinRoom failed:', e);
      _clearSession();
      return false;
    }
  }

  // ── Create room ───────────────────────────────────────────
  async function createRoom(playerCount, myName) {
    if (!_init()) throw new Error('Firebase not configured — fill in firebase-config.js');
    _roomId    = _genCode();
    _myIndex   = 0;
    _myGsIndex = null;   // assigned when host starts game
    _isHost    = true;

    await _db.ref(`rooms/${_roomId}`).set({
      created:     Date.now(),
      hostIndex:   0,
      playerCount,
      status:      'waiting',
      players:     { 0: { name: myName } },
    });

    _listenPlayers();
    _saveSession();
    return _roomId;
  }

  // ── Join room ─────────────────────────────────────────────
  async function joinRoom(roomId, myName) {
    if (!_init()) throw new Error('Firebase not configured — fill in firebase-config.js');

    const snap = await _db.ref(`rooms/${roomId}`).get();
    if (!snap.exists()) throw new Error('Room not found. Check the code and try again.');

    const room = snap.val();
    if (room.status !== 'waiting') throw new Error('This game has already started.');

    const taken = Object.keys(room.players || {}).map(Number);
    let slot = 0;
    while (taken.includes(slot)) slot++;
    if (slot >= room.playerCount) throw new Error('Room is full.');

    _roomId    = roomId.toUpperCase();
    _myIndex   = slot;
    _myGsIndex = null;  // assigned when host starts game
    _isHost    = false;

    await _db.ref(`rooms/${_roomId}/players/${slot}`).set({ name: myName });
    _listenPlayers();
    _saveSession();
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
  // gsMapping: { firebaseSlot: gsPlayerIndex, ... }
  async function startGame(playerSetups, gsMapping) {
    if (!_isHost) return;

    // Record my own GS index
    _myGsIndex = gsMapping ? (gsMapping[_myIndex] !== undefined ? gsMapping[_myIndex] : _myIndex) : _myIndex;

    GS.init(playerSetups);
    const rawState = GS.getState();
    await _db.ref(`rooms/${_roomId}`).update({
      status:    'playing',
      state:     _serialize(rawState),
      gsMapping: gsMapping || null,
    });
    _saveSession();
    _listenState();
  }

  // ── Joiner listens for game start ─────────────────────────
  function onGameStart(cb) {
    _onGameStartCb = cb;
    if (!_db || !_roomId) return;
    _db.ref(`rooms/${_roomId}/status`).on('value', snap => {
      if (snap.val() === 'playing') {
        // Fetch gsMapping so we know our GS player index
        _db.ref(`rooms/${_roomId}/gsMapping`).get().then(mapSnap => {
          const gsMapping = mapSnap.val();
          if (gsMapping && gsMapping[_myIndex] !== undefined) {
            _myGsIndex = gsMapping[_myIndex];
          } else {
            _myGsIndex = _myIndex;
          }
          _saveSession();
          _listenState();
          if (_onGameStartCb) _onGameStartCb();
        }).catch(() => {
          _myGsIndex = _myIndex;
          _listenState();
          if (_onGameStartCb) _onGameStartCb();
        });
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
  function _ensureArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'object') return Object.values(val);
    return [];
  }

  function _serialize(state) {
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
    getSavedSession,
    rejoinRoom,
    clearSession: _clearSession,
    createRoom,
    joinRoom,
    onPlayersChanged,
    onGameStart,
    startGame,
    pushState,
  };
})();
