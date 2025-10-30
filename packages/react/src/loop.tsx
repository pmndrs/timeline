import { ReplacableTimeline } from '@pmndrs/timeline'
import { ReactNode, useMemo } from 'react'
import { AttachableProvider, useAttachTimeline } from './attachable.js'

export function Loop({ children }: { children?: ReactNode }) {
  const replacable = useMemo(() => new ReplacableTimeline(), [])
  useAttachTimeline(async function* () {
    while (true) {
      yield* replacable.run()
    }
  }, [])
  return <AttachableProvider attachable={replacable}>{children}</AttachableProvider>
}
