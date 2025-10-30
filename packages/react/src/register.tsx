import { ReplacableTimeline, globalRegister, ReusableTimeline, TimelineRegister } from '@pmndrs/timeline'
import { RootState } from '@react-three/fiber'
import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react'
import { AttachableProvider, useAttachTimeline } from './attachable.js'

const TimelineRegisterContext = createContext(globalRegister as TimelineRegister<RootState>)

export function useTimelineRegister(): TimelineRegister<RootState> {
  return useContext(TimelineRegisterContext)
}

export function useRegisterTimeline(name: string, timeline: ReusableTimeline<RootState>, deps: Array<any>) {
  const register = useTimelineRegister()
  useEffect(() => {
    register.attach(name, timeline)
    return () => register.unattach(name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register, name, ...deps])
}

export function TimelineRegisterProvider({
  children,
  register,
}: {
  children?: ReactNode
  register: TimelineRegister<RootState>
}) {
  return <TimelineRegisterContext.Provider value={register}>{children}</TimelineRegisterContext.Provider>
}

export function RegisterTimeline({ name, children }: { name: string; children?: string }) {
  const attachable = useMemo(() => new ReplacableTimeline(), [])
  useRegisterTimeline(name, () => attachable.run(), [name])
  return <AttachableProvider attachable={attachable}>{children}</AttachableProvider>
}

export function RegisteredTimeline({ name }: { name: string }) {
  const register = useTimelineRegister()
  useAttachTimeline(() => register.run(name), [name, register])
  return null
}
