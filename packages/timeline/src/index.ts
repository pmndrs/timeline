export type TimelineClock = {
  delta: number
  prevDelta: number | undefined
  /**
   * index of the current update, starting at 0
   * `runTimeline` increments it once per update; code that calls `TimelineRunner.step` with its own clock must do the same,
   * otherwise finished motions (`transition`, `lookAt`, `offset*`) never hand their momentum to the next action
   */
  frame: number
}

/**
 * what an action reports after receiving a frame
 * - `running`: the action used the frame and continues
 * - `finished`: the action used the frame and is done
 * - `skipped`: the action was already done when the frame started, so the frame passes on to the next action
 */
export type ActionStatus = 'running' | 'finished' | 'skipped'

/**
 * the value a timeline yields: steps the current action by one frame
 */
export type TimelineYield<T = unknown> = (state: T, clock: TimelineClock) => ActionStatus

export type Timeline<T = unknown, R = void> = ReusableTimeline<T, R> | NonReuseableTimeline<T, R>

export type ReusableTimeline<T = unknown, R = void> = () => NonReuseableTimeline<T, R>

export type NonReuseableTimeline<T = unknown, R = void> = Generator<TimelineYield<T>, R, unknown>

export type Update<T> = (state: T, delta: number) => void

export * from './abort.js'
export * from './runner.js'
export * from './misc.js'
export * from './graph.js'
export * from './look-at.js'
export * from './offset.js'
export * from './ease.js'
export * from './transition.js'
export * from './replaceable.js'
export * from './previous.js'
export * from './parallel.js'
export * from './queue.js'
export * from './action.js'
export * from './scope.js'
export * from './abortable.js'
export * from './sequential.js'
export * from './singleton.js'
export * from './switch.js'
export * from './register.js'
