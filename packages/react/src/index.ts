import { ReusableTimeline, StateMap, build, graph } from '@pmndrs/timeline'
import { RootState, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

export function useTimeline(timeline: ReusableTimeline<RootState>, deps: Array<any>): void {
  const updateRef = useRef<(state: RootState, delta: number) => void>(null)
  useEffect(() => {
    const abortController = new AbortController()
    const update = build(timeline(), abortController.signal)
    updateRef.current = update
    return () => {
      abortController.abort()
      updateRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useFrame((state, delta) => updateRef.current?.(state, delta))
}

export function useTimelineGraph<S extends object>(
  initialStateName: keyof S,
  stateMap: StateMap<RootState, S>,
  deps: Array<any>,
) {
  useTimeline(() => graph(initialStateName, stateMap), deps)
}

export * from '@pmndrs/timeline'
