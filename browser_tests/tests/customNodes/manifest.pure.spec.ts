import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { loadManifest } from '@e2e/fixtures/customNode/manifest'

test.describe('customNode manifest', () => {
  test('loads entries with the shape the regression spec depends on', () => {
    const entries = loadManifest()
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(entry.pack).toBeTruthy()
      expect(entry.expectedNodes.length).toBeGreaterThan(0)
      expect(entry.tiers.length).toBeGreaterThan(0)
    }
  })
})
