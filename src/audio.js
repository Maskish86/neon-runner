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
  jump() {
    const t = getCtx().currentTime
    const c = getCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain); gain.connect(c.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, t)
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.15)
    gain.gain.setValueAtTime(0.25, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    osc.start(t); osc.stop(t + 0.2)
  },
  collect()  { const t = getCtx().currentTime; beep(880, 'sine', 0.1, 0.3, t); beep(1200, 'sine', 0.08, 0.2, t+0.05) },
  collect_combo(combo) {
    const t = getCtx().currentTime
    const base = 880 + Math.min(combo, 150) * 12
    beep(base, 'sine', 0.07, 0.25, t)
    beep(base * 1.2, 'sine', 0.05, 0.15, t + 0.04)
  },
  collect_milestone(bonus, combo) {
    const t = getCtx().currentTime
    // pitch multiplier rises with combo depth (caps at 3x for sanity)
    const tier = Math.min(Math.floor((combo - 1) / 20), 7)
    const shift = 1 + tier * 0.15
    if (bonus === 50)
      [880, 1100, 1320].map(f => f * shift).forEach((f,i) => beep(f,'sine',0.1,0.25,t+i*0.06))
    else if (bonus === 100)
      [660, 880, 1100, 1320].map(f => f * shift).forEach((f,i) => beep(f,'sine',0.12,0.3,t+i*0.06))
    else if (bonus === 250)
      [550,660,880,1100,1320,1760].map(f => f * shift).forEach((f,i) => beep(f,'sine',0.15,0.35,t+i*0.05))
  },
  hit()      { const t = getCtx().currentTime; beep(150, 'sawtooth', 0.2, 0.4, t) },
  powerup()  { const t = getCtx().currentTime; [440,550,660,880].forEach((f,i) => beep(f,'sine',0.12,0.2,t+i*0.07)) },
  beam_warn(type) {
    const t = getCtx().currentTime
    const freq = type === 'LOW' ? 440 : 660
    beep(freq, 'square', 0.08, 0.2, t)
    beep(freq * 1.5, 'square', 0.05, 0.15, t + 0.12)
  },
  beam_hit() {
    const t = getCtx().currentTime
    beep(300, 'square', 0.12, 0.35, t)
    beep(150, 'sawtooth', 0.15, 0.25, t + 0.04)
  },
}

// --- Background music scheduler ---
// 16-beat loop (8s at 120 BPM): Am → F → C → Em chord progression
const BEAT = 0.5
const LOOK_AHEAD = 0.25

// Each chord: 4 beats. bass=root Hz, pad=triad Hz, mel=4 melody notes
const CHORDS = [
  { bass: 110, pad: [220, 262, 330], mel: [330, 220, 392, 262] },  // Am: A C E
  { bass:  87, pad: [175, 220, 262], mel: [262, 175, 330, 220] },  // F:  F A C
  { bass: 131, pad: [262, 330, 392], mel: [392, 262, 330, 392] },  // C:  C E G
  { bass:  82, pad: [165, 247, 330], mel: [247, 165, 330, 247] },  // Em: E B E
]

// Melody rhythm: which of the 4 beats in a chord get a note (varies per chord)
const MEL_RHYTHM = [
  [1, 1, 1, 1],  // Am  — busy
  [1, 0, 1, 1],  // F   — skip beat 1 for space
  [1, 1, 0, 1],  // C   — skip beat 2
  [1, 1, 1, 0],  // Em  — resolve, let last beat breathe
]

let musicIntervalId = null
let nextBeatTime = 0
let beatCount = 0

function kick(t) {
  const c = getCtx()
  const osc = c.createOscillator(); const gain = c.createGain()
  osc.connect(gain); gain.connect(c.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, t)
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.06)
  gain.gain.setValueAtTime(0.25, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  osc.start(t); osc.stop(t + 0.12)
}

function hihat(t, accent) {
  const c = getCtx()
  const osc = c.createOscillator(); const gain = c.createGain()
  osc.connect(gain); gain.connect(c.destination)
  osc.type = 'square'
  osc.frequency.setValueAtTime(6000, t)
  gain.gain.setValueAtTime(accent ? 0.03 : 0.012, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
  osc.start(t); osc.stop(t + 0.04)
}

function bass(freq, t, dur) {
  const c = getCtx()
  const osc = c.createOscillator(); const gain = c.createGain()
  osc.connect(gain); gain.connect(c.destination)
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, t)
  gain.gain.setValueAtTime(0.12, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.start(t); osc.stop(t + dur)
}

function pad(freqs, t, dur) {
  freqs.forEach(f => {
    beep(f,         'sawtooth', dur, 0.012, t)
    beep(f * 1.006, 'sawtooth', dur, 0.01,  t)
  })
}

function scheduleMusicBeats() {
  try {
    const c = getCtx()
    const now = c.currentTime
    while (nextBeatTime < now + LOOK_AHEAD) {
      const b      = beatCount % 16
      const ci     = Math.floor(b / 4)   // chord index 0-3
      const bLocal = b % 4               // beat within chord 0-3
      const chord  = CHORDS[ci]
      const t      = nextBeatTime

      // Kick: beat 0 of each chord + snare-like on beat 2
      if (bLocal === 0) kick(t)
      if (bLocal === 2) kick(t)   // softer feel — same fn, listeners hear context

      // Hi-hat every beat, accented on downbeats
      hihat(t, bLocal === 0)

      // Bass: sustain for 2 beats on chord start, repeat on beat 2
      if (bLocal === 0 || bLocal === 2) bass(chord.bass, t, 0.9)

      // Chord pad: fire once per chord, sustain through all 4 beats
      if (bLocal === 0) pad(chord.pad, t, 1.9)

      // Melody: rhythm varies per chord for texture
      if (MEL_RHYTHM[ci][bLocal]) beep(chord.mel[bLocal], 'sine', 0.16, 0.05, t)

      nextBeatTime += BEAT
      beatCount++
    }
  } catch(e) {}
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

  function startMusic() {
    if (musicIntervalId) return
    nextBeatTime = getCtx().currentTime
    beatCount = 0
    scheduleMusicBeats()
    musicIntervalId = setInterval(scheduleMusicBeats, 100)
  }

  function stopMusic() {
    if (musicIntervalId) { clearInterval(musicIntervalId); musicIntervalId = null }
  }

  return { play, startMusic, stopMusic }
}
