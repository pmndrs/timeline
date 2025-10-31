import { QueueTimeline } from '@pmndrs/timeline'
import { forwardRef, useImperativeHandle, useMemo } from 'react'
import { useAttachTimeline } from './attachable.js'

export const Queue = forwardRef<QueueTimeline, {}>((_, ref) => {
  const queue = useMemo(() => new QueueTimeline(), [])
  useImperativeHandle(ref, () => queue, [queue])
  useAttachTimeline(() => queue.run(), [])
  return null
})
