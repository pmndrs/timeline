import { useGLTF } from '@react-three/drei'
import { applyProps, useThree } from '@react-three/fiber'
import {
  action,
  doUntil,
  lookAt,
  mediaFinished,
  offsetDistance,
  offsetRotation,
  parallel,
  property,
  spring,
  springPresets,
  timePassed,
  transition,
  useRunTimeline,
  velocity,
} from '@react-three/timeline'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MeshBVH, StaticGeometryGenerator } from 'three-mesh-bvh'
import { useDepthOfFieldStore } from './effect.js'
import { PressStartVisible, TextOpacities, TextYOffset } from './text.js'

const NegZ = new THREE.Vector3(0, 0, -1)
const directionHelper = new THREE.Vector3()
const startQuaternionOffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (-20 / 180) * Math.PI, 0))
const endQuaternionoffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (20 / 180) * Math.PI, 0))

/*
Author: Steven Grey (https://sketchfab.com/Steven007)
License: CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/)
Source: https://sketchfab.com/3d-models/lamborghini-urus-2650599973b649ddb4460ff6c03e4aa2
Title: Lamborghini Urus
*/
export function Lamborghini(props: any) {
  const { scene, nodes, materials } = useGLTF('/lambo.glb')
  const bvh = useMemo(() => {
    const generator = new StaticGeometryGenerator(scene)
    return new MeshBVH(generator.generate())
  }, [scene])
  useEffect(() => scene.traverse((object) => (object.castShadow = true)), [scene])
  const camera = useThree((s) => s.camera)
  useRunTimeline(
    async function* () {
      const wheels = ['RR', 'RL', 'FR', 'FL'].map((name) => scene.getObjectByName(name))
      const frontWheels = ['FR', 'FL'].map((name) => scene.getObjectByName(name))
      while (true) {
        camera.position.set(0, 300, 400)
        camera.lookAt(new THREE.Vector3(0, -75, 400))
        frontWheels.forEach((wheel) => (wheel!.rotation.y = 0))
        useDepthOfFieldStore.setState({ focusDistance: 500, focusRange: 1 })
        ;(camera as THREE.PerspectiveCamera).fov = 45
        ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
        TextOpacities.forEach((opacity) => (opacity.value = 0))
        TextYOffset.forEach((offset) => (offset.value = 500))
        PressStartVisible.value = 'visible'

        await new Promise((resolve) => window.addEventListener('click', resolve))
        PressStartVisible.value = 'hidden'
        const audio = document.createElement('audio')
        audio.src = './background.mp3'
        document.body.appendChild(audio)
        await audio.play()
        const boundingBox = new THREE.Box3()
        bvh.getBoundingBox(boundingBox)

        scene.position.z = -1000
        yield* parallel(
          'race',
          async function* () {
            yield* parallel(
              'race',
              async function* () {
                yield* parallel(
                  'all',
                  ...TextOpacities.map(async function* (opacity, i) {
                    await timePassed(i * 0.05, 'seconds')
                    yield* action({
                      update: [
                        transition(property(opacity, 'value'), 1, spring(springPresets.wobbly)),
                        transition(property(TextYOffset[i], 'value'), 0, spring(springPresets.wobbly)),
                      ],
                    })
                  }),
                )
                await timePassed(1, 'seconds')
              },
              action({
                update: [transition(camera.position, [0, 100, 400], velocity(50, 150))],
              }),
            )
            yield* action({
              update: [
                transition(camera.position, [1000, 0, 0], velocity(200, 200)),
                lookAt(camera, scene, spring(springPresets.gentle)),
              ],
            })
          },
          action({
            update: [
              transition(
                scene.position,
                [0, 0, 0],
                spring({ ...springPresets.gentle, stiffness: 40, maxVelocity: 250 }),
              ),
              (_, clock) => {
                wheels.forEach((wheel) => (wheel!.rotation.x = scene.position.z * Math.PI * 0.0045))
              },
            ],
          }),
        )

        yield* doUntil(mediaFinished(audio), async function* () {
          const position = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() * 0.6 - 0.1,
            Math.random() - 0.5,
          ).multiplyScalar(1000)
          const boundingBoxCenter = boundingBox.getCenter(new THREE.Vector3())
          new THREE.Ray(position.clone(), position.clone().negate().add(boundingBoxCenter)).intersectBox(
            boundingBox,
            position,
          )
          const point = bvh.closestPointToPoint(position)!.point
          const distance = Math.random()
          ;(camera as THREE.PerspectiveCamera).fov = 25 + 45 * (1 - distance)
          ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
          directionHelper.copy(point).negate().add(boundingBoxCenter)
          directionHelper.y = Math.min(directionHelper.y, 0)
          directionHelper.normalize()
          const quaternion = new THREE.Quaternion().setFromUnitVectors(NegZ, directionHelper)
          useDepthOfFieldStore.setState({ focusDistance: 50 + distance * 150, focusRange: distance * 0.1 + 0.01 })
          const rotateRight = Math.random() > 0.5
          frontWheels.forEach((wheel) => (wheel!.rotation.y = Math.random() - 0.5))
          yield* action({
            update: [
              offsetDistance(camera, point, 50 + distance * 500),
              offsetRotation(
                camera,
                point,
                quaternion.clone().premultiply(rotateRight ? startQuaternionOffset : endQuaternionoffset),
              ),
              lookAt(camera, point),
            ],
          })
          yield* action({
            update: [
              offsetRotation(
                camera,
                point,
                quaternion.clone().premultiply(rotateRight ? endQuaternionoffset : startQuaternionOffset),
                velocity(0.2 + Math.random() * 0.2),
              ),
              lookAt(camera, point),
            ],
          })
        })
      }
    },
    [camera],
  )
  useMemo(() => {
    // ⬇⬇⬇ All this is probably better fixed in Blender ...
    Object.values(nodes).forEach((node: any) => {
      if (node.isMesh) {
        // Fix glas, normals look messed up in the original, most likely deformed meshes bc of compression :/
        if (node.name.startsWith('glass')) node.geometry.computeVertexNormals()
        // Fix logo, too dark
        if (node.name === 'silver_001_BreakDiscs_0')
          node.material = applyProps(materials.BreakDiscs.clone(), { color: '#ddd' })
      }
    })
    // Fix windows, they have to be inset some more
    nodes['glass_003'].scale.setScalar(2.7)
    // Fix inner frame, too light
    applyProps(materials.FrameBlack, { metalness: 0.75, roughness: 0, color: 'black' })
    // Wheels, change color from chrome to black matte
    applyProps(materials.Chrome, { metalness: 1, roughness: 0, color: '#333' })
    applyProps(materials.BreakDiscs, { metalness: 0.2, roughness: 0.2, color: '#555' })
    applyProps(materials.TiresGum, { metalness: 0, roughness: 0.4, color: '#181818' })
    applyProps(materials.GreyElements, { metalness: 0, color: '#292929' })
    // Make front and tail LEDs emit light
    applyProps(materials.emitbrake, { emissiveIntensity: 4.5, toneMapped: false })
    applyProps(materials.LightsFrontLed, { emissiveIntensity: 3, toneMapped: false }) // Paint, from yellow to black
    ;(nodes.yellow_WhiteCar_0 as THREE.Mesh).material = new THREE.MeshPhysicalMaterial({
      roughness: 0.3,
      metalness: 0.05,
      color: '#111',
      envMapIntensity: 0.75,
      clearcoatRoughness: 0,
      clearcoat: 1,
    })
  }, [nodes, materials])
  return (
    <>
      <primitive object={scene} {...props} />
    </>
  )
}
