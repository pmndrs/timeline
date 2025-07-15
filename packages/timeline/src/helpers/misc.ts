import { AnimationAction, AnimationMixer } from 'three'

export function duration(time: number, unit: 'seconds' | 'milliseconds'): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, unit === 'seconds' ? time * 1000 : time))
}

export function mediaFinished(media: HTMLAudioElement | HTMLVideoElement) {
  if (media.ended) {
    return Promise.resolve<unknown>(undefined)
  }
  return new Promise<unknown>((resolve) => media.addEventListener('ended', resolve, { once: true }))
}

export function animationFinished(mixer: AnimationMixer, animation: AnimationAction): Promise<void> {
  return new Promise<void>((resolve) => {
    const listener = ({ action }: { action: AnimationAction }) => {
      if (action != animation) {
        return
      }
      mixer.removeEventListener('finished', listener)
      resolve()
    }
    mixer.addEventListener('finished', listener)
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
