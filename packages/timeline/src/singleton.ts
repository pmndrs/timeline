import type { NonReuseableTimeline } from './index.js'

/**
 * assures that .run cannot executed multiple times in parallel
 */
export abstract class Singleton<T = unknown> {
  private running = false
  protected abstract unsafeRun(): NonReuseableTimeline<T>
  *run(): NonReuseableTimeline<T> {
    if (this.running) {
      throw new Error(`cannot execute .run multiple times in parallel`)
    }
    this.running = true
    try {
      yield* this.unsafeRun()
    } finally {
      this.running = false
    }
  }
}
