// Unified keyboard + touch input. Calls onAction(type) for each discrete action.
export function initInput(onAction) {
  // Keyboard
  window.addEventListener('keydown', e => {
    switch (e.code) {
      case 'ArrowLeft':  case 'KeyA': onAction('LEFT');  break
      case 'ArrowRight': case 'KeyD': onAction('RIGHT'); break
      case 'ArrowUp':    case 'KeyW': case 'Space': onAction('JUMP'); break
      case 'ArrowDown':  case 'KeyS': onAction('SLIDE'); break
      case 'Enter': onAction('START'); break
    }
  })

  // Touch/swipe
  let touchStartX = 0, touchStartY = 0
  const SWIPE_THRESHOLD = 30

  window.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
    onAction('START')  // tap = start on title screen
  }, { passive: true })

  window.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX
    const dy = e.changedTouches[0].clientY - touchStartY
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return
    if (Math.abs(dx) > Math.abs(dy)) {
      onAction(dx > 0 ? 'RIGHT' : 'LEFT')
    } else {
      onAction(dy > 0 ? 'SLIDE' : 'JUMP')
    }
  }, { passive: true })
}
