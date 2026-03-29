import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'

interface TemplateOptions {
  workflow?: string
  testName: string
}

/**
 * Generates a temporary test file that uses page.pause() to open
 * the Playwright Inspector with codegen controls.
 *
 * The test file:
 * 1. Uses comfyPageFixture to get full fixture context
 * 2. Optionally loads a workflow
 * 3. Calls page.pause() to open the Inspector
 */
export function generateRecordingTemplate(
  options: TemplateOptions,
  browserTestsDir: string
): string {
  const filePath = join(browserTestsDir, 'tests', `_recording-session.spec.ts`)

  const workflowLine = options.workflow
    ? `  // Load the selected workflow\n  await comfyPage.workflow.loadWorkflow('${options.workflow.replace(/'/g, "\\'")}')\n  await comfyPage.nextFrame()\n`
    : ''

  const code = `/**
 * Auto-generated recording session.
 * This file is temporary — it will be deleted after recording.
 *
 * DO NOT COMMIT THIS FILE.
 */
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

test('recording: ${options.testName}', async ({ comfyPage }) => {
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

/**
 * Clean up the temporary recording file.
 */
export function cleanupRecordingTemplate(browserTestsDir: string): void {
  const filePath = join(browserTestsDir, 'tests', '_recording-session.spec.ts')
  try {
    unlinkSync(filePath)
  } catch {
    // File might already be deleted
  }
}
