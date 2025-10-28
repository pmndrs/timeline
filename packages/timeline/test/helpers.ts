export function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export async function flushMicrotasks(times = 3) {
  for (let i = 0; i < times; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve()
  }
}

export function step(update: (state: any, delta: number) => void, frames = 1, delta = 1 / 60, state: any = {}) {
  for (let i = 0; i < frames; i++) {
    update(state, delta)
  }
}

export function sleep(ms = 0) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function waitForSetup() {
  // let startAsync progress to the first action yield and register updates
  await flushMicrotasks(2)
  await sleep(0)
}

export async function waitForCleanup() {
  // allow abort events to dispatch and for async loops to settle
  await flushMicrotasks(2)
  await sleep(0)
}
