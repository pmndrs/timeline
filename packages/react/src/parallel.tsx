import { ParallelTimeline } from '@pmndrs/timeline'
import { RootState } from '@react-three/fiber'
import { forwardRef, ReactNode, useImperativeHandle, useMemo } from 'react'
import { AttachableProvider, useAttachTimeline } from './attachable.js'

export const Parallel = forwardRef<ParallelTimeline<RootState>, { children?: ReactNode; type: 'all' | 'race' }>(
  ({ type, children }, ref) => {
    const parallel = useMemo(() => new ParallelTimeline(type), [type])
    useAttachTimeline(() => parallel.run(), [parallel])
    useImperativeHandle(ref, () => parallel, [parallel])
    return <AttachableProvider attachable={parallel}>{children}</AttachableProvider>
  },
)
