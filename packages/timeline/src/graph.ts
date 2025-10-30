import { action, ActionUpdate } from './action.js'
import { type NonReuseableTimeline, type ReusableTimeline } from './index.js'
import { forever, TimelineFallbacks } from './misc.js'
import { parallel } from './parallel.js'
import { ReplacableTimeline } from './replaceable.js'
import { Singleton } from './singleton.js'

export type GraphTimelineStateTransition<T> = {
  /**
   * @deprecated use `whenUpdate` instead
   */
  when?: (...params: Parameters<ActionUpdate<T>>) => boolean
  whenPromise?: () => Promise<unknown>
  whenUpdate?: (...params: Parameters<ActionUpdate<T>>) => boolean
}

export type GraphTimelineStateTransitions<T> =
  | Record<string, GraphTimelineStateTransition<T>>
  | { finally?: string | (() => string) }

export type GraphTimelineState<T> = {
  timeline: ReusableTimeline<T, string | undefined | void>
  transitionTo?: GraphTimelineStateTransitions<T>
}

export type GraphTimelineStateMap<T> = {
  [key: string]: GraphTimelineState<T>
}

export class GraphTimeline<T> extends Singleton<T> {
  private currentState: string
  private stateMap = new Map<string, ReplacableTimeline<T>>()

  constructor(
    public enterState: string,
    states: GraphTimelineStateMap<T> = {},
    public exitState?: string,
    private readonly fallback: ReusableTimeline<T> = TimelineFallbacks.Idle,
    private readonly resetOnRun: boolean = true,
  ) {
    super()
    for (const [name, { timeline, transitionTo }] of Object.entries(states)) {
      this.attach(name, timeline, transitionTo)
    }
    this.currentState = enterState
  }

  attach(
    name: string,
    timeline: GraphTimelineState<T>['timeline'],
    transitionTo?: GraphTimelineState<T>['transitionTo'],
  ) {
    let entry = this.stateMap.get(name)
    if (entry == null) {
      this.stateMap.set(name, (entry = new ReplacableTimeline(this.fallback)))
    }
    const _this = this
    entry.attach(async function* () {
      let transitions: Array<NonReuseableTimeline<T>> = []
      if (transitionTo != null) {
        //the transitionsTo object is evaluated only at the start of a timeline, changing its content during the timeline has no effect
        transitions = Object.entries<GraphTimelineStateTransition<T> | string | (() => string)>(transitionTo)
          .filter((entry): entry is [string, GraphTimelineStateTransition<T>] => typeof entry[1] === 'object')
          .map(async function* ([name, condition]): NonReuseableTimeline<T> {
            const whenUpdate = condition.whenUpdate ?? condition.when
            const whenPromise = condition.whenPromise
            if (whenUpdate != null) {
              yield* action({ update: (...params) => !whenUpdate(...params) })
            } else if (whenPromise != null) {
              yield* action({ until: whenPromise() })
            } else {
              throw new Error(`transitions need either a whenPromise or whenUpdate condition`)
            }
            _this.currentState = name
          })
      }
      yield* parallel('race', ...transitions, async function* () {
        const newState = yield* timeline()
        const finalStateName = transitionTo?.finally
        if (finalStateName != null && typeof finalStateName != 'object') {
          _this.currentState = typeof finalStateName === 'function' ? finalStateName() : finalStateName
          return
        }
        if (newState != null) {
          _this.currentState = newState
          return
        }
        //if nothing is set for finally, we just do nothing
        yield* action({ until: forever() })
      })
    })
  }

  unattach(name: string) {
    this.stateMap.get(name)?.unattach()
  }

  setState(name: string) {
    if (this.currentState === name) {
      return
    }
    const oldStateName = this.currentState
    this.stateMap.get(oldStateName)?.cancel()
    this.currentState = name
  }

  protected async *unsafeRun() {
    if (this.resetOnRun) {
      this.currentState = this.enterState
    }
    while (this.currentState != this.exitState) {
      let entry = this.stateMap.get(this.currentState)
      if (entry == null) {
        this.stateMap.set(this.currentState, (entry = new ReplacableTimeline(this.fallback)))
      }
      yield* entry.run()
    }
  }
}

/**
 * timeline function for building a state graph with transitions as edges
 * @param enterStateName is the name of the initial state
 * @param stateMap is the map of states including their transitions to other states
 */
export async function* graph<T>(enterStateName: string, stateMap: GraphTimelineStateMap<T>, exitStateName?: string) {
  const graph = new GraphTimeline<T>(enterStateName, stateMap, exitStateName)
  yield* graph.run()
}
