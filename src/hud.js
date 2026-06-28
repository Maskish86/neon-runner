const hudEl  = document.getElementById('hud')
const overlayEl = document.getElementById('overlay')

let lastCombo = 1

export function initHud() {
  hudEl.innerHTML = `
    <div id="hud-score">SCORE: 0</div>
    <div id="hud-dist">0m</div>
    <div id="hud-hi">BEST: 0</div>
    <div id="hud-hp">♥♥♥</div>
    <div id="hud-powerup"></div>
    <div id="hud-combo" style="display:none">
      <span id="hud-combo-text">×2 COMBO</span>
      <div id="hud-combo-bar-wrap"><div id="hud-combo-bar"></div></div>
    </div>
  `
}

const POWERUP_LABELS = { SHIELD:'🛡 SHIELD', MAGNET:'⚡ MAGNET', OVERDRIVE:'🔥 OVERDRIVE', HOVER:'🚀 HOVER' }
const POWERUP_LABEL_COLORS = { SHIELD:'#0088ff', MAGNET:'#ffdd00', OVERDRIVE:'#ffffff', HOVER:'#00ff88' }

export function updateHud(gameState) {
  const hi = Math.max(parseInt(localStorage.getItem('neon-runner-highscore') || '0'), gameState.score)
  document.getElementById('hud-score').textContent = `SCORE: ${gameState.score}`
  document.getElementById('hud-dist').textContent  = `${Math.floor(gameState.distance)}m`
  document.getElementById('hud-hi').textContent    = `BEST: ${hi}`
  document.getElementById('hud-hp').textContent    = '♥'.repeat(gameState.hp) + '♡'.repeat(3 - gameState.hp)

  const puEl = document.getElementById('hud-powerup')
  if (gameState.powerUp) {
    const { type, timeLeft } = gameState.powerUp
    const dur = { SHIELD:Infinity, MAGNET:8, OVERDRIVE:10, HOVER:6 }[type]
    const pct = type === 'SHIELD' ? 100 : Math.max(0, (timeLeft / dur) * 100)
    const col = POWERUP_LABEL_COLORS[type]
    puEl.innerHTML = `
      <span style="color:${col};text-shadow:0 0 8px ${col}">${POWERUP_LABELS[type]}</span>
      <div class="powerup-bar" style="width:${pct}%;background:${col};box-shadow:0 0 6px ${col}"></div>
    `
  } else {
    puEl.innerHTML = ''
  }

  const comboEl = document.getElementById('hud-combo')
  const comboTextEl = document.getElementById('hud-combo-text')
  const comboBarEl = document.getElementById('hud-combo-bar')
  if (comboEl && gameState.combo !== undefined) {
    if (gameState.combo >= 2) {
      comboEl.style.display = 'block'
      comboTextEl.textContent = `${gameState.combo} CHAIN`
      const pct = Math.max(0, (1 - gameState.comboTimer / 1.5) * 100)
      comboBarEl.style.width = `${pct}%`
      if (gameState.combo !== lastCombo) {
        comboTextEl.classList.remove('combo-pop')
        void comboTextEl.offsetWidth
        comboTextEl.classList.add('combo-pop')
        lastCombo = gameState.combo
      }
    } else {
      comboEl.style.display = 'none'
      lastCombo = 0
    }
  }
}

export function showScreen(type, gameState, onSkinSelect) {
  if (type === 'PLAYING') {
    overlayEl.innerHTML = ''
    overlayEl.style.pointerEvents = 'none'
    return
  }
  if (type === 'TITLE') {
    overlayEl.style.pointerEvents = 'auto'
    overlayEl.innerHTML = `
      <div class="screen">
        <h1>NEON RUNNER</h1>
        <p style="color:#aa88ff;margin-top:6px;letter-spacing:3px">CYBERPUNK ENDLESS RUNNER</p>
        <p class="hi-stat" style="margin-top:4px">BEST: ${parseInt(localStorage.getItem('neon-runner-highscore') || '0')}</p>
        <div class="skin-row">
          <button class="skin-btn cyan selected"    data-skin="CYAN"    title="Cyan"></button>
          <button class="skin-btn magenta"          data-skin="MAGENTA" title="Magenta"></button>
          <button class="skin-btn gold"             data-skin="GOLD"    title="Gold"></button>
        </div>
        <p class="cta">PRESS SPACE / TAP TO START</p>
        <div class="controls">
          ← → / A D &nbsp; lane switch<br>
          ↑ W Space &nbsp; jump<br>
          ↓ S &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; slide
        </div>
      </div>`
    overlayEl.querySelectorAll('.skin-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        overlayEl.querySelectorAll('.skin-btn').forEach(b => b.classList.remove('selected'))
        btn.classList.add('selected')
        onSkinSelect(btn.dataset.skin)
      })
    })
    return
  }
  if (type === 'GAME_OVER') {
    overlayEl.style.pointerEvents = 'auto'
    const prevHi = parseInt(localStorage.getItem('neon-runner-highscore') || '0')
    const hi = Math.max(prevHi, gameState.score)
    localStorage.setItem('neon-runner-highscore', String(hi))
    const isNewBest = gameState.score > prevHi && gameState.score > 0
    overlayEl.innerHTML = `
      <div class="screen">
        <h2>CAPTURED</h2>
        <p class="stat">DISTANCE &nbsp; ${Math.floor(gameState.distance)}m</p>
        <p class="stat">SCORE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${gameState.score}</p>
        <p class="hi-stat" style="${isNewBest ? 'color:#ffcc00;text-shadow:0 0 12px #ffcc00' : ''}">
          ${isNewBest ? 'NEW BEST!' : 'BEST'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${hi}
        </p>
        <button class="restart-btn" id="restart-btn">[ RESTART ]</button>
      </div>`
    document.getElementById('restart-btn').addEventListener('click', () =>
      window.dispatchEvent(new CustomEvent('game-restart')))
  }
}
