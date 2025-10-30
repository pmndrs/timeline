import { QueueTimeline } from '@pmndrs/timeline'
import { forwardRef, useImperativeHandle, useMemo } from 'react'

export const Queue = forwardRef<QueueTimeline, {}>((_, ref) => {
  const queue = useMemo(() => new QueueTimeline(), [])
  useImperativeHandle(ref, () => queue, [queue])
  return null
})
