import { GraphTimeline, GraphTimelineStateTransitions, ReplacableTimeline } from '@pmndrs/timeline'
import { RootState } from '@react-three/fiber'
import { createContext, forwardRef, ReactNode, useContext, useEffect, useImperativeHandle, useMemo } from 'react'
import { AttachableProvider, useAttachTimeline } from './attachable.js'

const GrapthContext = createContext<GraphTimeline<RootState> | undefined>(undefined)

export const Graph = forwardRef<
  GraphTimeline<RootState>,
  { enterState: string; exitState?: string; children?: ReactNode }
>(({ enterState, exitState, children }, ref) => {
  const graph = useMemo(() => new GraphTimeline<RootState>(''), [])
  graph.enterState = enterState
  graph.exitState = exitState
  useAttachTimeline(() => graph.run(), [])
  useImperativeHandle(ref, () => graph, [graph])
  return <GrapthContext.Provider value={graph}>{children}</GrapthContext.Provider>
})

export function GrapthState({
  name,
  transitionsTo,
  children,
  dependencies,
}: {
  name: string
  transitionsTo: GraphTimelineStateTransitions<RootState>
  children?: ReactNode
  dependencies?: Array<unknown>
}) {
  const graph = useContext(GrapthContext)
  if (graph == null) {
    throw new Error(`GrapthState can only be used inside the Graph component.`)
  }
  const replacable = useMemo(() => new ReplacableTimeline(), [])
  const transitionsWithoutDeps = useMemo<GraphTimelineStateTransitions<RootState>>(() => ({}), [])
  //if we have no dependencies, we re-write the transitions so that the are available when the graph state is (re-)started
  //if we have depdendencies, we re-attach the raw input transitions when they change
  if (dependencies == null) {
    for (const key in transitionsWithoutDeps) {
      delete transitionsWithoutDeps[key as keyof typeof transitionsWithoutDeps]
    }
    Object.assign(transitionsWithoutDeps, transitionsTo)
  }
  useEffect(() => {
    graph.attach(name, () => replacable.run(), dependencies == null ? transitionsWithoutDeps : transitionsTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, name, ...(dependencies ?? [])])
  return <AttachableProvider attachable={replacable}>{children}</AttachableProvider>
}
