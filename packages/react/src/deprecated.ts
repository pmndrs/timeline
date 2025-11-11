import { GraphTimelineStateMap, NonReuseableTimeline, ReusableTimeline, graph } from '@pmndrs/timeline'
import { RootState } from '@react-three/fiber'
import { useRunTimeline } from './run.js'

/**
 * @deprecated use useRunTimeline instead
 */
export const useTimeline = useRunTimeline

/**
 * @deprecated use <GraphTimeline> instead
 */
export function useTimelineGraph<T extends ReusableTimeline<RootState, string | undefined | void>>(
  initialStateName: string,
  stateMap: GraphTimelineStateMap<T>,
  deps: Array<any>,
) {
  useRunTimeline(() => graph(initialStateName, stateMap) as NonReuseableTimeline<RootState, any>, deps)
}
