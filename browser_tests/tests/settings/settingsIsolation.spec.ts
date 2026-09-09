import {
  ComfyPage,
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.use({ initialSettings: { 'Comfy.Graph.ZoomSpeed': 1.25 } })

test.beforeEach(async ({ page, request }, testInfo) => {
  const comfyPage = new ComfyPage(page, request)
  const userId = await comfyPage.setupUser(
    `playwright-test-${testInfo.parallelIndex}`
  )
  const response = await request.post(
    `${comfyPage.apiUrl}/api/devtools/set_settings`,
    {
      data: {
        'Comfy.userId': userId,
        'Comfy.EnableTooltips': true,
        'Comfy.Graph.ZoomSpeed': 0.5,
        'Comfy.Node.Opacity': 0.2
      }
    }
  )
  expect(response.ok()).toBe(true)
})

test(
  'replaces previous settings before boot and preserves runtime changes on reload',
  { tag: '@settings' },
  async ({ comfyPage }) => {
    expect(await comfyPage.settings.getSetting('Comfy.EnableTooltips')).toBe(
      false
    )
    expect(await comfyPage.settings.getSetting('Comfy.Graph.ZoomSpeed')).toBe(
      1.25
    )
    expect(
      await comfyPage.settings.getPersistedSetting('Comfy.Node.Opacity')
    ).toBeUndefined()

    await comfyPage.settings.setSetting('Comfy.Graph.ZoomSpeed', 1.5)
    await comfyPage.workflow.reloadAndWaitForApp()

    expect(await comfyPage.settings.getSetting('Comfy.Graph.ZoomSpeed')).toBe(
      1.5
    )
    expect(
      await comfyPage.settings.getPersistedSetting('Comfy.Graph.ZoomSpeed')
    ).toBe(1.5)
  }
)

test(
  'manual boot settings use the same baseline and cannot redirect the target user',
  { tag: '@settings' },
  async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.EnableTooltips', true)
    await comfyPage.settings.setSetting('Comfy.Node.Opacity', 0.2)

    await comfyPage.setupSettings({
      userId: comfyPage.id,
      settings: {
        'Comfy.userId': `${comfyPage.id}-other`,
        'Comfy.Graph.ZoomSpeed': 1.75
      }
    })
    await comfyPage.workflow.reloadAndWaitForApp()

    expect(await comfyPage.settings.getSetting('Comfy.EnableTooltips')).toBe(
      false
    )
    expect(await comfyPage.settings.getSetting('Comfy.Graph.ZoomSpeed')).toBe(
      1.75
    )
    expect(
      await comfyPage.settings.getPersistedSetting('Comfy.Node.Opacity')
    ).toBeUndefined()
  }
)
