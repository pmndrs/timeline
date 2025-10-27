import { Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { worldSpace, type TimelineYieldActionUpdate, type EaseFunction } from './index.js'
import { getPrevious, setPrevious } from './previous.js'
import { read, write } from './utils.js'

const matrixHelper = new Matrix4()
const fromHelper = new Vector3()
const toHelper = new Vector3()

/**
 * action update function for making a src object or quaternion look from its position towards the `toPosition`
 * @param ease allows to ease the rotation from the current state to the target position
 *
 * > [!NOTE]
 * > World forward is −Z with up = `Object3D.DEFAULT_UP`. If source and target positions are identical.
 */
export function lookAt<T>(
  from:
    | {
        position: Vector3 | (() => Vector3)
        rotation: Quaternion | ((newValue?: Quaternion) => Quaternion)
      }
    | Object3D,
  toPosition: Vector3 | Array<number> | (() => Vector3 | Array<number>) | Object3D,
  ease?: EaseFunction<T>,
): TimelineYieldActionUpdate<T> {
  if (from instanceof Object3D) {
    from = {
      position: worldSpace('position', from),
      rotation: worldSpace('quaternion', from),
    }
  }
  if (toPosition instanceof Object3D) {
    toPosition = worldSpace('position', toPosition)
  }
  const goal = new Quaternion()
  const current = new Quaternion()
  const target = new Quaternion()
  let prev: Quaternion | undefined | null = null
  return (state, clock) => {
    if (prev === null) {
      prev = getPrevious(from.rotation, 'lookAt', clock) as Quaternion
    }
    // read current orientation as quaternion
    read('rotation', from.rotation, current)
    // compute desired orientation quaternion such that -Z looks towards target direction
    read('position', from.position, fromHelper)
    read('position', toPosition, toHelper)
    if (fromHelper.distanceToSquared(toHelper) === 0) {
      return false
    }

    matrixHelper.lookAt(fromHelper, toHelper, Object3D.DEFAULT_UP)
    goal.setFromRotationMatrix(matrixHelper)

    if (ease == null) {
      write(goal, from.rotation)
      return false
    }

    const shouldContinue = ease(state, clock, prev, current, goal, target)

    // update prev with current snapshot
    prev ??= current.clone()
    prev.copy(current)

    write(target, from.rotation)
    if (shouldContinue === false) {
      setPrevious(from.rotation, 'lookAt', prev)
    }
    return shouldContinue
  }
}
