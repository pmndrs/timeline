import { ReplacableTimeline, ReusableTimeline, runTimeline, SynchronousAbortController } from '@pmndrs/timeline'
import { RootState, useFrame } from '@react-three/fiber'
import { ReactNode, useEffect, useMemo, useRef } from 'react'
import { AttachableProvider } from './attachable.js'

export function useRunTimeline<T extends ReusableTimeline<RootState, any>>(timeline: T, deps: Array<any>) {
  const updateRef = useRef<(state: RootState, delta: number) => void>(null)
  useEffect(() => {
    const abortController = new SynchronousAbortController()
    const update = runTimeline(timeline(), abortController.signal)
    updateRef.current = update
    return () => {
      abortController.abort()
      updateRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useFrame((state, delta) => updateRef.current?.(state, delta))
}

export function RunTimeline({ children }: { children?: ReactNode }) {
  const replaceable = useMemo(() => new ReplacableTimeline(), [])
  useRunTimeline(() => replaceable.run(), [])
  return <AttachableProvider attachable={replaceable}>{children}</AttachableProvider>
}
