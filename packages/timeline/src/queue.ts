import { NonReuseableTimeline, ReusableTimeline, Singleton } from './index.js'

export class QueueTimeline<T = unknown, C extends {} = {}> extends Singleton<T, C> {
  private readonly entries: Array<ReusableTimeline<T, C>> = []
  private readonly notEmptyListeners: Array<() => void> = []

  get length(): number {
    return this.entries.length
  }

  constructor() {
    super()
  }

  attach(timeline: ReusableTimeline<T, C>, index = Infinity): void {
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

  protected async *unsafeRun(): NonReuseableTimeline<T, C> {
    let entry: ReusableTimeline<T, C> | undefined
    while ((entry = this.entries.shift()) != null) {
      yield* entry()
    }
  }
}
