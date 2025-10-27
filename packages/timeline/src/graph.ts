import { action } from './action.js'
import { abortSignalToPromise, forever, type ReusableTimeline, type TimelineYieldActionUpdate } from './index.js'
import { parallel } from './parallel.js'
import { scope } from './scope.js'

export async function* IdleTimeline() {
  await new Promise(() => {})
}

export type GraphStateTransition<T> = {
  /**
   * @deprecated use `whenUpdate` instead
   */
  when?: (...params: Parameters<TimelineYieldActionUpdate<T>>) => boolean
  whenPromise?: () => Promise<unknown>
  whenUpdate?: (...params: Parameters<TimelineYieldActionUpdate<T>>) => boolean
}

export type GraphStateTransitions<T, S extends string = string> = {
  [Key in S]?: GraphStateTransition<T>
} & { finally?: S }

export type GraphState<T, S extends string = string> = {
  timeline: ReusableTimeline<T, S | undefined | void>
  transitionTo?: GraphStateTransitions<T, S>
}

export type GraphStateMap<T, S = Record<string, unknown>> = { [Key in keyof S]: GraphState<T, keyof S & string> }

export class TimelineGraph<T> {
  private currentStateName: string
  /**
   * execute to restart the current state
   */
  private currentStateAbortController?: AbortController
  private running = false

  constructor(
    initialStateName: string,
    private readonly stateMap: GraphStateMap<T> = {},
  ) {
    this.currentStateName = initialStateName
  }

  addState(name: string, timeline: GraphState<T>['timeline'], transitionTo?: GraphState<T>['transitionTo']) {
    this.stateMap[name] = {
      timeline,
      transitionTo,
    }
    if (this.currentStateName != name) {
      return
    }
    this.currentStateAbortController?.abort()
  }

  removeState(name: string) {
    delete this.stateMap[name]
    if (this.currentStateName != name) {
      return
    }
    this.currentStateAbortController?.abort()
  }

  setState(name: string) {
    if (this.currentStateName === name) {
      return
    }
    this.currentStateName = name
    this.currentStateAbortController?.abort()
  }

  async *run() {
    const _this = this
    yield* scope(async function* (abortController) {
      if (_this.running) {
        throw new Error(`cannot execute .run multiple times in parallel`)
      }
      _this.running = true
      abortController.addEventListener('abort', () => (_this.running = false), { once: true })
      while (true) {
        const state = _this.stateMap[_this.currentStateName] ?? { timeline: IdleTimeline }
        const transitions: Array<ReusableTimeline<T>> = []
        if (state.transitionTo != null) {
          for (const [transitionStateName, transitionCondition] of Object.entries<
            GraphStateTransition<T> | string | undefined
          >(state.transitionTo)) {
            if (typeof transitionCondition != 'object') {
              continue
            }
            transitions.push(async function* () {
              const whenUpdate = transitionCondition.whenUpdate ?? transitionCondition.when
              const whenPromise = transitionCondition.whenPromise
              if (whenUpdate != null) {
                yield* action({ update: (state, clock) => !whenUpdate(state, clock) })
              } else if (whenPromise != null) {
                yield* action({ until: whenPromise() })
              } else {
                throw new Error(`transitions need either a whenPromise or whenUpdate condition`)
              }
              _this.currentStateName = transitionStateName
            })
          }
        }
        _this.currentStateAbortController = new AbortController()
        yield* parallel(
          'race',
          ...transitions,
          //restart the current state
          action({ until: abortSignalToPromise(_this.currentStateAbortController.signal) }),
          async function* () {
            const newState = yield* state.timeline()
            if (state.transitionTo?.finally != null) {
              _this.currentStateName = state.transitionTo.finally
              return
            }
            if (newState != null) {
              _this.currentStateName = newState
              return
            }
            //if nothing is set for finally, we just do nothing
            await forever()
          },
        )
      }
    })
  }
}

/**
 * timeline function for building a state graph with transitions as edges
 * @param initialStateName is the name of the initial state
 * @param stateMap is the map of states including their transitions to other states
 */
export async function* graph<T, S extends object>(initialStateName: keyof S, stateMap: GraphStateMap<T, S>) {
  const graph = new TimelineGraph<T>(initialStateName as string, stateMap)
  yield* graph.run()
}
