import {
  RUNNER_CONFIG, canJump, collectCoin, createRunnerState, difficultyAt,
  finishRunner, hitObstacle, tickRunner,
} from './animal-runner-engine.mjs'

const W = 390, H = 560, GROUND = 486
const COLORS = Object.freeze({
  turtle: '#79C98B', giraffe: '#F4C95D', penguin: '#8EC9E8', hamster: '#E5AE86',
  frog: '#83C96D', hedgehog: '#C79873', alpaca: '#EAD9BD', swan: '#C7D9EF',
})

const hitBox = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x
  && a.y < b.y + b.h && a.y + a.h > b.y

function roundRect(c, x, y, w, h, r, fill) {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill()
}

function makeControls(root, api) {
  const controls = document.createElement('div')
  controls.className = 'animal-runner-controls'
  controls.innerHTML = `<button type="button" data-r="left">←</button>
    <button type="button" data-r="jump">JUMP</button><button type="button" data-r="right">→</button>`
  const style = document.createElement('style')
  style.textContent = `.animal-runner-controls{position:absolute;left:12px;right:12px;bottom:12px;z-index:3;display:flex;justify-content:center;gap:8px;pointer-events:none}
    .animal-runner-controls button{pointer-events:auto;min-width:58px;min-height:42px;border:0;border-radius:14px;background:rgba(255,255,255,.9);box-shadow:0 7px 15px rgba(55,85,99,.18);color:#355064;font:900 13px/1 inherit}
    .animal-runner-controls button[data-r="jump"]{min-width:86px;background:#7DE4D2;color:#116E66}
    @media(min-width:700px){.animal-runner-controls{opacity:.28}.animal-runner-controls:hover{opacity:1}}`
  root.append(style, controls)
  const held = { left: false, right: false }
  for (const button of controls.querySelectorAll('button')) {
    const key = button.dataset.r
    const down = (e) => { e.preventDefault(); if (key === 'jump') api.jump(); else held[key] = true }
    const up = (e) => { e.preventDefault(); if (key !== 'jump') held[key] = false }
    button.addEventListener('pointerdown', down)
    button.addEventListener('pointerup', up)
    button.addEventListener('pointercancel', up)
    button.addEventListener('pointerleave', up)
  }
  return { held, destroy() { style.remove(); controls.remove() } }
}

export function mountAnimalRunner({ container, character, onGameComplete } = {}) {
  if (!container) throw new Error('동물 러너를 붙일 공간이 없습니다.')
  container.replaceChildren()
  container.style.position = 'relative'
  const canvas = document.createElement('canvas')
  canvas.width = W * 2; canvas.height = H * 2
  canvas.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;background:#EAF8FB;touch-action:none'
  canvas.setAttribute('aria-label', '동물 러너 게임')
  container.appendChild(canvas)
  const c = canvas.getContext('2d'); c.scale(2, 2)
  let frame = 0, alive = true, last = performance.now(), countdown = 2200
  let state, player, obstacles, coins, obstacleT, coinT, nextCoin, finished
  const keys = { left: false, right: false }

  const reset = () => {
    state = createRunnerState(); state.status = 'COUNTDOWN'
    player = { x: 78, y: GROUND - 62, w: 42, h: 62, vy: 0 }
    obstacles = []; coins = []; obstacleT = 720; coinT = 410; nextCoin = 1
    countdown = 2200; finished = false; last = performance.now()
  }
  const jump = () => {
    if (!canJump(state)) return
    state.airborne = true; player.vy = -505
  }
  const controls = makeControls(container, { jump })

  const keydown = (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault()
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true
    if (e.code === 'ArrowUp' || e.code === 'Space') jump()
  }
  const keyup = (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false
  }
  addEventListener('keydown', keydown); addEventListener('keyup', keyup)
  canvas.addEventListener('pointerdown', jump)

  const spawnObstacle = () => {
    const tall = Math.random() > .68
    const w = tall ? 27 : 43, h = tall ? 72 : 34
    obstacles.push({ x: W + 12, y: GROUND - h, w, h, hit: false })
  }
  const spawnCoins = () => {
    const high = Math.random() > .52
    for (let i = 0; i < 3; i++) coins.push({ id: nextCoin++, x: W + 20 + i * 31,
      y: GROUND - (high ? 118 + Math.sin(i / 2 * Math.PI) * 28 : 58), r: 10 })
  }

  const update = (dt, now) => {
    if (state.status === 'COUNTDOWN') {
      countdown -= dt * 1000
      if (countdown <= 0) { state.status = 'PLAYING'; state.startedAt = now }
      return
    }
    if (state.status !== 'PLAYING') return
    tickRunner(state, now)
    const elapsed = now - state.startedAt
    const speed = 185 * difficultyAt(elapsed).speedMultiplier
    const dir = (keys.right || controls.held.right ? 1 : 0) - (keys.left || controls.held.left ? 1 : 0)
    player.x = Math.max(18, Math.min(188, player.x + dir * 145 * dt))
    player.vy += 1150 * dt; player.y += player.vy * dt
    if (player.y >= GROUND - player.h) { player.y = GROUND - player.h; player.vy = 0; state.airborne = false }
    obstacleT -= dt * 1000; coinT -= dt * 1000
    if (obstacleT <= 0) { spawnObstacle(); obstacleT = 1040 + Math.random() * 520 }
    if (coinT <= 0) { spawnCoins(); coinT = 980 + Math.random() * 760 }
    obstacles.forEach((o) => {
      o.x -= speed * dt
      if (!o.hit && hitBox(player, o) && hitObstacle(state, now)) o.hit = true
    })
    coins.forEach((c0) => {
      c0.x -= speed * dt
      const b = { x: c0.x - c0.r, y: c0.y - c0.r, w: c0.r * 2, h: c0.r * 2 }
      if (!c0.got && hitBox(player, b) && collectCoin(state, c0.id)) c0.got = true
    })
    obstacles = obstacles.filter((o) => o.x + o.w > -10)
    coins = coins.filter((q) => !q.got && q.x + q.r > -10)
    if (elapsed >= RUNNER_CONFIG.gameDurationMs && !finished) {
      finished = true
      const result = finishRunner(state, now)
      onGameComplete?.(result)
    }
  }

  const drawBackground = (now) => {
    const grad = c.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#DDF5FB'); grad.addColorStop(1, '#F4FBF7')
    c.fillStyle = grad; c.fillRect(0, 0, W, H)
    c.fillStyle = '#FFF2B8'; c.beginPath(); c.arc(322, 78, 34, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#B9DDD1'; c.beginPath(); c.moveTo(0, 366); c.quadraticCurveTo(80, 250, 172, 366); c.quadraticCurveTo(275, 215, 390, 366); c.lineTo(390, GROUND); c.lineTo(0, GROUND); c.fill()
    c.fillStyle = '#8CC7AC'; c.beginPath(); c.moveTo(0, 410); c.quadraticCurveTo(110, 292, 210, 412); c.quadraticCurveTo(310, 300, 390, 405); c.lineTo(390, GROUND); c.lineTo(0, GROUND); c.fill()
    c.fillStyle = '#D9C4A6'; c.fillRect(0, GROUND, W, H - GROUND)
    c.strokeStyle = '#C3A982'; c.lineWidth = 3
    for (let x = -((now * .09) % 46); x < W; x += 46) { c.beginPath(); c.moveTo(x, GROUND + 26); c.lineTo(x + 25, GROUND + 26); c.stroke() }
  }

  const drawPlayer = (now) => {
    const flash = now < state.invincibleUntil && ((now / 90) | 0) % 2
    if (flash) return
    const col = COLORS[character?.id] || COLORS.turtle
    c.save(); c.translate(player.x + player.w / 2, player.y + player.h / 2)
    if (state.airborne) c.rotate(-.08)
    c.fillStyle = 'rgba(54,80,74,.14)'; c.beginPath(); c.ellipse(0, player.h / 2 + 9, 24, 7, 0, 0, Math.PI * 2); c.fill()
    c.fillStyle = col; c.beginPath(); c.ellipse(0, 9, 20, 27, 0, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(0, -21, 21, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#28333A'; c.beginPath(); c.arc(-7, -23, 3, 0, Math.PI * 2); c.arc(7, -23, 3, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#F09B9B'; c.beginPath(); c.arc(-15, -15, 4, 0, Math.PI * 2); c.arc(15, -15, 4, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#EFF9F2'; c.beginPath(); c.ellipse(0, 9, 9, 13, 0, 0, Math.PI * 2); c.fill()
    c.restore()
  }

  const draw = (now) => {
    drawBackground(now)
    obstacles.forEach((o) => { roundRect(c, o.x, o.y, o.w, o.h, 8, o.hit ? '#D7A390' : '#966F59'); roundRect(c, o.x + 5, o.y + 5, o.w - 10, 7, 4, '#BD9274') })
    coins.forEach((q) => { c.fillStyle = '#F5C94E'; c.beginPath(); c.arc(q.x, q.y, q.r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#D9A930'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#FFF2A9'; c.beginPath(); c.arc(q.x - 3, q.y - 3, 2.5, 0, Math.PI * 2); c.fill() })
    drawPlayer(now)
    roundRect(c, 12, 12, 168, 48, 15, 'rgba(255,255,255,.88)')
    c.fillStyle = '#33485A'; c.font = '800 13px sans-serif'; c.fillText(`${character?.name || '동물'} 러너`, 25, 31)
    c.fillStyle = '#718596'; c.font = '700 11px sans-serif'; c.fillText(`${Math.max(0, state.score)}점 · 코인 ${state.coins}`, 25, 49)
    const left = state.startedAt == null ? 60 : Math.max(0, Math.ceil((RUNNER_CONFIG.gameDurationMs - (now - state.startedAt)) / 1000))
    roundRect(c, W - 75, 14, 60, 36, 13, 'rgba(255,255,255,.88)'); c.fillStyle = '#33485A'; c.font = '900 15px sans-serif'; c.fillText(`${left}s`, W - 57, 37)
    if (state.status === 'COUNTDOWN') {
      const n = Math.max(1, Math.ceil(countdown / 740)); c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(W / 2, H / 2 - 45, 45, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#15897C'; c.font = '900 42px sans-serif'; c.textAlign = 'center'; c.fillText(String(n), W / 2, H / 2 - 30); c.textAlign = 'left'
    }
  }

  const loop = (now) => {
    if (!alive) return
    const dt = Math.min(.034, Math.max(.001, (now - last) / 1000)); last = now
    update(dt, now); draw(now); frame = requestAnimationFrame(loop)
  }
  reset(); frame = requestAnimationFrame(loop)

  return {
    restart() { reset() },
    destroy() {
      if (!alive) return; alive = false; cancelAnimationFrame(frame)
      removeEventListener('keydown', keydown); removeEventListener('keyup', keyup)
      controls.destroy(); canvas.remove()
    },
  }
}
