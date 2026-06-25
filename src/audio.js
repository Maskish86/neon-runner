let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

function beep(frequency, type, duration, gainVal, startTime) {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = type
  osc.frequency.setValueAtTime(frequency, startTime)
  gain.gain.setValueAtTime(gainVal, startTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

const SOUNDS = {
  collect()  { const t = getCtx().currentTime; beep(880, 'sine', 0.1, 0.3, t); beep(1200, 'sine', 0.08, 0.2, t+0.05) },
  hit()      { const t = getCtx().currentTime; beep(150, 'sawtooth', 0.2, 0.4, t) },
  powerup()  { const t = getCtx().currentTime; [440,550,660,880].forEach((f,i) => beep(f,'sine',0.12,0.2,t+i*0.07)) },
  drone_warn(proximity) {
    if (proximity < 0.5) return
    const t = getCtx().currentTime
    const freq = 200 + proximity * 400
    beep(freq, 'square', 0.05, proximity * 0.15, t)
  },
}

export function initAudio() {
  // Resume AudioContext on first user gesture (browser policy)
  const resume = () => {
    getCtx().resume()
    window.removeEventListener('keydown', resume)
    window.removeEventListener('touchstart', resume)
  }
  window.addEventListener('keydown', resume)
  window.addEventListener('touchstart', resume)

  function play(event, ...args) {
    try { SOUNDS[event]?.(...args) } catch(e) { /* AudioContext not yet ready */ }
  }

  return { play }
}
