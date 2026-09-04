import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parse } from 'jsonc-parser'

import {
  formatResults,
  updateAttributionSettings
} from './update-ai-attribution'

describe('updateAttributionSettings', () => {
  it('creates settings files with owner-only permissions', () => {
    const home = mkdtempSync(join(tmpdir(), 'update-ai-attribution-'))
    try {
      updateAttributionSettings(home)

      expect(
        statSync(join(home, '.claude', 'settings.json')).mode & 0o777
      ).toBe(0o600)
      expect(
        statSync(join(home, '.config', 'amp', 'settings.json')).mode & 0o777
      ).toBe(0o600)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('does not follow a symlink at the old predictable temporary path', () => {
    const home = mkdtempSync(join(tmpdir(), 'update-ai-attribution-'))
    try {
      const claudeDirectory = join(home, '.claude')
      const claudePath = join(claudeDirectory, 'settings.json')
      const targetPath = join(home, 'target')
      mkdirSync(claudeDirectory, { recursive: true })
      writeFileSync(targetPath, 'unchanged')
      symlinkSync(targetPath, `${claudePath}.${process.pid}.tmp`)

      const [claudeResult] = updateAttributionSettings(home)

      expect(claudeResult.outcome).toBe('updated')
      expect(readFileSync(targetPath, 'utf8')).toBe('unchanged')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('updates only attribution settings without exposing other values', () => {
    const home = mkdtempSync(join(tmpdir(), 'update-ai-attribution-'))
    try {
      const claudePath = join(home, '.claude', 'settings.json')
      const ampPath = join(home, '.config', 'amp', 'settings.jsonc')
      mkdirSync(join(home, '.claude'), { recursive: true })
      mkdirSync(join(home, '.config', 'amp'), { recursive: true })
      writeFileSync(
        claudePath,
        JSON.stringify({
          token: 'claude-secret',
          attribution: { custom: true }
        })
      )
      writeFileSync(
        ampPath,
        '{\n  // Keep this comment.\n  "token": "amp-secret"\n}\n'
      )
      chmodSync(claudePath, 0o640)
      chmodSync(ampPath, 0o660)

      const firstResults = updateAttributionSettings(home)
      const output = formatResults(firstResults)
      const claude: unknown = parse(readFileSync(claudePath, 'utf8'))
      const ampContent = readFileSync(ampPath, 'utf8')
      const amp: unknown = parse(ampContent)

      expect(firstResults.map(({ outcome }) => outcome)).toEqual([
        'updated',
        'updated',
        'workspace setting required'
      ])
      expect(output).not.toContain('claude-secret')
      expect(output).not.toContain('amp-secret')
      expect(claude).toMatchObject({
        token: 'claude-secret',
        attribution: {
          custom: true,
          commit: '',
          pr: '',
          sessionUrl: false
        }
      })
      expect(ampContent).toContain('// Keep this comment.')
      expect(amp).toMatchObject({
        token: 'amp-secret',
        'amp.git.commit.ampThread.enabled': false,
        'amp.git.commit.coauthor.enabled': false
      })
      expect(statSync(claudePath).mode & 0o777).toBe(0o640)
      expect(statSync(ampPath).mode & 0o777).toBe(0o660)
      expect(
        updateAttributionSettings(home).map(({ outcome }) => outcome)
      ).toEqual([
        'already configured',
        'already configured',
        'workspace setting required'
      ])
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
