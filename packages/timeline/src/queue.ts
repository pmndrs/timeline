// Import Singleton from its own module, not the barrel: queue.ts is re-exported by index.ts before
// singleton.ts, so a barrel import leaves Singleton undefined when QueueTimeline extends it.
import { Singleton } from './singleton.js'
import type { UntilCondition } from './action.js'
import type { NonReuseableTimeline, ReusableTimeline } from './index.js'

export class QueueTimeline<T = unknown> extends Singleton<T> {
  private readonly entries: Array<ReusableTimeline<T>> = []

  get length(): number {
    return this.entries.length
  }

  constructor() {
    super()
  }

  attach(timeline: ReusableTimeline<T>, index = Infinity): void {
    index = Math.max(0, Math.min(this.entries.length, Math.floor(index)))
    this.entries.splice(index, 0, timeline)
  }

  clear(): void {
    this.entries.length = 0
  }

  /**
   * action until condition that is met while the queue has entries
   */
  waitUntilNotEmpty(): UntilCondition<unknown> {
    return () => this.entries.length > 0
  }

  protected *unsafeRun(): NonReuseableTimeline<T> {
    let entry: ReusableTimeline<T> | undefined
    while ((entry = this.entries.shift()) != null) {
      yield* entry()
    }
  }
}
