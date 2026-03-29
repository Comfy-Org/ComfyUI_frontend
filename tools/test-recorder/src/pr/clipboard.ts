import { spawnSync } from 'node:child_process'
import { detectPlatform } from '../checks/platform'

export async function copyToClipboard(content: string): Promise<boolean> {
  const platform = detectPlatform()

  let cmd: string
  let args: string[]

  if (platform === 'macos') {
    cmd = 'pbcopy'
    args = []
  } else if (platform === 'windows') {
    cmd = 'clip.exe'
    args = []
  } else {
    // Linux: try xclip first, fall back to xsel
    const xclip = spawnSync('xclip', ['-selection', 'clipboard'], {
      input: content,
      stdio: 'pipe'
    })
    if (xclip.status === 0) return true

    const xsel = spawnSync('xsel', ['--clipboard', '--input'], {
      input: content,
      stdio: 'pipe'
    })
    return xsel.status === 0
  }

  const result = spawnSync(cmd, args, {
    input: content,
    stdio: 'pipe'
  })
  return result.status === 0
}
