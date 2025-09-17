import { Euler, Quaternion, Vector3 } from 'three'

export function write<T>(
  value: Vector3 | Quaternion,
  into: Vector3 | Quaternion | Euler | ((value: any) => void),
): void {
  if (typeof into === 'function') {
    into(value as T)
    return
  }
  if (into.isVector3) {
    into.copy(value)
    return
  }
  if (into.isEuler) {
    into.setFromQuaternion(value as any)
    return
  }
  into.copy(value as any)
}

const eulerHelper = new Euler()
eulerHelper.order = 'YXZ'

export function read(
  preferType: 'rotation' | 'position',
  value:
    | Array<number>
    | Vector3
    | Quaternion
    | Euler
    | number
    | (() => Array<number> | Vector3 | Quaternion | Euler | number),
  into?: Vector3 | Quaternion,
): Vector3 | Quaternion {
  if (typeof value === 'function') {
    value = value()
  }
  if (typeof value === 'number') {
    into ??= new Vector3()
    return into.set(value, 0, 0, 0)
  }
  if (value.isVector3) {
    into ??= new Vector3()
    return (into as Vector3).copy(value)
  }
  if (value.isQuaternion) {
    into ??= new Quaternion()
    return into.copy(value)
  }
  if (value.isEuler) {
    into ??= new Quaternion()
    return (into as Quaternion).setFromEuler(value)
  }
  if (value.length === 4) {
    into ??= new Quaternion()
    return into.fromArray(value)
  }
  if (value.length === 3 && preferType === 'position') {
    into ??= new Vector3()
    return into.fromArray(value)
  }
  if (value.length === 3 && preferType === 'rotation') {
    into ??= new Quaternion()
    return into.setFromEuler(eulerHelper.fromArray(value as any))
  }
  throw new Error(`unexpected value in read "${value}"`)
}
