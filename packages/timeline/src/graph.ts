import { action, forever, parallel, type ReusableTimeline, type ActionUpdate } from './index.js'

export type StateTransition<T> = {
  when: Promise<unknown> | ((...params: Parameters<ActionUpdate<T>>) => boolean)
}

export type StateTransitions<T, S extends string> = {
  [Key in S]?: StateTransition<T>
}

export type State<T, S extends string> = {
  timeline: ReusableTimeline<T, S | undefined | void>
  transitionTo?: StateTransitions<T, S> & { finally?: S }
}

export type StateMap<T, S> = { [Key in keyof S]: State<T, keyof S & string> }

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
                  const when = transitionCondition.when
                  yield* action(
                    typeof when === 'function' ? { update: (state, clock) => !when(state, clock) } : { until: when },
                  )
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
