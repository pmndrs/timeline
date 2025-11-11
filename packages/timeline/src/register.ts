import { TimelineFallbacks } from './misc.js'
import { ReplacableTimeline } from './replaceable.js'
import type { ReusableTimeline, NonReuseableTimeline } from './index.js'

export class TimelineRegister<T = unknown, C extends {} = {}> {
  private readonly map = new Map<string, ReplacableTimeline<T, C>>()

  constructor(private readonly fallbackTimeline = TimelineFallbacks.Idle) {}

  attach(name: string, timeline: ReusableTimeline<T, C>): void {
    const entry = this.map.get(name)
    if (entry == null) {
      this.map.set(name, new ReplacableTimeline(timeline))
      return
    }
    entry.attach(timeline)
  }

  unattach(name: string) {
    this.map.get(name)?.unattach()
  }

  run(name: string): NonReuseableTimeline<T, C> {
    let entry = this.map.get(name)
    if (entry == null) {
      this.map.set(name, (entry = new ReplacableTimeline(this.fallbackTimeline)))
    }
    return entry.run()
  }
}

export const globalRegister = new TimelineRegister()
