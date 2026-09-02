import { spawnSync } from 'node:child_process'
import { detectPlatform } from '../checks/platform'

type ClipboardResult = { ok: true } | { ok: false; reason: string }

export async function copyToClipboard(
  content: string
): Promise<ClipboardResult> {
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
    // Wayland sessions often ship none of the X11 tools, so try wl-copy too.
    const candidates: [string, string[]][] = process.env.WAYLAND_DISPLAY
      ? [
          ['wl-copy', []],
          ['xclip', ['-selection', 'clipboard']],
          ['xsel', ['--clipboard', '--input']]
        ]
      : [
          ['xclip', ['-selection', 'clipboard']],
          ['xsel', ['--clipboard', '--input']],
          ['wl-copy', []]
        ]

    for (const [candidate, candidateArgs] of candidates) {
      const attempt = spawnSync(candidate, candidateArgs, {
        input: content,
        stdio: 'pipe'
      })
      if (attempt.status === 0) return { ok: true }
    }
    return {
      ok: false,
      reason: 'no clipboard tool found (tried wl-copy, xclip, xsel)'
    }
  }

  const result = spawnSync(cmd, args, {
    input: content,
    stdio: 'pipe'
  })
  return result.status === 0
    ? { ok: true }
    : { ok: false, reason: `${cmd} failed` }
}
