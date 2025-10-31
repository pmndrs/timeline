import { abortable } from './abortable.js'
import { TimelineFallbacks, type NonReuseableTimeline, type ReusableTimeline } from './index.js'

export class ReplacableTimeline<T = unknown> {
  private restartControllers = new Set<AbortController>()
  private cancelControllers = new Set<AbortController>()

  private currentTimeline: ReusableTimeline<T>
  private isAttached = false

  constructor(private readonly fallback: ReusableTimeline<T> = TimelineFallbacks.Idle) {
    this.currentTimeline = fallback
  }

  attach(timeline: ReusableTimeline<T>): void {
    if (this.isAttached) {
      throw new Error(`cannot attach to a timeline that has a already another timeline attached`)
    }
    this.isAttached = true
    this.currentTimeline = timeline
    this.restart()
  }

  unattach(): void {
    if (!this.isAttached) {
      return
    }
    this.isAttached = false
    this.currentTimeline = this.fallback
    this.restart()
  }

  private restart() {
    for (const controller of this.restartControllers) {
      controller.abort()
    }
    this.cancelControllers.clear()
    this.restartControllers.clear()
  }

  cancel() {
    for (const controller of this.cancelControllers) {
      controller.abort()
    }
    this.cancelControllers.clear()
    this.restartControllers.clear()
  }

  async *run(): NonReuseableTimeline<T> {
    let restartController: AbortController
    do {
      restartController = new AbortController()
      this.restartControllers.add(restartController)
      const cancelController = new AbortController()
      this.cancelControllers.add(cancelController)
      yield* abortable(this.currentTimeline, AbortSignal.any([restartController.signal, cancelController.signal]))
      this.restartControllers.delete(restartController)
      //if we arrive at the while condition without beeing aborted, that means the current timeline successfully finished, or the canceController was called
    } while (restartController.signal.aborted)
  }
}
