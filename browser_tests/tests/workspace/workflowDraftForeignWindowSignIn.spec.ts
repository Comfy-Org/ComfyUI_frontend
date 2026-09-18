import {
  expect,
  workflowDraftForeignWindowSignInFixture as test
} from '@e2e/fixtures/workflowDraftForeignWindowSignInFixture'

test.describe('workflow drafts across windows', { tag: '@cloud' }, () => {
  test('logout removes only the departing identity draft scope', async ({
    workflowDraft
  }) => {
    const initialTouch = await workflowDraft.touchGraph()
    await expect
      .poll(() => workflowDraft.hasPersistedTouch(initialTouch))
      .toBe(true)
    const { departingKey, otherIdentityKey } =
      await workflowDraft.seedIdentityScopedDrafts()
    await workflowDraft.logout()

    await expect
      .poll(() => workflowDraft.hasStorageValue(departingKey))
      .toBe(false)
    expect(await workflowDraft.hasStorageValue(otherIdentityKey)).toBe(true)
  })
})
