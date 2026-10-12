import { findProjectRoot } from '../recorder/runner'
import { addWorkflow, WORKFLOW_ASSET_EXPLANATION } from '../workflows/add'

export function runAddWorkflow(filePath: string, name?: string): void {
  const { destRelPath } = addWorkflow(filePath, findProjectRoot(), name)
  console.log(destRelPath)
  console.error(WORKFLOW_ASSET_EXPLANATION)
}
