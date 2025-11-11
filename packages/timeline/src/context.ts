import { NonReuseableTimeline } from './index.js'

export function createContext<K extends string, T>(name: K, defaultValue: T) {
  return { [name]: defaultValue } as { [Key in K]: T }
}

export async function* getContext<C extends object>(context: C): NonReuseableTimeline<unknown, C, C[keyof C]> {
  const keys = Object.keys(context)
  if (keys.length != 1) {
    throw new Error(`context objects can only have one key (the name of the context) but received "${keys.join(', ')}"`)
  }
  const key = keys[0] as keyof C
  let value: C[keyof C] = context[key]
  yield { type: 'get-context', callback: (c) => (value = c[key] ?? value) }
  return value
}
