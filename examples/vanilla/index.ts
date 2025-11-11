import { action, lookAt, spring, springPresets, runTimeline, timePassed } from '@pmndrs/timeline'
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect } from 'postprocessing'
import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Color,
  Mesh,
  MeshPhysicalMaterial,
  SphereGeometry,
  ACESFilmicToneMapping,
  AmbientLight,
  SRGBColorSpace,
  PMREMGenerator,
  HalfFloatType,
  MeshStandardMaterial,
} from 'three'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

const root = document.getElementById('root') as HTMLDivElement

// renderer
const renderer = new WebGLRenderer()
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1
root.appendChild(renderer.domElement)

// scene
const scene = new Scene()
scene.background = new Color(0x0a0a0a)
// camera
const camera = new PerspectiveCamera(80, 1, 0.1, 100)
camera.position.set(0, 0, 5)
scene.add(camera)

// postprocessing
const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType })
composer.addPass(new RenderPass(scene, camera))
const bloom = new BloomEffect({ luminanceThreshold: 2, luminanceSmoothing: 0.9, height: 300 })
const vignette = new VignetteEffect({ eskil: false, offset: 0.1, darkness: 1.1 })
composer.addPass(new EffectPass(camera, bloom, vignette))

// lights (soft fill so emissive stands out but objects are visible)
scene.add(new AmbientLight(0xffffff, 0.2))

// geometry & materials
const sphereGeometry = new SphereGeometry(1, 32, 32)

const redMaterial = new MeshPhysicalMaterial({
  color: 'red',
  emissive: 'red',
  emissiveIntensity: 9,
})
const blueMaterial = new MeshPhysicalMaterial({
  color: 'blue',
  emissive: 'blue',
  emissiveIntensity: 30.0,
})

// meshes
const redPill = new Mesh(sphereGeometry, redMaterial)
redPill.position.set(-2, -1, 0)
redPill.scale.set(0.2, 0.2, 0.4)
redPill.rotation.y = (-30 / 180) * Math.PI
scene.add(redPill)

const bluePill = new Mesh(sphereGeometry, blueMaterial)
bluePill.position.set(2, -1, 0)
bluePill.scale.set(0.2, 0.2, 0.4)
bluePill.rotation.y = (20 / 180) * Math.PI
scene.add(bluePill)

const fontLoader = new FontLoader()
const font = await fontLoader.loadAsync('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json')
const textGeometry = new TextGeometry("Remember: all I'm offering is the truth. Nothing more.", {
  font,
  size: 0.3,
  depth: 0.02,
  curveSegments: 8,
})
const textMaterial = new MeshStandardMaterial({
  color: 0xcccccc,
  toneMapped: false,
})
const textMesh = new Mesh(textGeometry, textMaterial)
textMesh.position.y = 0.5
textMesh.position.x = -4.5
scene.add(textMesh)

const url =
  'https://raw.githubusercontent.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/studio_small_03_1k.hdr'
const rgbe = new RGBELoader()
const hdr = await rgbe.loadAsync(url)
const pmrem = new PMREMGenerator(renderer)
pmrem.compileEquirectangularShader()
const env = pmrem.fromEquirectangular(hdr)
scene.environment = env.texture
scene.background = env.texture
scene.backgroundRotation.y = (90 / 180) * Math.PI
scene.backgroundBlurriness = 0.1
scene.backgroundIntensity = 0.1
hdr.dispose()
pmrem.dispose()

async function* mainTimeline() {
  while (true) {
    yield* action({ update: lookAt(camera, redPill, spring(springPresets.stiff)) })
    yield* action({ until: timePassed(0.3, 'seconds') })
    yield* action({ update: lookAt(camera, bluePill, spring(springPresets.stiff)) })
    yield* action({ until: timePassed(0.3, 'seconds') })
  }
}

const update = runTimeline(mainTimeline(), {})

// animate
let lastTimeMs = performance.now()
function onFrame(nowMs: number) {
  const deltaSeconds = Math.min(1 / 15, Math.max(0, (nowMs - lastTimeMs) / 1000))
  lastTimeMs = nowMs

  // drive timeline
  update(undefined, deltaSeconds)

  // render
  composer.render(deltaSeconds)
  requestAnimationFrame(onFrame)
}
requestAnimationFrame(onFrame)

// resize handling
function onResize() {
  const width = root.clientWidth
  const height = root.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  composer.setSize(width, height)
}
onResize()
window.addEventListener('resize', onResize)
