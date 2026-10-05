import { config as dotenvConfig } from 'dotenv'

import { backupPath } from '@e2e/utils/backupUtils'
import { resolveLocalSetupApiUrl } from '@e2e/utils/e2eConfig'

dotenvConfig()

type GlobalSetupDependencies = {
  env: NodeJS.ProcessEnv
  fetch: typeof fetch
  backup: typeof backupPath
}

async function missingDevtoolsStatus(
  endpoint: string,
  fetchRequest: typeof fetch
): Promise<number | null> {
  try {
    const { status } = await fetchRequest(endpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000)
    })
    return status === 404 || status === 405 ? status : null
  } catch {
    return null
  }
}

async function assertLocalDevtoolsInstalled(
  env: NodeJS.ProcessEnv,
  fetchRequest: typeof fetch
): Promise<void> {
  const apiUrl = resolveLocalSetupApiUrl(env)
  if (!apiUrl) return

  const endpoint = `${apiUrl}/api/devtools/fake_model.safetensors`

  const status = await missingDevtoolsStatus(endpoint, fetchRequest)
  if (status === null) return

  throw new Error(
    [
      `ComfyUI at ${apiUrl} is serving, but ${endpoint} returned ${status}.`,
      '',
      'The expected ComfyUI_devtools GET endpoint is unavailable, so every',
      'test using the ComfyPage fixture would fail with an HTTP error that names',
      'neither devtools nor the real cause. Check the backend log for',
      '"IMPORT FAILED" or a conflicting route.',
      '',
      'The devtools import may have failed because its directory is unreadable',
      'inside the container:',
      'the image runs as pwuser (uid 1001) and a checkout made under a 0007',
      'umask lacks world read/traverse permissions.',
      'scripts/start-comfyui-e2e.sh stages a world-readable copy for this',
      'reason; a hand-rolled `docker run` that bind-mounts tools/devtools',
      'directly will hit it.'
    ].join('\n')
  )
}

export async function runGlobalSetup({
  env,
  fetch: fetchRequest,
  backup
}: GlobalSetupDependencies): Promise<void> {
  await assertLocalDevtoolsInstalled(env, fetchRequest)

  if (!env.CI) {
    if (env.TEST_COMFYUI_DIR) {
      backup([env.TEST_COMFYUI_DIR, 'user'])
      backup([env.TEST_COMFYUI_DIR, 'models'], {
        renameAndReplaceWithScaffolding: true
      })
    } else {
      console.warn(
        'Set TEST_COMFYUI_DIR in .env to prevent user data (settings, workflows, etc.) from being overwritten'
      )
    }
  }
}

export default async function globalSetup() {
  await runGlobalSetup({ env: process.env, fetch, backup: backupPath })
}
