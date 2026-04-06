import * as fs from 'node:fs'
import * as path from 'node:path'
import { TEMPLATES_DIR } from './paths'
import type { WorkflowJson } from './types'
import { logger } from './logger'

export function readWorkflowJson(templateName: string): WorkflowJson | null {
  const workflowPath = path.join(TEMPLATES_DIR, `${templateName}.json`)
  if (!fs.existsSync(workflowPath)) {
    return null
  }
  try {
    const content = fs.readFileSync(workflowPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    logger.warn(
      `Failed to parse workflow ${templateName}.json:`,
      error instanceof Error ? error.message : error
    )
    return null
  }
}
