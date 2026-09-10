import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'

import { preferInitialSettings } from './comfyPageSetup'

const linter = new Linter()
const config = [
  {
    plugins: {
      comfy: { rules: { 'prefer-initial-settings': preferInitialSettings } }
    },
    rules: { 'comfy/prefer-initial-settings': 'warn' }
  }
] satisfies Linter.Config[]

describe('prefer-initial-settings', () => {
  it('reports setup and reset hooks, including custom test aliases', () => {
    const messages = linter.verify(
      `
test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})
customTest.afterEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
})
`,
      config
    )

    expect(messages).toEqual([
      expect.objectContaining({
        severity: 1,
        message: expect.stringContaining('initialSettings')
      }),
      expect.objectContaining({
        severity: 1,
        message: expect.stringContaining('teardown')
      })
    ])
  })

  it('allows initial settings, runtime changes, fixture setup, and unrelated methods', () => {
    expect(
      linter.verify(
        `
test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })
test('changes settings at runtime', async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
})
const test = base.extend({
  helper: async ({ comfyPage }, use) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await use(comfyPage)
  }
})
test.beforeEach(async () => {
  await unrelated.setSetting('other', true)
  await other.settings.setSetting('other', true)
})
test.afterEach(async () => {
  await other.settings.setSetting('other', false)
})
`,
        config
      )
    ).toEqual([])
  })
})
