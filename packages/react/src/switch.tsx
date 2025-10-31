import { SwitchTimelineCaseCondition, SwitchTimeline } from '@pmndrs/timeline'
import { RootState } from '@react-three/fiber'
import { createContext, forwardRef, ReactNode, useContext, useImperativeHandle, useMemo, useRef } from 'react'
import { Attachable, AttachableProvider, useAttachTimeline } from './attachable.js'

export const SwitchContext = createContext<SwitchTimeline<RootState> | undefined>(undefined)

export const Switch = forwardRef<SwitchTimeline<RootState>, { children?: ReactNode }>(({ children }, ref) => {
  const _switch = useMemo(() => new SwitchTimeline<RootState>(), [])
  useImperativeHandle(ref, () => _switch, [_switch])
  useAttachTimeline(() => _switch.run(), [_switch])
  return <SwitchContext.Provider value={_switch}>{children}</SwitchContext.Provider>
})

export function SwitchCase({
  index,
  condition,
  children,
}: {
  index: number
  condition?: SwitchTimelineCaseCondition<RootState>
  children?: ReactNode
}) {
  const _switch = useContext(SwitchContext)
  if (_switch == null) {
    throw new Error(`SwitchCase can only be used inside the Switch component.`)
  }
  const conditionRef = useRef(condition)
  conditionRef.current = condition
  const attachable = useMemo<Attachable>(
    () => ({
      attach: (timeline) => _switch.attach(index, (...params) => conditionRef.current?.(...params) ?? true, timeline),
      unattach: () => _switch.unattach(index),
    }),
    [_switch, index],
  )
  return <AttachableProvider attachable={attachable}>{children}</AttachableProvider>
}
