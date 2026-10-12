import { action } from '../src/index.js'

/**
 * an action that logs its name in its only update
 */
export function oneTick(log: Array<string>, name: string) {
  return action({
    update: () => {
      log.push(name)
      return false
    },
  })
}
