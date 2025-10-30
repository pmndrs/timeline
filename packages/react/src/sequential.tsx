import { SequentialTimeline } from '@pmndrs/timeline'
import { RootState } from '@react-three/fiber'
import { createContext, forwardRef, ReactNode, useContext, useImperativeHandle, useMemo } from 'react'
import { Attachable, AttachableProvider, useAttachTimeline } from './attachable.js'

const SequentialContext = createContext<SequentialTimeline<RootState> | undefined>(undefined)

export const Sequential = forwardRef<SequentialTimeline<RootState>, { children?: ReactNode }>(({ children }, ref) => {
  const sequential = useMemo(() => new SequentialTimeline(), [])
  useImperativeHandle(ref, () => sequential, [sequential])
  useAttachTimeline(() => sequential.run(), [])
  return <SequentialContext.Provider value={sequential}>{children}</SequentialContext.Provider>
})

export function SequentialEntry({ index, children }: { index: number; children?: ReactNode }) {
  const sequential = useContext(SequentialContext)
  if (sequential == null) {
    throw new Error(`SequentialEntry can only be used inside the Sequential component.`)
  }
  const attachable = useMemo<Attachable>(
    () => ({
      attach: (timeline) => sequential.attach(index, timeline),
      unattach: () => sequential.unattach(index),
    }),
    [sequential, index],
  )
  return <AttachableProvider attachable={attachable}>{children}</AttachableProvider>
}
