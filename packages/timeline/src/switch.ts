import { abortable, action, ActionUpdate, parallel, type NonReuseableTimeline, type ReusableTimeline } from './index.js'

export type SwitchTimelineCase<T> = {
  /**
   * leaving the condition empty means this is the default case
   */
  condition?: SwitchTimelineCaseCondition<T>
  timeline: ReusableTimeline<T>
}
export type SwitchTimelineCaseCondition<T> = (...params: Parameters<ActionUpdate<T>>) => boolean

export class SwitchTimeline<T> {
  constructor(private readonly cases: Array<SwitchTimelineCase<T> | undefined> = []) {}

  attach(index: number, condition: SwitchTimelineCaseCondition<T>, timeline: ReusableTimeline<T>) {
    if (this.cases[index] != null) {
      throw new Error(`cannot attach to case "${index}" that has a already another timeline attached`)
    }
    this.cases[index] = { condition, timeline }
  }

  unattach(index: number) {
    //no need to cancel the case timeline because the update will cancel it either way
    delete this.cases[index]
  }

  async *run(): NonReuseableTimeline<T> {
    let restartController = new AbortController()
    let caseIndex = 0
    const _this = this
    yield* parallel(
      'race',
      action({
        update: (...params) => {
          let newCaseIndex = 0
          for (let i = 0; i < this.cases.length; i++) {
            const case_ = this.cases[i]
            if (case_ == null) {
              continue
            }
            if (case_.condition == null || case_.condition(...params)) {
              newCaseIndex = i
              break
            }
          }
          if (caseIndex == newCaseIndex) {
            return
          }
          caseIndex = newCaseIndex
          restartController.abort()
        },
      }),
      async function* () {
        do {
          restartController = new AbortController()
          yield* abortable(_this.cases[caseIndex]!.timeline(), restartController.signal)
          //if we arrive at the while condition without beeing aborted, that means the current timeline successfully finished
        } while (restartController.signal.aborted)
      },
    )
  }
}

export async function* switch_<T>(cases: Array<SwitchTimelineCase<T>>) {
  const _switch = new SwitchTimeline(cases)
  yield* _switch.run()
}
