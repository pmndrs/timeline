import { action, ActionUpdate } from './action.js'
import {
  GetTimelineContext,
  GetTimelineState,
  Timeline,
  type NonReuseableTimeline,
  type ReusableTimeline,
} from './index.js'
import { forever, TimelineFallbacks } from './misc.js'
import { parallel } from './parallel.js'
import { ReplacableTimeline } from './replaceable.js'
import { Singleton } from './singleton.js'

export type GraphTimelineStateTransition<T = unknown> = {
  /**
   * @deprecated use `whenUpdate` instead
   */
  when?: (...params: Parameters<ActionUpdate<T>>) => boolean
  whenPromise?: () => Promise<unknown>
  whenUpdate?: (...params: Parameters<ActionUpdate<T>>) => boolean
}

export type GraphTimelineStateTransitions<T = unknown> =
  | Record<string, GraphTimelineStateTransition<T>>
  | { finally?: string | (() => string) }

export type GraphTimelineState<T extends ReusableTimeline<any, any, string | undefined | void>> = {
  timeline: T
  transitionTo?: GraphTimelineStateTransitions<GetTimelineState<T>>
}

export type GraphTimelineStateMap<T extends ReusableTimeline<any, any, string | undefined | void>> = {
  [key: string]: GraphTimelineState<T>
}

export class GraphTimeline<T = unknown, C extends {} = {}> extends Singleton<T, C> {
  private currentState: string
  private stateMap = new Map<string, ReplacableTimeline<T, C>>()

  constructor(
    public enterState: string,
    states: GraphTimelineStateMap<ReusableTimeline<T, C, string | undefined | void>> = {},
    public exitState?: string,
    private readonly fallback: ReusableTimeline<T, C> = TimelineFallbacks.Idle,
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
    timeline: GraphTimelineState<ReusableTimeline<T, C, string | undefined | void>>['timeline'],
    transitionTo?: GraphTimelineState<ReusableTimeline<T, C, string | undefined | void>>['transitionTo'],
  ) {
    let entry = this.stateMap.get(name)
    if (entry == null) {
      this.stateMap.set(name, (entry = new ReplacableTimeline(this.fallback)))
    }
    const _this = this
    entry.attach(async function* () {
      let transitions: Array<NonReuseableTimeline<T, C>> = []
      if (transitionTo != null) {
        //the transitionTo object is evaluated only at the start of a timeline, changing its content during the timeline has no effect
        transitions = Object.entries<GraphTimelineStateTransition<T> | string | (() => string)>(transitionTo)
          .filter((entry): entry is [string, GraphTimelineStateTransition<T>] => typeof entry[1] === 'object')
          .map(async function* ([name, condition]): NonReuseableTimeline<T, C> {
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
      yield* parallel<Timeline<T, C>>('race', ...transitions, async function* () {
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
export async function* graph<T extends ReusableTimeline<any, any, string | undefined | void>>(
  enterStateName: string,
  stateMap: GraphTimelineStateMap<T>,
  exitStateName?: string,
) {
  const graph = new GraphTimeline<GetTimelineState<T>, GetTimelineContext<T>>(enterStateName, stateMap, exitStateName)
  yield* graph.run()
}
