import type { World } from './world'
import { createWorld } from './world'

/** Module-singleton `World` for the editor process. */
let instance: World | undefined

export function getWorld(): World {
  if (!instance) instance = createWorld()
  return instance
}

export function resetWorldInstance(): void {
  instance = undefined
}
