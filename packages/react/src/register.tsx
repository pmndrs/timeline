import { globalRegister, ReusableTimeline, TimelineRegister } from '@pmndrs/timeline'
import { RootState } from '@react-three/fiber'
import { createContext, ReactNode, useContext, useEffect } from 'react'

const TimelineRegisterContext = createContext(globalRegister as TimelineRegister<RootState>)

export function useTimelineRegister(): TimelineRegister<RootState> {
  return useContext(TimelineRegisterContext)
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

export function useRegisterTimeline(name: string, timeline: ReusableTimeline<RootState>, deps: Array<any>): void {
  const register = useTimelineRegister()
  useEffect(() => {
    register.set(name, timeline)
    return () => register.unset(name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, register, ...deps])
}
