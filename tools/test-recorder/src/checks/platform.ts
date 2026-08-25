import os from 'node:os'
import { pass } from '../ui/logger'
import type { CheckResult } from './types'

type Platform = 'macos' | 'windows' | 'linux'

export function detectPlatform(): Platform {
  switch (os.platform()) {
    case 'darwin':
      return 'macos'
    case 'win32':
      return 'windows'
    default:
      return 'linux'
  }
}

export function checkPlatform(): CheckResult {
  const p = os.platform()
  const arch = os.arch()
  const release = os.release()
  pass('Operating System', `${p} ${release} (${arch})`)
  return { name: 'Operating System', ok: true, version: `${p} ${arch}` }
}
