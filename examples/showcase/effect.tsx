import { useLoader, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, LUT, DepthOfField, Vignette } from '@react-three/postprocessing'
import { LUTCubeLoader } from 'postprocessing'
import { Suspense } from 'react'
import { Texture } from 'three'
import { create } from 'zustand'

export const useDepthOfFieldStore = create(() => ({ focusDistance: 200, focusRange: 0.05 }))

export function Effects() {
  const texture = useLoader(LUTCubeLoader, '/F-6800-STD.cube') as Texture
  const { focusDistance, focusRange } = useDepthOfFieldStore()
  const camera = useThree((s) => s.camera)
  return (
    <Suspense fallback={null}>
      <EffectComposer multisampling={1}>
        <DepthOfField
          focusDistance={(focusDistance - camera.near) / (camera.far - camera.near)}
          focusRange={focusRange}
          focalLength={0.02}
          bokehScale={5}
        />
        <Bloom luminanceThreshold={0.9} mipmapBlur luminanceSmoothing={0} intensity={1} />
        <LUT lut={texture} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </Suspense>
  )
}
