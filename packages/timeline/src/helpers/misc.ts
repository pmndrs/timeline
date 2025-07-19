import { AnimationAction } from 'three'
import { action, parallel, type ReusableTimeline, type ActionUpdate } from '../index.js'

export function timePassed(time: number, unit: 'seconds' | 'milliseconds'): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, unit === 'seconds' ? time * 1000 : time))
}

export function mediaFinished(media: HTMLAudioElement | HTMLVideoElement) {
  if (media.ended) {
    return Promise.resolve<unknown>(undefined)
  }
  return new Promise<unknown>((resolve) => media.addEventListener('ended', resolve, { once: true }))
}

export function animationFinished(animation: AnimationAction): Promise<void> {
  return new Promise<void>((resolve) => {
    const listener = ({ action }: { action: AnimationAction }) => {
      if (action != animation) {
        return
      }
      animation.getMixer().removeEventListener('finished', listener)
      resolve()
    }
    animation.getMixer().addEventListener('finished', listener)
  })
}

export function forever() {
  return new Promise(() => {})
}

export async function promiseConcat(promises: Array<Promise<unknown>>): Promise<void> {
  for (const promise of promises) {
    await promise
  }
}

export async function doUntil<T>(promise: Promise<unknown>, timeline: ReusableTimeline<T>) {
  return parallel('race', action({ until: promise }), async function* () {
    while (true) {
      yield* timeline()
    }
  })
}

export async function* doWhile<T>(
  update: (...params: Parameters<ActionUpdate<T>>) => boolean,
  timeline: ReusableTimeline<T>,
) {
  return parallel('race', action({ update }), async function* () {
    while (true) {
      yield* timeline()
    }
  })
}
