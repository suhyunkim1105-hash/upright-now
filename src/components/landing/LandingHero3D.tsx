import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const COLORS = {
  ink: 0x173332,
  shell: 0x7e9d54,
  shellLight: 0xb7c96e,
  body: 0xf3d77b,
  pink: 0xf3a7bc,
  blue: 0xa9d5ee,
  surface: 0xfffdf8,
  yellow: 0xf5d26a,
} as const

function material(color: number, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 })
}

function addRoundedBlock(
  parent: THREE.Group,
  size: [number, number, number],
  color: number,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color))
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function addLine(parent: THREE.Group, points: THREE.Vector3[], color: number, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
  )
  parent.add(line)
  return line
}

function createTurtle() {
  const turtle = new THREE.Group()
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.68, 24, 16), material(COLORS.shell))
  shell.scale.set(1.2, 0.72, 1)
  shell.position.y = 0.32
  shell.castShadow = true
  turtle.add(shell)

  const shellHighlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 20, 14),
    material(COLORS.shellLight),
  )
  shellHighlight.scale.set(1.1, 0.38, 0.9)
  shellHighlight.position.set(-0.08, 0.63, 0.02)
  turtle.add(shellHighlight)

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.49, 20, 14), material(COLORS.body))
  body.scale.set(1.05, 0.58, 0.9)
  body.position.set(0.04, -0.03, 0.02)
  body.castShadow = true
  turtle.add(body)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 14), material(COLORS.body))
  head.position.set(0.54, 0.18, 0.02)
  head.castShadow = true
  turtle.add(head)

  const eyeMaterial = material(COLORS.ink, 0.45)
  for (const z of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeMaterial)
    eye.position.set(0.77, 0.28, z)
    turtle.add(eye)
  }

  for (const [x, z] of [[-0.38, -0.42], [-0.38, 0.42], [0.38, -0.42], [0.38, 0.42]] as const) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10), material(COLORS.body))
    foot.scale.set(1, 0.58, 1)
    foot.position.set(x, -0.26, z)
    foot.castShadow = true
    turtle.add(foot)
  }

  return turtle
}

function createSceneGroup() {
  const group = new THREE.Group()

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.72, 0.18, 48),
    material(COLORS.pink),
  )
  platform.position.y = -1.08
  platform.castShadow = true
  platform.receiveShadow = true
  group.add(platform)

  const platformTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.34, 1.47, 0.04, 48),
    material(COLORS.yellow),
  )
  platformTop.position.y = -0.96
  group.add(platformTop)

  const monitor = new THREE.Group()
  addRoundedBlock(monitor, [2.32, 1.45, 0.13], COLORS.surface, [0.25, 0.1, -0.25], [0, -0.14, 0])
  addRoundedBlock(monitor, [2.02, 1.15, 0.035], COLORS.blue, [0.25, 0.1, -0.17], [0, -0.14, 0])
  addRoundedBlock(monitor, [0.16, 0.56, 0.16], COLORS.ink, [0.25, -0.85, -0.25])
  const monitorBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 32), material(COLORS.ink))
  monitorBase.position.set(0.25, -1.1, -0.25)
  monitor.add(monitorBase)
  group.add(monitor)

  const cameraRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.055, 12, 32),
    material(COLORS.pink, 0.45),
  )
  cameraRing.position.set(0.25, 0.88, -0.04)
  cameraRing.rotation.x = Math.PI / 2
  group.add(cameraRing)

  const postureFrame = new THREE.Group()
  addLine(postureFrame, [new THREE.Vector3(-0.62, 0.56, 0.04), new THREE.Vector3(0.86, 0.56, 0.04)], COLORS.yellow, 0.92)
  addLine(postureFrame, [new THREE.Vector3(-0.62, -0.15, 0.04), new THREE.Vector3(0.86, -0.15, 0.04)], COLORS.yellow, 0.92)
  postureFrame.position.set(0.25, 0.1, 0.05)
  group.add(postureFrame)

  const turtle = createTurtle()
  turtle.position.set(-0.6, -0.58, 0.48)
  turtle.rotation.y = -0.18
  group.add(turtle)

  const focusDot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), material(COLORS.ink))
  focusDot.position.set(-0.2, 0.62, 0.1)
  group.add(focusDot)

  return { group, turtle, cameraRing }
}

export function LandingHero3D() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      setUnsupported(true)
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
    camera.position.set(0, 0.55, 6.4)
    camera.lookAt(0, 0, 0)

    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xfffdf8, 0x7e9d54, 2.4))
    const keyLight = new THREE.DirectionalLight(0xfffdf8, 3.2)
    keyLight.position.set(-3, 5, 4)
    keyLight.castShadow = true
    scene.add(keyLight)

    const { group, turtle, cameraRing } = createSceneGroup()
    group.rotation.y = -0.25
    group.position.y = 0.12
    scene.add(group)

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      if (width === 0 || height === 0) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
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
      group.rotation.y = -0.25 + Math.sin(elapsed * 0.34) * 0.08
      turtle.position.y = -0.58 + Math.sin(elapsed * 0.7) * 0.035
      cameraRing.rotation.z = elapsed * 0.18
      renderer.render(scene, camera)
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

    if (reducedMotion) {
      renderer.render(scene, camera)
    } else {
      start()
    }

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      timer.dispose()
      observer.disconnect()
      resizeObserver.disconnect()
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return
        object.geometry.dispose()
        if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose())
        else object.material.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  if (unsupported) {
    return <div className="landing-hero-3d__fallback">3D 미리보기를 지원하지 않는 환경에서는<br />기본 캐릭터 화면으로 안내해요.</div>
  }

  return (
    <div ref={mountRef} className="landing-hero-3d" data-testid="landing-hero-3d" aria-hidden="true" />
  )
}
