import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'

import { REPORT_ROOT } from '@e2e/reporters/nodes2Acceptance/reportDir'

export function writeReportFile(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    fs.writeFileSync(temporary, content)
    fs.renameSync(temporary, file)
  } finally {
    fs.rmSync(temporary, { force: true })
  }
}

export async function withReportLock(publish: () => void) {
  const lock = `${path.resolve(REPORT_ROOT)}.lock`
  const deadline = Date.now() + 30_000
  for (;;) {
    try {
      fs.mkdirSync(lock)
      break
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !('code' in error) ||
        error.code !== 'EEXIST'
      )
        throw error
      if (Date.now() >= deadline)
        throw new Error(`Report publication lock is still held: ${lock}`, {
          cause: error
        })
      await setTimeout(25)
    }
  }
  try {
    publish()
  } finally {
    fs.rmdirSync(lock)
  }
}
