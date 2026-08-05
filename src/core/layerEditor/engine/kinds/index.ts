import { registerNodeKind } from '../nodeKind'
import { fillKind } from './fill'
import { groupKind } from './group'
import { rasterKind } from './raster'

export { rasterKind } from './raster'
export { groupKind } from './group'
export { fillKind } from './fill'

let registered = false

export function registerBuiltinKinds(): void {
  if (registered) return
  registered = true
  registerNodeKind(rasterKind)
  registerNodeKind(groupKind)
  registerNodeKind(fillKind)
}
