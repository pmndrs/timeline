import { ReusableTimeline, scope } from './index.js'

export class QueueTimeline<T = unknown> {
  private readonly entries: Array<ReusableTimeline<T>> = []
  private readonly notEmptyListeners: Array<() => void> = []
  private running = false

  get length(): number {
    return this.entries.length
  }

  constructor() {}

  /**
   * runs until the timeline is empty
   */
  async *run() {
    const _this = this
    scope(async function* (abortController) {
      if (_this.running) {
        throw new Error(`cannot execute .run multiple times in parallel`)
      }
      _this.running = true
      abortController.addEventListener('abort', () => (_this.running = false), { once: true })
      let entry: ReusableTimeline<T> | undefined
      while ((entry = _this.entries.shift()) != null) {
        yield* entry()
      }
    })
  }

  attach(timeline: ReusableTimeline<T>, index = Infinity): void {
    const wasEmpty = this.entries.length === 0
    index = Math.max(0, Math.min(this.entries.length, Math.floor(index)))
    this.entries.splice(index, 0, timeline)
    if (!wasEmpty) {
      return
    }
    for (const listener of this.notEmptyListeners) {
      listener()
    }
    this.notEmptyListeners.length = 0
  }

  clear(): void {
    this.entries.length = 0
  }

  waitUntilNotEmpty(): Promise<void> {
    if (this.entries.length > 0) {
      return Promise.resolve()
    }
    return new Promise((resolve) => this.notEmptyListeners.push(resolve))
  }
}
