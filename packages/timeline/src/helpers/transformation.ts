/*
const helperWorldPosition = new Vector3()

export type GetSetFn = (newValue?: number) => number

export function transformTowards(
  clock: ActionClock,
  from: Vector3 | Quaternion | Euler | GetSetFn,
  to: Vector3Tuple | Vector3 | Quaternion | Euler | Object3D | number,
) {
  if (typeof from === 'function' || typeof to === 'number') {
    if (typeof from != 'function') {
      throw new Error(``)
    }
    if (typeof to != 'number') {
      throw new Error(``)
    }
  }
  if (to instanceof Object3D) {
    if (!(from instanceof Vector3)) {
      throw new Error(
        "transformTowards: 'from' must be a Vector3 when 'to' is an Object3D. - use rotateTowards instead",
      )
    }
  }
}

export type IsDoneRef = { current: boolean }

export type EaseFunction = (clock: ActionClock, current: Array<number>, target: Array<number>) => number

const fromQuaternionHelper = new Quaternion()
const toQuaternionHelper = new Quaternion()
export function rotateTowards(
  clock: ActionClock,
  from: Object3D,
  target: Vector3Tuple | Vector3 | Object3D,
  ease?: EaseFunction,
): boolean {
  if (target instanceof Vector3) {
    helperWorldPosition.copy(target)
  } else if (target instanceof Object3D) {
    target.getWorldPosition(helperWorldPosition)
  } else {
    helperWorldPosition.fromArray(target)
  }
  fromQuaternionHelper.copy(from.quaternion)
  from.lookAt(helperWorldPosition)
  if (ease == null) {
    return true
  }
  const distance = from.quaternion.angleTo(fromQuaternionHelper)
  const correctedDistance = ease(clock, distance)
  toQuaternionHelper.copy(from.quaternion)
  from.quaternion.slerpQuaternions(fromQuaternionHelper, toQuaternionHelper, correctedDistance / distance)
  return Math.abs(correctedDistance - distance) > 0.001
}
export const lookAt = rotateTowards
*/
