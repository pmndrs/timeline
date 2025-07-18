import { action, forever, parallel, type ActionUpdate, type Timeline } from '../index.js'

export type StateMap<T, S> = { [Key in keyof S]: State<T, keyof S & string> }

export async function* graph<T, S extends object>(initialStateName: keyof S, stateMap: StateMap<T, S>) {
  let stateName = initialStateName
  while (true) {
    const state = stateMap[stateName]
    const transitions: Array<Timeline<T>> =
      state.transitionTo == null
        ? []
        : Object.entries<StateTransition<T> | (keyof S & string)>(state.transitionTo)
            .filter((entries): entries is [keyof S & string, StateTransition<T>] => typeof entries[1] === 'object')
            .map(
              ([transitionStateName, transitionCondition]) =>
                async function* () {
                  const when = transitionCondition.when
                  yield* action(
                    typeof when === 'function'
                      ? { update: (state, clock, options) => !when(state, clock, options) }
                      : { until: when },
                  )
                  stateName = transitionStateName
                },
            )
    yield* parallel('race', ...transitions, async function* () {
      const newState = yield* typeof state.timeline == 'function' ? state.timeline() : state.timeline
      if (newState != null && state.transitionTo?.finally == null) {
        //if nothing is set for finally, we just do nothing
        await forever()
        //this return is just to make typescript happy but this poor return will never be called
        return
      }
      stateName = newState ?? state.transitionTo!.finally!
    })
  }
}

export type StateTransitions<T, S extends string> = {
  [Key in S]?: StateTransition<T>
}

export type StateTransition<T> = {
  when: Promise<unknown> | ActionUpdate<T>
}

export type State<T, S extends string> = {
  timeline: Timeline<T, S | undefined | void>
  transitionTo?: StateTransitions<T, S> & { finally?: S }
}
