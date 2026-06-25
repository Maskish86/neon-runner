const hudEl  = document.getElementById('hud')
const overlayEl = document.getElementById('overlay')

export function initHud() {
  hudEl.innerHTML = `
    <div id="hud-score">SCORE: 0</div>
    <div id="hud-dist">0m</div>
    <div id="hud-hi">BEST: 0</div>
    <div id="hud-hp">♥♥♥</div>
    <div id="hud-powerup"></div>
    <div id="hud-drone-warn">⚠ DRONE CLOSING IN ⚠</div>
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
    const dur = { SHIELD:Infinity, MAGNET:8, OVERDRIVE:5, HOVER:6 }[type]
    const pct = type === 'SHIELD' ? 100 : Math.max(0, (timeLeft / dur) * 100)
    const col = POWERUP_LABEL_COLORS[type]
    puEl.innerHTML = `
      <span style="color:${col};text-shadow:0 0 8px ${col}">${POWERUP_LABELS[type]}</span>
      <div class="powerup-bar" style="width:${pct}%;background:${col};box-shadow:0 0 6px ${col}"></div>
    `
  } else {
    puEl.innerHTML = ''
  }

  const warn = document.getElementById('hud-drone-warn')
  if (warn) warn.style.display = gameState.droneProximity > 0.6 ? 'block' : 'none'
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
    const hi = Math.max(parseInt(localStorage.getItem('neon-runner-highscore') || '0'), gameState.score)
    localStorage.setItem('neon-runner-highscore', String(hi))
    overlayEl.innerHTML = `
      <div class="screen">
        <h2>CAPTURED</h2>
        <p class="stat">DISTANCE &nbsp; ${Math.floor(gameState.distance)}m</p>
        <p class="stat">SCORE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${gameState.score}</p>
        <p class="hi-stat">BEST &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${hi}</p>
        <button class="restart-btn" id="restart-btn">[ RESTART ]</button>
      </div>`
    document.getElementById('restart-btn').addEventListener('click', () =>
      window.dispatchEvent(new CustomEvent('game-restart')))
  }
}
