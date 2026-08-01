import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const COLORS = {
  canvas: 0xfbf5eb,
  ink: 0x173332,
  shell: 0x789b55,
  shellLight: 0xb9ce73,
  body: 0xf2d277,
  pink: 0xf3a7bc,
  blue: 0xa9d5ee,
  mint: 0xc6dfc5,
  surface: 0xfffdf8,
  yellow: 0xf5d26a,
  coral: 0xd95776,
} as const

type Point3 = [number, number, number]

function standardMaterial(color: number, roughness = 0.66, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function glowMaterial(color: number, intensity = 0.4) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.42,
    metalness: 0.01,
  })
}

function addRoundedBox(
  parent: THREE.Object3D,
  size: Point3,
  color: number,
  position: Point3,
  rotation: Point3 = [0, 0, 0],
  radius = 0.1,
  smoothness = 4,
  meshMaterial?: THREE.Material,
) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, radius, smoothness), meshMaterial ?? standardMaterial(color))
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function addLine(parent: THREE.Object3D, points: Point3[], color: number, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(...point)))
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
  )
  parent.add(line)
  return line
}

function addLabel(parent: THREE.Object3D, text: string, position: Point3, color: string, background: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const context = canvas.getContext('2d')
  if (!context) return null
  context.fillStyle = background
  context.roundRect(8, 8, 496, 144, 32)
  context.fill()
  context.fillStyle = color
  context.font = '700 54px Pretendard, Arial, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 256, 80)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 0.52), material)
  mesh.position.set(...position)
  parent.add(mesh)
  return mesh
}

function createTurtle() {
  const turtle = new THREE.Group()
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.82, 32, 20), standardMaterial(COLORS.shell, 0.76))
  shell.scale.set(1.28, 0.76, 1.04)
  shell.position.y = 0.34
  shell.castShadow = true
  turtle.add(shell)

  const shellCap = new THREE.Mesh(new THREE.SphereGeometry(0.57, 28, 16), standardMaterial(COLORS.shellLight, 0.68))
  shellCap.scale.set(1.15, 0.28, 0.88)
  shellCap.position.set(-0.08, 0.86, 0)
  shellCap.castShadow = true
  turtle.add(shellCap)

  const shellStripe = new THREE.Mesh(
    new THREE.TorusGeometry(0.63, 0.045, 10, 32),
    standardMaterial(COLORS.shellLight, 0.65),
  )
  shellStripe.rotation.x = Math.PI / 2
  shellStripe.scale.set(1.16, 0.75, 1)
  shellStripe.position.y = 0.43
  turtle.add(shellStripe)

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.57, 24, 16), standardMaterial(COLORS.body, 0.72))
  body.scale.set(1.06, 0.6, 0.9)
  body.position.set(0.04, -0.12, 0.04)
  body.castShadow = true
  turtle.add(body)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 16), standardMaterial(COLORS.body, 0.6))
  head.position.set(0.64, 0.2, 0.04)
  head.castShadow = true
  turtle.add(head)

  const eyeWhite = standardMaterial(COLORS.surface, 0.42)
  const pupil = standardMaterial(COLORS.ink, 0.34)
  for (const z of [-0.15, 0.15]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 10), eyeWhite)
    eye.position.set(0.84, 0.31, z)
    turtle.add(eye)
    const eyePupil = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 8), pupil)
    eyePupil.position.set(0.91, 0.31, z)
    turtle.add(eyePupil)
  }

  for (const [x, z] of [[-0.46, -0.45], [-0.46, 0.45], [0.43, -0.43], [0.43, 0.43]] as const) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 12), standardMaterial(COLORS.body, 0.72))
    foot.scale.set(1.15, 0.55, 0.9)
    foot.position.set(x, -0.38, z)
    foot.castShadow = true
    turtle.add(foot)
  }

  return turtle
}

function createScene() {
  const root = new THREE.Group()
  const floating: THREE.Object3D[] = []

  addRoundedBox(root, [8.8, 0.22, 4.8], COLORS.pink, [0, -1.76, 0.1], [0, 0.02, 0], 0.2)
  addRoundedBox(root, [8.25, 0.08, 4.28], COLORS.yellow, [0, -1.61, 0.1], [0, 0.02, 0], 0.18)

  const monitor = new THREE.Group()
  monitor.position.set(1.78, 0.05, -0.75)
  addRoundedBox(monitor, [4.45, 2.72, 0.2], COLORS.surface, [0, 0, 0], [0, -0.06, 0], 0.16)
  addRoundedBox(monitor, [4.12, 2.38, 0.06], COLORS.blue, [0, 0, 0.14], [0, -0.06, 0], 0.09, 4, glowMaterial(COLORS.blue, 0.16))
  addRoundedBox(monitor, [3.74, 1.92, 0.03], COLORS.mint, [0, -0.02, 0.19], [0, -0.06, 0], 0.08)
  addLine(monitor, [[-1.48, 0.44, 0.22], [1.48, 0.44, 0.22]], COLORS.yellow, 0.94)
  addLine(monitor, [[-1.48, -0.55, 0.22], [1.48, -0.55, 0.22]], COLORS.yellow, 0.94)
  addLine(monitor, [[-1.12, -0.55, 0.22], [-0.62, -0.2, 0.22], [0.62, -0.2, 0.22], [1.12, -0.55, 0.22]], COLORS.ink, 0.78)
  const faceGuide = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 10, 32), glowMaterial(COLORS.coral, 0.8))
  faceGuide.position.set(0, 0.32, 0.25)
  monitor.add(faceGuide)
  const shoulderDot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), glowMaterial(COLORS.coral, 0.85))
  shoulderDot.position.set(0, -0.21, 0.25)
  monitor.add(shoulderDot)
  addLabel(monitor, 'POSTURE CHECK', [-1.12, -0.92, 0.26], '#173332', '#fffdf8')
  addLabel(monitor, '25 MIN FOCUS', [1.1, -0.92, 0.26], '#173332', '#f5d26a')

  addRoundedBox(monitor, [0.22, 0.52, 0.22], COLORS.ink, [0, -1.58, 0], [0, 0, 0], 0.07)
  addRoundedBox(monitor, [1.18, 0.12, 0.76], COLORS.ink, [0, -1.82, 0], [0, 0, 0], 0.08)
  root.add(monitor)

  const webcam = new THREE.Group()
  webcam.position.set(1.78, 1.48, -0.72)
  addRoundedBox(webcam, [0.66, 0.26, 0.28], COLORS.ink, [0, 0, 0], [0, 0, 0], 0.09)
  const cameraRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 10, 24), glowMaterial(COLORS.pink, 0.95))
  cameraRing.position.z = 0.16
  webcam.add(cameraRing)
  const cameraDot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), glowMaterial(COLORS.mint, 1.1))
  cameraDot.position.set(0.23, 0.06, 0.16)
  webcam.add(cameraDot)
  root.add(webcam)

  addRoundedBox(root, [2.18, 0.12, 0.68], COLORS.surface, [1.78, -1.36, 0.36], [0, -0.05, 0], 0.08)
  for (let index = 0; index < 5; index += 1) {
    addRoundedBox(root, [1.58, 0.025, 0.035], index === 4 ? COLORS.pink : COLORS.ink, [1.3, -1.285, 0.18 + index * 0.1], [0, -0.05, 0], 0.015)
  }

  const books = new THREE.Group()
  books.position.set(-2.72, -1.18, 0.5)
  addRoundedBox(books, [1.42, 0.2, 0.92], COLORS.blue, [0, 0, 0], [0, 0.1, -0.04], 0.08)
  addRoundedBox(books, [1.28, 0.18, 0.84], COLORS.yellow, [0.08, 0.18, 0.02], [0, -0.08, 0.03], 0.08)
  addRoundedBox(books, [1.08, 0.16, 0.74], COLORS.mint, [-0.02, 0.34, 0.03], [0, 0.06, -0.02], 0.08)
  root.add(books)

  const turtle = createTurtle()
  turtle.position.set(-2.02, -0.7, 0.92)
  turtle.rotation.y = -0.2
  turtle.scale.setScalar(0.96)
  root.add(turtle)

  const turtleHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.025, 10, 48),
    glowMaterial(COLORS.yellow, 0.75),
  )
  turtleHalo.rotation.x = Math.PI / 2
  turtleHalo.position.set(-2.02, -0.7, 0.92)
  root.add(turtleHalo)

  const timerCard = addRoundedBox(root, [1.76, 0.82, 0.12], COLORS.surface, [-2.78, 0.62, -0.12], [0, 0.08, -0.05], 0.13)
  addLabel(timerCard, 'FOCUS 25', [0, 0, 0.08], '#173332', '#c6dfc5')
  timerCard.userData.baseY = timerCard.position.y
  floating.push(timerCard)
  const postureCard = addRoundedBox(root, [1.75, 0.84, 0.12], COLORS.pink, [2.78, 0.68, -0.3], [0, -0.12, 0.04], 0.13)
  addLabel(postureCard, 'COME BACK', [0, 0, 0.08], '#173332', '#f3a7bc')
  postureCard.userData.baseY = postureCard.position.y
  floating.push(postureCard)

  const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), glowMaterial(COLORS.yellow, 1.1))
  spark.position.set(3.42, -0.16, 0.3)
  root.add(spark)

  return { root, turtle, turtleHalo, cameraRing, floating }
}

export function LandingHeroScene() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch {
      setUnsupported(true)
      return
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setClearColor(COLORS.canvas, 1)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(COLORS.canvas)
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
    camera.position.set(0.25, 0.68, 10.4)
    camera.lookAt(0.25, -0.46, 0)

    scene.add(new THREE.HemisphereLight(0xfffdf8, 0x6f8b63, 2.5))
    const keyLight = new THREE.DirectionalLight(0xfffdf8, 3.7)
    keyLight.position.set(-4, 6, 5)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    scene.add(keyLight)
    const fillLight = new THREE.PointLight(COLORS.pink, 1.4, 8)
    fillLight.position.set(3, 2.2, 3)
    scene.add(fillLight)

    const { root, turtle, turtleHalo, cameraRing, floating } = createScene()
    root.position.set(0.78, -0.44, 0)
    root.scale.setScalar(0.92)
    scene.add(root)

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.075, 0.28, 0.96))
    composer.addPass(new OutputPass())

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      if (width === 0 || height === 0) return
      const narrow = width / height < 0.8
      camera.aspect = width / height
      camera.position.z = narrow ? 14.2 : 10.4
      camera.updateProjectionMatrix()
      root.position.x = narrow ? 0 : 0.78
      root.position.y = narrow ? -0.72 : -0.44
      root.scale.setScalar(narrow ? 0.68 : 0.92)
      renderer.setSize(width, height, false)
      composer.setSize(width, height)
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)
    resize()

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let visible = true
    let frameId: number | null = null
    const timer = new THREE.Timer()

    const renderFrame = () => {
      if (!visible) {
        frameId = null
        return
      }
      timer.update()
      const elapsed = timer.getElapsed()
      root.rotation.y = Math.sin(elapsed * 0.24) * 0.035
      turtle.position.y = -0.7 + Math.sin(elapsed * 0.75) * 0.035
      turtleHalo.position.y = -0.7 + Math.sin(elapsed * 0.75) * 0.035
      turtleHalo.scale.setScalar(1 + Math.sin(elapsed * 0.9) * 0.045)
      cameraRing.rotation.z = elapsed * 0.3
      floating.forEach((item, index) => {
        const baseY = item.userData.baseY
        if (typeof baseY === 'number') item.position.y = baseY + Math.sin(elapsed * 0.55 + index * 1.9) * 0.04
      })
      composer.render()
      frameId = requestAnimationFrame(renderFrame)
    }

    const start = () => {
      if (frameId !== null) return
      frameId = requestAnimationFrame(renderFrame)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !reducedMotion) start()
    }, { threshold: 0.01 })
    observer.observe(mount)

    if (reducedMotion) composer.render()
    else start()

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      timer.dispose()
      observer.disconnect()
      resizeObserver.disconnect()
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return
        object.geometry.dispose()
        if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose())
        else {
          const texture = object.material.map
          texture?.dispose()
          object.material.dispose()
        }
      })
      composer.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  if (unsupported) {
    return <div className="landing-hero-3d__fallback">3D 미리보기를 지원하지 않는 환경에서는<br />기본 캐릭터 화면으로 안내해요</div>
  }

  return <div ref={mountRef} className="landing-hero-3d" data-testid="landing-hero-3d" aria-hidden="true" />
}
