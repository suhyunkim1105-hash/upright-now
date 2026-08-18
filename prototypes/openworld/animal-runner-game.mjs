import * as Phaser from './vendor/phaser.esm.min.js'

import {
  RUNNER_CONFIG,
  canJump,
  collectCoin,
  createRunnerState,
  difficultyAt,
  finishRunner,
  hitObstacle,
  tickRunner,
} from './animal-runner-engine.mjs'

const WORLD = Object.freeze({
  width: 390,
  height: 700,
  groundY: 620,
  playerXMin: 39,
  playerXMax: 195,
  playerSpeed: 150,
  jumpVelocity: -470,
  gravity: 1150,
  baseWorldSpeed: 180,
  obstacleIntervalMs: 1250,
})

const ANIMAL_COLORS = Object.freeze({
  turtle: 0x79c98b,
  giraffe: 0xf4c95d,
  penguin: 0x8ec9e8,
  hamster: 0xe5ae86,
  frog: 0x83c96d,
  hedgehog: 0xc79873,
  alpaca: 0xead9bd,
  swan: 0xc7d9ef,
})

function createPlaceholderTexture(scene, key, color) {
  const graphics = scene.make.graphics({ x: 0, y: 0, add: false })
  graphics.fillStyle(color, 1)
  graphics.fillRoundedRect(4, 4, 24, 40, 9)
  graphics.fillStyle(0x2b3230, 1)
  graphics.fillCircle(12, 20, 3)
  graphics.fillCircle(22, 20, 3)
  graphics.generateTexture(key, 32, 48)
  graphics.destroy()
}

function createCharacterTexture(scene, character) {
  const key = 'animal-runner-player'
  const source = character?.image
  if (!source) {
    createPlaceholderTexture(scene, key, ANIMAL_COLORS[character?.id] ?? 0x79c98b)
    return key
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 48
    const context = canvas.getContext('2d')
    if (!context) throw new Error('runner canvas unavailable')
    context.imageSmoothingEnabled = false
    const sourceWidth = source.width || source.naturalWidth || 32
    const sourceHeight = source.height || source.naturalHeight || 48
    const frameWidth = sourceWidth >= 96 ? sourceWidth / 4 : sourceWidth
    context.drawImage(source, 0, 0, frameWidth, sourceHeight, 0, 0, 32, 48)
    scene.textures.addCanvas(key, canvas)
    return key
  } catch {
    createPlaceholderTexture(scene, key, ANIMAL_COLORS[character?.id] ?? 0x79c98b)
    return key
  }
}

function createMobileControls(container, handlers) {
  const controls = document.createElement('div')
  controls.className = 'animal-runner-mobile-controls'
  controls.innerHTML = `
    <button type="button" data-runner-control="left" aria-label="왼쪽 이동">←</button>
    <button type="button" data-runner-control="right" aria-label="오른쪽 이동">→</button>
    <button type="button" data-runner-control="jump" aria-label="점프">JUMP</button>`
  const style = document.createElement('style')
  style.textContent = `
    .animal-runner-mobile-controls{position:absolute;left:10px;right:10px;bottom:10px;z-index:10;display:flex;gap:8px;justify-content:center;pointer-events:none}
    .animal-runner-mobile-controls button{min-width:58px;min-height:48px;padding:8px 14px;border:0;border-radius:14px;background:rgba(255,255,255,.9);color:#2b3230;font:800 16px/1 inherit;box-shadow:0 4px 12px rgba(20,40,38,.2);touch-action:none;pointer-events:auto}
    .animal-runner-mobile-controls button[data-runner-control="jump"]{min-width:92px;background:#2dd4bf}
    .animal-runner-mobile-controls button:active{transform:translateY(2px) scale(.97)}
    @media (min-width:700px){.animal-runner-mobile-controls{display:none}}
  `
  container.append(style, controls)

  const cleanups = []
  for (const button of controls.querySelectorAll('button')) {
    const action = button.dataset.runnerControl
    const start = (event) => {
      event.preventDefault()
      if (action === 'left') handlers.setLeft(true)
      if (action === 'right') handlers.setRight(true)
      if (action === 'jump') handlers.jump()
    }
    const stop = (event) => {
      event.preventDefault()
      if (action === 'left') handlers.setLeft(false)
      if (action === 'right') handlers.setRight(false)
    }
    button.addEventListener('pointerdown', start)
    button.addEventListener('pointerup', stop)
    button.addEventListener('pointercancel', stop)
    button.addEventListener('pointerleave', stop)
    cleanups.push(() => {
      button.removeEventListener('pointerdown', start)
      button.removeEventListener('pointerup', stop)
      button.removeEventListener('pointercancel', stop)
      button.removeEventListener('pointerleave', stop)
    })
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup())
    style.remove()
    controls.remove()
  }
}

class RunnerScene extends Phaser.Scene {
  constructor() {
    super('RunnerScene')
    this.state = null
    this.context = null
    this.mobile = { left: false, right: false }
    this.spawnElapsed = 0
    this.nextCoinId = 0
    this.countdown = 3
    this.finished = false
  }

  init() {
    this.context = RunnerScene.context
    this.state = createRunnerState()
    this.spawnElapsed = 0
    this.nextCoinId = 0
    this.countdown = 3
    this.finished = false
  }

  create() {
    this.events.once('shutdown', this.shutdown, this)
    this.createBackground()
    this.createGroups()
    this.createPlayer()
    this.createInput()
    this.createHud()
    this.startCountdown()
  }

  createBackground() {
    this.add.rectangle(WORLD.width / 2, 260, WORLD.width, 520, 0xdff2f0)
    this.add.circle(320, 120, 44, 0xfff1bd, 0.85)
    this.add.rectangle(WORLD.width / 2, 470, WORLD.width, 150, 0xa8d6a1)
    this.add.triangle(75, 410, 0, 120, 100, 120, 50, 0, 0x7bb48e)
    this.add.triangle(240, 420, 0, 130, 120, 130, 60, 0, 0x6ca87f)
    const ground = this.add.rectangle(WORLD.width / 2, WORLD.groundY + 40, WORLD.width, 80, 0x7b6254)
    this.physics.add.existing(ground, true)
    this.ground = ground
  }

  createGroups() {
    this.obstacles = this.physics.add.group()
    this.coins = this.physics.add.group()
  }

  createPlayer() {
    const texture = createCharacterTexture(this, this.context?.character)
    this.player = this.physics.add.sprite(92, WORLD.groundY - 42, texture)
    this.player.setDisplaySize(48, 72)
    this.player.setDepth(5)
    this.player.body.setSize(26, 62)
    this.player.body.setOffset(3, 8)
    this.player.body.setGravityY(WORLD.gravity)
    this.physics.add.collider(this.player, this.ground)
    this.physics.add.collider(this.player, this.obstacles, () => this.handleObstacleHit())
    this.physics.add.overlap(this.player, this.coins, (_player, coin) => this.handleCoin(coin))
  }

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys()
    this.keys = this.input.keyboard.addKeys('A,D,SPACE')
    this.input.keyboard.on('keydown-SPACE', () => this.requestJump())
    this.input.keyboard.on('keydown-UP', () => this.requestJump())
    this.mobileCleanup = createMobileControls(this.context.container, {
      setLeft: (value) => { this.mobile.left = value },
      setRight: (value) => { this.mobile.right = value },
      jump: () => this.requestJump(),
    })
  }

  createHud() {
    this.hud = this.add.text(14, 14, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#2b3230',
      backgroundColor: '#ffffffdd',
      padding: { x: 10, y: 7 },
    }).setDepth(20)
    this.message = this.add.text(WORLD.width / 2, 250, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#2b3230',
      align: 'center',
    }).setOrigin(.5).setDepth(20)
    this.updateHud(0)
  }

  startCountdown() {
    this.state.status = 'COUNTDOWN'
    this.message.setText('3')
    this.countdownEvent = this.time.addEvent({
      delay: 750,
      repeat: 3,
      callback: () => {
        this.countdown -= 1
        if (this.countdown > 0) this.message.setText(String(this.countdown))
        else {
          this.message.setText('GO!')
          this.time.delayedCall(360, () => {
            if (!this.finished) {
              this.message.setText('')
              this.state.status = 'PLAYING'
              this.state.startedAt = this.time.now
            }
          })
        }
      },
    })
  }

  requestJump() {
    if (!canJump(this.state) || !this.player?.body) return
    this.state.airborne = true
    this.player.setVelocityY(WORLD.jumpVelocity)
  }

  spawnObstacle() {
    const high = Math.random() > 0.68
    const width = high ? 34 : 50
    const height = high ? 78 : 34
    const color = high ? 0x6c665e : 0x8b6149
    const obstacle = this.add.rectangle(WORLD.width + width, WORLD.groundY - height / 2, width, height, color)
    this.physics.add.existing(obstacle)
    obstacle.body.setAllowGravity(false)
    obstacle.body.setImmovable(true)
    this.obstacles.add(obstacle)
  }

  spawnCoinPattern() {
    const startX = WORLD.width + 38
    const high = Math.random() > 0.5
    for (let index = 0; index < 3; index += 1) {
      const y = high
        ? WORLD.groundY - 150 + Math.abs(index - 1) * 12
        : WORLD.groundY - 92 - index * 4
      const coin = this.add.circle(startX + index * 30, y, 11, 0xffc84f)
      coin.setStrokeStyle(3, 0xffe7a0)
      coin.runnerCoinId = `coin-${this.nextCoinId++}`
      this.physics.add.existing(coin)
      coin.body.setAllowGravity(false)
      this.coins.add(coin)
    }
  }

  handleCoin(coin) {
    if (!coin.active || !collectCoin(this.state, coin.runnerCoinId)) return
    coin.body.enable = false
    this.tweens.add({
      targets: coin,
      scale: 1.8,
      alpha: 0,
      duration: 160,
      onComplete: () => coin.destroy(),
    })
    this.updateHud(this.time.now - (this.state.startedAt ?? this.time.now))
  }

  handleObstacleHit() {
    if (!hitObstacle(this.state, this.time.now)) return
    this.slowUntil = this.time.now + RUNNER_CONFIG.invincibleDurationMs
    this.player.setTint(0xff8c80)
    this.tweens.add({
      targets: this.player,
      alpha: .35,
      duration: 100,
      yoyo: true,
      repeat: 4,
      onComplete: () => this.player.clearTint(),
    })
    this.updateHud(this.time.now - (this.state.startedAt ?? this.time.now))
  }

  moveWorld(time, multiplier) {
    const slow = time < (this.slowUntil ?? 0) ? .55 : 1
    const speed = WORLD.baseWorldSpeed * multiplier * slow
    for (const group of [this.obstacles, this.coins]) {
      group.children.each((item) => {
        if (!item?.active) return
        item.body.setVelocityX(-speed)
        if (item.x < -80) item.destroy()
      })
    }
  }

  updatePlayer() {
    const left = this.cursors.left.isDown || this.keys.A.isDown || this.mobile.left
    const right = this.cursors.right.isDown || this.keys.D.isDown || this.mobile.right
    const velocity = (right ? 1 : 0) - (left ? 1 : 0)
    this.player.setVelocityX(velocity * WORLD.playerSpeed)
    this.player.x = Phaser.Math.Clamp(this.player.x, WORLD.playerXMin, WORLD.playerXMax)
    if (this.player.body.blocked.down || this.player.body.touching.down) this.state.airborne = false
  }

  updateHud(elapsedMs) {
    const remaining = Math.max(0, RUNNER_CONFIG.gameDurationMs - elapsedMs)
    const seconds = Math.ceil(remaining / 1000)
    const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
    const rest = String(seconds % 60).padStart(2, '0')
    this.hud.setText(`TIME ${minutes}:${rest}   SCORE ${this.state.score}   COIN ${this.state.coins}   COMBO ${this.state.combo}`)
  }

  endGame() {
    if (this.finished) return
    this.finished = true
    const result = finishRunner(this.state, this.time.now)
    this.obstacles.clear(true, true)
    this.coins.clear(true, true)
    this.message.setText('RUN COMPLETE!')
    this.updateHud(result?.playTime ?? RUNNER_CONFIG.gameDurationMs)
    if (result) this.context.onGameComplete(result)
  }

  update(_time, delta) {
    if (this.state.status !== 'PLAYING' || this.finished) return
    const elapsedMs = this.time.now - (this.state.startedAt ?? this.time.now)
    if (elapsedMs >= RUNNER_CONFIG.gameDurationMs) {
      this.endGame()
      return
    }
    tickRunner(this.state, this.time.now)
    this.updatePlayer()
    const difficulty = difficultyAt(elapsedMs)
    this.moveWorld(this.time.now, difficulty.speedMultiplier)
    this.spawnElapsed += delta
    const interval = WORLD.obstacleIntervalMs / difficulty.speedMultiplier
    if (this.spawnElapsed >= interval) {
      this.spawnElapsed = 0
      this.spawnObstacle()
      if (Math.random() > .25) this.spawnCoinPattern()
    }
    this.updateHud(elapsedMs)
  }

  shutdown() {
    this.finished = true
    this.mobileCleanup?.()
    this.mobileCleanup = null
    this.input.keyboard?.removeAllListeners()
    this.countdownEvent?.remove(false)
  }
}

export function mountAnimalRunner({ container, character, onGameComplete }) {
  if (!container) throw new Error('animal runner requires a container')
  container.style.position = 'relative'
  RunnerScene.context = {
    container,
    character: character ?? { id: 'turtle', name: '거북이' },
    onGameComplete: (result) => onGameComplete?.(result),
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: WORLD.width,
    height: WORLD.height,
    parent: container,
    backgroundColor: '#dff2f0',
    render: { antialias: false, pixelArt: true },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD.width,
      height: WORLD.height,
    },
    scene: [RunnerScene],
    audio: { noAudio: true },
  })

  let destroyed = false
  const restart = () => {
    if (destroyed) return
    game.scene.stop('RunnerScene')
    game.scene.start('RunnerScene')
  }
  const destroy = () => {
    if (destroyed) return
    destroyed = true
    game.destroy(true)
    if (RunnerScene.context?.container === container) RunnerScene.context = null
  }
  return { restart, destroy }
}

export { RunnerScene }
