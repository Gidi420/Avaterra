// ============================================================
// main.js  –  Phaser 3 config + bootstrap
// ============================================================

window.addEventListener('DOMContentLoaded', () => {

  const config = {
    type: Phaser.AUTO,
    width:  820,
    height: 560,
    backgroundColor: '#1a1a2e',
    parent: 'phaser-container',
    scene: [GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
    },
  };

  new Phaser.Game(config);
  // _gameScene is set by GameScene.create() itself

  // Boot UI (starts at character select screen)
  UI.init();
});
