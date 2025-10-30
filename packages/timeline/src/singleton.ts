import { type NonReuseableTimeline } from './index.js'
import { scope } from './scope.js'

/**
 * assures that .run cannot executed multiple times in parallel
 */
export abstract class Singleton<T> {
  private running = false
  protected abstract unsafeRun(): NonReuseableTimeline<T>
  async *run(): NonReuseableTimeline<T> {
    const _this = this
    yield* scope(async function* (signal) {
      if (signal.aborted) {
        return
      }
      if (_this.running) {
        throw new Error(`cannot execute .run multiple times in parallel`)
      }
      _this.running = true
      signal.addEventListener('abort', () => (_this.running = false), { once: true })
      yield* _this.unsafeRun()
    })
  }
}
