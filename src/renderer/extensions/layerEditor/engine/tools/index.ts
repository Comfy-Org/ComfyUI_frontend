import { registerTool } from '../tool'
import { makeSelectToolDef } from './selectTool'
import { makeTransformToolDef } from './transformTool'

let registered = false

export function registerBuiltinTools(): void {
  if (registered) return
  registered = true
  registerTool(makeSelectToolDef())
  registerTool(makeTransformToolDef())
}
