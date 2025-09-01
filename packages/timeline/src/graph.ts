import { action, forever, parallel, type ReusableTimeline, type ActionUpdate } from './index.js'

export type StateTransition<T> = {
  /**
   * @deprecated use `whenUpdate` instead
   */
  when?: (...params: Parameters<ActionUpdate<T>>) => boolean
  whenPromise?: () => Promise<unknown>
  whenUpdate?: (...params: Parameters<ActionUpdate<T>>) => boolean
}

export type StateTransitions<T, S extends string> = {
  [Key in S]?: StateTransition<T>
}

export type State<T, S extends string> = {
  timeline: ReusableTimeline<T, S | undefined | void>
  transitionTo?: StateTransitions<T, S> & { finally?: S }
}

export type StateMap<T, S> = { [Key in keyof S]: State<T, keyof S & string> }

/**
 * timeline function for building a state graph with transitions as edges
 * @param initialStateName is the name of the initial state
 * @param stateMap is the map of states including their transitions to other states
 */
export async function* graph<T, S extends object>(initialStateName: keyof S, stateMap: StateMap<T, S>) {
  let stateName = initialStateName
  while (true) {
    const state = stateMap[stateName]
    const transitions: Array<ReusableTimeline<T>> =
      state.transitionTo == null
        ? []
        : Object.entries<StateTransition<T> | (keyof S & string)>(state.transitionTo)
            .filter((entries): entries is [keyof S & string, StateTransition<T>] => typeof entries[1] === 'object')
            .map(
              ([transitionStateName, transitionCondition]) =>
                async function* () {
                  const whenUpdate = transitionCondition.whenUpdate ?? transitionCondition.when
                  const whenPromise = transitionCondition.whenPromise
                  if (whenUpdate != null) {
                    yield* action({ update: (state, clock) => !whenUpdate(state, clock) })
                  } else if (whenPromise != null) {
                    yield* action({ until: whenPromise() })
                  } else {
                    throw new Error(`transitions need either a whenPromise or whenUpdate condition`)
                  }
                  stateName = transitionStateName
                },
            )
    yield* parallel('race', ...transitions, async function* () {
      const newState = yield* state.timeline()
      if (state.transitionTo?.finally != null) {
        stateName = state.transitionTo.finally
        return
      }
      if (newState != null) {
        stateName = newState
        return
      }
      //if nothing is set for finally, we just do nothing
      await forever()
    })
  }
}
