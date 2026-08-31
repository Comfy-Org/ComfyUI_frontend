import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
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
