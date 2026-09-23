import {
  expect,
  workflowDraftForeignWindowSignInFixture as test
} from '@e2e/fixtures/workflowDraftForeignWindowSignInFixture'

test.describe('workflow drafts across windows', { tag: '@cloud' }, () => {
  test('a second window signing in neither wipes drafts nor stops persistence', async ({
    workflowDraft
  }) => {
    const initialTouch = await workflowDraft.touchGraph()
    await expect
      .poll(() => workflowDraft.hasPersistedTouch(initialTouch))
      .toBe(true)

    const draftsBefore = await workflowDraft.getDraftKeys()
    expect(
      await workflowDraft.hasWorkspaceContext(),
      'first window has no workspace context before the auth change'
    ).toBe(true)

    await workflowDraft.triggerForeignWindowAuthChange()

    await expect
      .poll(() => workflowDraft.hasClearedWorkspaceContext(), {
        message:
          "first window never observed the second window's auth change - repro harness needs work, not a passing build"
      })
      .toBe(true)

    await expect(workflowDraft.logoutButton).toBeVisible()

    test.fail(
      true,
      'Foreign-window sign-in wipes drafts and fences persistence'
    )

    expect
      .soft(
        await workflowDraft.getDraftKeys(),
        'drafts were wiped by a transient auth change in another window'
      )
      .toEqual(draftsBefore)

    const touchAfterAuthChange = await workflowDraft.touchGraph()
    await expect
      .poll(() => workflowDraft.hasPersistedTouch(touchAfterAuthChange), {
        message:
          'persistence stayed fenced after the auth change - the logout transition was never completed'
      })
      .toBe(true)
  })
})
