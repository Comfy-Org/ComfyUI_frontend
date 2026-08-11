import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { chromium } from '@playwright/test'
import { config as dotenvConfig } from 'dotenv'

import {
  SHARED_CUSTOM_NODE_CDP_ENDPOINT,
  sharedCustomNodeSessionEnabled
} from '@e2e/fixtures/utils/sharedCustomNodeSession'
import { backupPath } from '@e2e/utils/backupUtils'

dotenvConfig()

export default async function globalSetup() {
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

  if (!sharedCustomNodeSessionEnabled()) return

  const userDataDir = await mkdtemp(
    join(tmpdir(), 'custom-node-shared-session-')
  )
  const context = await chromium.launchPersistentContext(userDataDir, {
    args: ['--remote-debugging-port=0'],
    headless: true,
    viewport: { height: 720, width: 1280 }
  })
  const [port] = (
    await readFile(join(userDataDir, 'DevToolsActivePort'), 'utf8')
  )
    .trim()
    .split('\n')
  process.env[SHARED_CUSTOM_NODE_CDP_ENDPOINT] = `http://127.0.0.1:${port}`

  return async () => {
    await context.close()
    await rm(userDataDir, { force: true, recursive: true })
  }
}
