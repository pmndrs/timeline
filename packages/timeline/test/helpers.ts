import { action } from '../src/index.js'

/**
 * an action that logs its name in its only update
 */
export function oneTick(log: Array<string>, name: string) {
  return action({
    update: () => {
      log.push(name)
      return false
    },
  })
}

export function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * lets promise reactions run, as the event loop does between two frames
 */
export function nextMacrotask() {
  return new Promise((resolve) => setTimeout(resolve))
}
