import { findProjectRoot } from '../recorder/runner'
import { addWorkflow } from '../workflows/add'

export function runAddWorkflow(filePath: string, name?: string): void {
  const { destRelPath } = addWorkflow(filePath, findProjectRoot(), name)
  console.log(destRelPath)
}
