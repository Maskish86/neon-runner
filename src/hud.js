const hudEl = document.getElementById('hud')

export function initHud() {
  hudEl.innerHTML = `
    <div id="hud-score" style="position:absolute;top:16px;left:16px">SCORE: 0</div>
    <div id="hud-dist"  style="position:absolute;top:40px;left:16px">DIST: 0m</div>
    <div id="hud-hp"    style="position:absolute;bottom:16px;left:16px">HP: ♥♥♥</div>
    <div id="hud-hi"    style="position:absolute;top:16px;right:16px">HI: 0</div>
  `
}

export function updateHud(gameState) {
  const hi = parseInt(localStorage.getItem('neon-runner-highscore') || '0')
  document.getElementById('hud-score').textContent = `SCORE: ${gameState.score}`
  document.getElementById('hud-dist').textContent  = `DIST: ${Math.floor(gameState.distance)}m`
  document.getElementById('hud-hp').textContent    = `HP: ${'♥'.repeat(gameState.hp)}${'♡'.repeat(3 - gameState.hp)}`
  document.getElementById('hud-hi').textContent    = `HI: ${Math.max(hi, gameState.score)}`
}

export function showScreen(type, gameState) {
  const overlay = document.getElementById('overlay')
  if (type === 'TITLE') {
    overlay.innerHTML = `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#00000099">
        <h1 style="font-size:64px;color:#00ffff;text-shadow:0 0 20px #00ffff;font-family:monospace">NEON RUNNER</h1>
        <p style="color:#ff00ff;margin-top:24px;font-size:20px;font-family:monospace">PRESS SPACE / TAP TO START</p>
        <p style="color:#888;margin-top:12px;font-size:14px;font-family:monospace">← → lane | ↑ jump | ↓ slide</p>
      </div>`
    overlay.style.pointerEvents = 'auto'
  } else if (type === 'GAME_OVER') {
    const hi = Math.max(parseInt(localStorage.getItem('neon-runner-highscore') || '0'), gameState.score)
    localStorage.setItem('neon-runner-highscore', hi)
    overlay.innerHTML = `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#00000099">
        <h2 style="font-size:48px;color:#ff0044;text-shadow:0 0 15px #ff0044;font-family:monospace">CAPTURED</h2>
        <p style="color:#00ffff;margin-top:16px;font-family:monospace">DIST: ${Math.floor(gameState.distance)}m</p>
        <p style="color:#00ffff;font-family:monospace">SCORE: ${gameState.score}</p>
        <p style="color:#ffcc00;font-family:monospace">BEST: ${hi}</p>
        <button id="restart-btn" style="margin-top:24px;padding:12px 32px;background:#00ffff;color:#000;border:none;font-size:18px;font-family:monospace;cursor:pointer">RESTART</button>
      </div>`
    overlay.style.pointerEvents = 'auto'
    document.getElementById('restart-btn').addEventListener('click', () => window.dispatchEvent(new CustomEvent('game-restart')))
  } else {
    overlay.innerHTML = ''
    overlay.style.pointerEvents = 'none'
  }
}
