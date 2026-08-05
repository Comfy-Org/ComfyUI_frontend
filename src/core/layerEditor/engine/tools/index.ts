import { registerTool } from '../tool'
import { makeSelectToolDef } from './selectTool'
import { makeTransformToolDef } from './transformTool'

export { makeSelectToolDef, nodeBounds } from './selectTool'
export {
  makeTransformToolDef,
  isTransformTool,
  canTransformNode
} from './transformTool'
export type { TransformToolApi } from './transformTool'
export * from './transformMath'

let registered = false

export function registerBuiltinTools(): void {
  if (registered) return
  registered = true
  registerTool(makeSelectToolDef())
  registerTool(makeTransformToolDef())
}
