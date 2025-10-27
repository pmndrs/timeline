import { abortable } from './abortable.js'
import type { NonReuseableTimeline, ReusableTimeline } from './index.js'

export const FallbackTimelines = {
  async *Error() {
    throw new Error('timeline not found')
  },
  async *Skip() {},
  async *Idle() {
    await new Promise(() => {})
  },
}

export class ReplaceableTimeline<T = unknown> {
  private currentTimelineChangeController = new Set<AbortController>()

  constructor(private currentTimeline: ReusableTimeline<T> = FallbackTimelines.Idle) {}

  set(timeline: ReusableTimeline<T>): void {
    this.currentTimeline = timeline
    for (const controller of this.currentTimelineChangeController) {
      controller.abort()
    }
    this.currentTimelineChangeController.clear()
  }

  async *get(): NonReuseableTimeline<T> {
    let controller: AbortController
    do {
      controller = new AbortController()
      this.currentTimelineChangeController.add(controller)
      yield* abortable(this.currentTimeline, controller.signal)
      this.currentTimelineChangeController.delete(controller)
    } while (controller.signal.aborted)
  }
}

export class TimelineRegister<T = unknown> {
  private readonly map = new Map<string, { replacable: ReplaceableTimeline<T>; fallbackActive: boolean }>()

  constructor(private readonly fallbackTimeline = FallbackTimelines.Idle) {}

  unset(name: string) {
    const entry = this.map.get(name)
    if (entry == null || entry.fallbackActive) {
      return
    }
    entry.fallbackActive = true
    entry.replacable.set(this.fallbackTimeline)
  }

  set(name: string, timeline: ReusableTimeline<T>): void {
    const entry = this.map.get(name)
    if (entry == null) {
      this.map.set(name, { fallbackActive: false, replacable: new ReplaceableTimeline(timeline) })
      return
    }
    if (!entry.fallbackActive) {
      throw new Error(`there's already an timeline set for the name '${name}'`)
    }
    entry.fallbackActive = false
    entry.replacable.set(timeline ?? this.fallbackTimeline)
  }
  get(name: string): NonReuseableTimeline<T> {
    let entry = this.map.get(name)
    if (entry == null) {
      this.map.set(name, (entry = { fallbackActive: true, replacable: new ReplaceableTimeline(this.fallbackTimeline) }))
    }
    return entry.replacable.get()
  }
}

export const globalRegister = new TimelineRegister()
