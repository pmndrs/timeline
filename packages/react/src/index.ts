import { ReusableTimeline, GraphStateMap, start, graph } from '@pmndrs/timeline'
import { RootState, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

/**
 * hook for running the specified timeline
 * @param deps tells the hook when to stop the previous timeline and restart the currently provided timeline
 */
export function useTimeline(timeline: ReusableTimeline<RootState>, deps: Array<any>): void {
  const updateRef = useRef<(state: RootState, delta: number) => void>(null)
  useEffect(() => {
    const abortController = new AbortController()
    const update = start(timeline(), abortController.signal)
    updateRef.current = update
    return () => {
      abortController.abort()
      updateRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useFrame((state, delta) => updateRef.current?.(state, delta))
}

/**
 * wrapper hook for building a timeline using a graph with
 * @param initialState
 * @param stateMap containing states and transitions
 * @param deps to inform the hook when to stop the previous graph and start the currently provided graph
 */
export function useTimelineGraph<S extends object>(
  initialStateName: keyof S,
  stateMap: GraphStateMap<RootState, S>,
  deps: Array<any>,
) {
  useTimeline(() => graph(initialStateName, stateMap), deps)
}

export * from '@pmndrs/timeline'
