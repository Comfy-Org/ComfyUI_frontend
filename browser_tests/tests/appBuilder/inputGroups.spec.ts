import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { InputGroups } from '@e2e/fixtures/components/InputGroups'
import {
  builderSaveAs,
  saveCloseAndReopenInBuilder,
  setupBuilder
} from '@e2e/fixtures/utils/builderTestUtils'

test.describe('App builder input groups', { tag: '@ui' }, () => {
  test.use({
    initialSettings: { 'Comfy.AppBuilder.VueNodeSwitchDismissed': true }
  })

  test.beforeEach(async ({ comfyPage }) => {
    await setupBuilder(comfyPage, undefined, ['seed', 'steps', 'cfg'])
    await comfyPage.appMode.steps.goToPreview()
  })

  test('creates, renames and collapses a group, then ungroups without deleting inputs', async ({
    comfyPage
  }) => {
    const groups = new InputGroups(comfyPage.page)
    await groups.createFromWidget('seed', 'Sampling')
    await groups.addWidget('steps', 'Sampling')
    await expect(groups.labels('Sampling')).toHaveText(['seed', 'steps'])
    await groups
      .group('Sampling')
      .getByRole('button', { name: 'Sampling', exact: true })
      .click()
    await expect(groups.labels('Sampling')).toHaveCount(0)
    await groups
      .group('Sampling')
      .getByRole('button', { name: 'Sampling', exact: true })
      .click()
    await expect(groups.labels('Sampling')).toHaveText(['seed', 'steps'])
    await groups.requestUngroup('Sampling')
    await groups.ungroupDialog
      .getByRole('button', { name: 'Cancel', exact: true })
      .click()
    await expect(groups.group('Sampling')).toBeVisible()
    await groups.requestUngroup('Sampling')
    await groups.ungroupDialog
      .getByRole('button', { name: 'Ungroup', exact: true })
      .click()
    await expect(groups.all).toHaveCount(0)
    await expect(comfyPage.appMode.select.previewWidgetLabels).toHaveText([
      'seed',
      'steps',
      'cfg'
    ])
  })

  test('preserves names and membership after saving and reopening the app', async ({
    comfyPage
  }) => {
    const groups = new InputGroups(comfyPage.page)
    await groups.createFromWidget('seed', 'Sampling')
    await groups.addWidget('steps', 'Sampling')
    await saveCloseAndReopenInBuilder(
      comfyPage,
      comfyPage.appMode,
      `${Date.now()} input-groups`
    )
    await comfyPage.appMode.steps.goToPreview()
    await expect(groups.group('Sampling')).toBeVisible()
    await expect(groups.labels('Sampling')).toHaveText(['seed', 'steps'])
    await expect(groups.widget('cfg')).toBeVisible()
  })

  test('drags an ungrouped input into a group and between groups', async ({
    comfyPage
  }) => {
    const groups = new InputGroups(comfyPage.page)
    await groups.createEmpty('Sampling')
    await groups.dragWidgetToEmptyGroup('seed', 'Sampling')
    await expect(groups.labels('Sampling')).toHaveText(['seed'])
    await groups.createEmpty('Other inputs')
    await groups.dragWidgetToEmptyGroup('seed', 'Other inputs')
    await expect(groups.group('Sampling')).toHaveCount(0)
    await expect(groups.labels('Other inputs')).toHaveText(['seed'])
    await expect(comfyPage.appMode.select.previewWidgetLabels).toHaveCount(3)
  })

  test('cancels a drag and restores an ungrouped input with undo', async ({
    comfyPage
  }) => {
    const groups = new InputGroups(comfyPage.page)
    await groups.createFromWidget('seed', 'Sampling')
    await groups.dragWidgetToUngroupedInput('seed', 'cfg', true)
    await expect(groups.labels('Sampling')).toHaveText(['seed'])
    await groups.dragWidgetToUngroupedInput('seed', 'cfg')
    await expect(groups.all).toHaveCount(0)
    await expect(groups.widget('seed')).toBeVisible()
    await comfyPage.keyboard.undo(null)
    await expect(groups.labels('Sampling')).toHaveText(['seed'])
  })

  test('pairs inputs side by side and undoes the pair in one step', async ({
    comfyPage
  }) => {
    const groups = new InputGroups(comfyPage.page)
    await groups.createFromWidget('seed', 'Sampling')
    await groups.addWidget('steps', 'Sampling')
    await groups.pairWidgets('seed', 'steps')
    await expect
      .poll(async () => {
        const seed = await groups.widgetPosition('seed')
        const steps = await groups.widgetPosition('steps')
        return seed.y === steps.y && seed.x !== steps.x
      })
      .toBe(true)
    await comfyPage.keyboard.undo(null)
    await expect
      .poll(async () => {
        const seed = await groups.widgetPosition('seed')
        const steps = await groups.widgetPosition('steps')
        return seed.x === steps.x && seed.y !== steps.y
      })
      .toBe(true)
    await expect(groups.labels('Sampling')).toHaveText(['seed', 'steps'])
  })

  test('reorders ungrouped inputs with a shared drag source', async ({
    comfyPage
  }) => {
    const groups = new InputGroups(comfyPage.page)
    await groups.dragWidgetToUngroupedInput('cfg', 'seed', false, 0.75)
    await expect(comfyPage.appMode.select.previewWidgetLabels).toHaveText([
      'seed',
      'cfg',
      'steps'
    ])
  })

  test('hides a group in app mode after its last input is deselected', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    const groups = new InputGroups(comfyPage.page)
    await groups.createFromWidget('seed', 'Sampling')
    await appMode.steps.goToInputs()
    await appMode.select.deleteInput('seed')
    await appMode.steps.goToPreview()
    await expect(groups.group('Sampling')).toBeVisible()
    await expect(groups.labels('Sampling')).toHaveCount(0)
    await builderSaveAs(appMode, `${Date.now()} empty-group`, 'App')
    await appMode.saveAs.viewAppButton.click()
    await expect(appMode.linearWidgets).toBeVisible()
    await expect(groups.all).toHaveCount(0)
    await expect(
      appMode.linearWidgets.getByTestId('builder-widget-label')
    ).toHaveText(['steps', 'cfg'])
  })
})
