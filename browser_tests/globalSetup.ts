import { config as dotenvConfig } from 'dotenv'

import { backupPath } from '@e2e/utils/backupUtils'

dotenvConfig()

/**
 * Fail before the first test when ComfyUI is up but devtools did not import.
 *
 * ComfyUI logs `IMPORT FAILED` for an unloadable custom node and keeps
 * serving, so the backend answers 200 and looks healthy while every
 * `/api/devtools/*` route is missing. The first thing that notices is
 * `ComfyPage.setupSettings`, which reports the HTTP status of an endpoint it
 * does not name — most recently a 405 that read as an auth problem and cost
 * two lanes a diagnosis each before it turned out to be a read-only mount the
 * container's `pwuser` could not read.
 *
 * Use the same base URL as `ComfyPage`, but probe a read-only devtools route so
 * setup validation cannot overwrite user settings.
 *
 * `null` when the route is present or the backend is unreachable — an
 * unreachable backend is a different failure with its own clear message, so it
 * is left to the fixture rather than guessed at here. Otherwise the status that
 * says the route is absent: 404 or 405. Any other status means devtools
 * answered.
 */
async function missingDevtoolsStatus(endpoint: string): Promise<number | null> {
  try {
    const { status } = await fetch(endpoint, {
      signal: AbortSignal.timeout(5_000)
    })
    return status === 404 || status === 405 ? status : null
  } catch {
    return null
  }
}

async function assertDevtoolsInstalled(apiUrl: string): Promise<void> {
  const endpoint = `${apiUrl}/api/devtools/fake_model.safetensors`

  const status = await missingDevtoolsStatus(endpoint)
  if (status === null) return

  throw new Error(
    [
      `ComfyUI at ${apiUrl} is serving, but ${endpoint} returned ${status}.`,
      '',
      'ComfyUI_devtools is not loaded, so every browser test would fail at the',
      'ComfyPage fixture with an HTTP error that names neither devtools nor the',
      'real cause. Check the backend log for "IMPORT FAILED".',
      '',
      'Most often the devtools directory is unreadable inside the container:',
      'the image runs as pwuser (uid 1001) and a checkout made under a 0007',
      'umask is mode 0660. scripts/start-comfyui-e2e.sh stages a world-readable',
      'copy for this reason; a hand-rolled `docker run` that bind-mounts',
      'tools/devtools directly will hit it.'
    ].join('\n')
  )
}

export default async function globalSetup() {
  const apiUrl =
    process.env.PLAYWRIGHT_SETUP_API_URL ||
    process.env.PLAYWRIGHT_TEST_URL ||
    'http://localhost:8188'
  if (
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(apiUrl).hostname)
  ) {
    await assertDevtoolsInstalled(apiUrl)
  }

  if (!process.env.CI) {
    if (process.env.TEST_COMFYUI_DIR) {
      backupPath([process.env.TEST_COMFYUI_DIR, 'user'])
      backupPath([process.env.TEST_COMFYUI_DIR, 'models'], {
        renameAndReplaceWithScaffolding: true
      })
    } else {
      console.warn(
        'Set TEST_COMFYUI_DIR in .env to prevent user data (settings, workflows, etc.) from being overwritten'
      )
    }
  }
}
