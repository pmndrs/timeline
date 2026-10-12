import { GraphTimelineStateMap, graph } from '@pmndrs/timeline'
import { RootState } from '@react-three/fiber'
import { useRunTimeline } from './run.js'

/**
 * @deprecated use useRunTimeline instead
 */
export const useTimeline = useRunTimeline

/**
 * @deprecated use <GraphTimeline> instead
 */
export function useTimelineGraph(
  initialStateName: string,
  stateMap: GraphTimelineStateMap<RootState>,
  deps: Array<any>,
) {
  useRunTimeline(() => graph(initialStateName, stateMap), deps)
}
