import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { isMap, isSeq, parseDocument } from 'yaml'

const WORKFLOWS = join(import.meta.dirname, '../../../.github/workflows')

/** Reads the `run` or github-script `script` body of a named workflow step. */
export function workflowStepRun(workflow: string, job: string, step: string) {
  const steps = parseDocument(
    readFileSync(join(WORKFLOWS, workflow), 'utf8')
  ).getIn(['jobs', job, 'steps'])
  const found = isSeq(steps)
    ? steps.items.find((item) => isMap(item) && item.get('name') === step)
    : undefined
  if (!isMap(found)) return ''
  return String(found.get('run') ?? found.getIn(['with', 'script']) ?? '')
}
