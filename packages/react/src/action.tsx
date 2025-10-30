import { ActionParams, action } from '@pmndrs/timeline'
import { RootState } from '@react-three/fiber'
import { useMemo } from 'react'
import { useAttachTimeline } from './attachable.js'

export function Action({
  dependencies,
  ...params
}: { dependencies?: Array<unknown>; until?: () => Promise<unknown> } & Omit<ActionParams<RootState>, 'until'>) {
  const paramsWithoutDeps = useMemo<{ until?: () => Promise<unknown> } & Omit<ActionParams<RootState>, 'until'>>(
    () => ({}),
    [],
  )
  //if we have no dependencies, we re-write the params so that the are available when the action is (re-)started
  //if we have depdendencies, we re-attach the raw input params when they change
  if (dependencies == null) {
    for (const key in paramsWithoutDeps) {
      delete paramsWithoutDeps[key as keyof typeof paramsWithoutDeps]
    }
    Object.assign(paramsWithoutDeps, params)
  }
  useAttachTimeline(
    () =>
      action(
        dependencies == null
          ? { init: paramsWithoutDeps.init, until: paramsWithoutDeps.until?.(), update: paramsWithoutDeps.update }
          : { init: params.init, until: params.until?.(), update: params.update },
      ),
    dependencies ?? [],
  )
  return null
}
