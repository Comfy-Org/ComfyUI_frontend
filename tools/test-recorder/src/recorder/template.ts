import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'

interface TemplateOptions {
  workflow?: string
  testName: string
}

export const RECORDING_SPEC_BASENAME = '_recording-session'
const RECORDING_SPEC_FILENAME = `${RECORDING_SPEC_BASENAME}.spec.ts`

function recordingSpecPath(browserTestsDir: string): string {
  return join(browserTestsDir, 'tests', RECORDING_SPEC_FILENAME)
}

export function generateRecordingTemplate(
  options: TemplateOptions,
  browserTestsDir: string
): string {
  const filePath = recordingSpecPath(browserTestsDir)

  // Asset names come off disk, so they are quoted rather than hand-escaped.
  const workflowLine = options.workflow
    ? `  await comfyPage.workflow.loadWorkflow(${JSON.stringify(options.workflow)})\n  await comfyPage.nextFrame()\n`
    : ''

  const safeName = JSON.stringify(`recording: ${options.testName}`)

  const code = `/**
 * Auto-generated recording session.
 * This file is temporary — it will be deleted after recording.
 *
 * DO NOT COMMIT THIS FILE.
 */
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test(${safeName}, async ({ comfyPage }) => {
${workflowLine}
  // ┌────────────────────────────────────────────────────────┐
  // │ The Playwright Inspector will open.                     │
  // │                                                         │
  // │ 1. Click the Record button (red circle) to start        │
  // │ 2. Perform your test actions in the browser             │
  // │ 3. Use toolbar buttons to add assertions                │
  // │ 4. Click Stop when done                                 │
  // │ 5. Copy the generated code from the Inspector           │
  // │ 6. Close the browser window                             │
  // └────────────────────────────────────────────────────────┘
  await comfyPage.page.pause()
})
`

  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, code)
  return filePath
}

export function cleanupRecordingTemplate(browserTestsDir: string): void {
  const filePath = recordingSpecPath(browserTestsDir)
  try {
    unlinkSync(filePath)
  } catch {
    // File might already be deleted
  }
}
