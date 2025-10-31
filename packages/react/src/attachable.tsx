import { createContext, ReactNode, useContext, useEffect } from 'react'
import type { ReusableTimeline } from '@pmndrs/timeline'
import type { RootState } from '@react-three/fiber'

export type Attachable = {
  attach(timeline: ReusableTimeline<RootState>): void
  unattach(timeline: ReusableTimeline<RootState>): void
}

const AttachableContext = createContext<Attachable | undefined>(undefined)

export function AttachableProvider({ attachable, children }: { children?: ReactNode; attachable: Attachable }) {
  return <AttachableContext.Provider value={attachable}>{children}</AttachableContext.Provider>
}

export function useAttachTimeline(timeline: ReusableTimeline<RootState>, deps: Array<any>) {
  const attachable = useContext(AttachableContext)
  if (attachable == null) {
    throw new Error(`No attachable timeline context available to attach the timeline to.`)
  }
  useEffect(() => {
    attachable.attach(timeline)
    return () => attachable.unattach(timeline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachable, ...deps])
}
