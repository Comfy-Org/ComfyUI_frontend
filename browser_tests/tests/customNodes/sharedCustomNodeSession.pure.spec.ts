import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

import {
  assertSharedCustomNodeSession,
  installSharedCustomNodeBootProbe,
  markSharedCustomNodeSessionBooted,
  readSharedCustomNodeSession,
  sharedCustomNodeSessionEnabled
} from '@e2e/fixtures/utils/sharedCustomNodeSession'

test.describe('shared custom-node session pure contracts', () => {
  test('enables only for the explicit proof flag', () => {
    const previous = process.env.CUSTOM_NODE_SHARED_SESSION
    process.env.CUSTOM_NODE_SHARED_SESSION = '1'
    expect(sharedCustomNodeSessionEnabled()).toBe(true)
    process.env.CUSTOM_NODE_SHARED_SESSION = 'true'
    expect(sharedCustomNodeSessionEnabled()).toBe(false)
    if (previous === undefined) delete process.env.CUSTOM_NODE_SHARED_SESSION
    else process.env.CUSTOM_NODE_SHARED_SESSION = previous
  })

  test('accepts one completed boot with a page identity', () => {
    expect(() =>
      assertSharedCustomNodeSession({
        bootCount: 1,
        booted: true,
        id: 'page-1'
      })
    ).not.toThrow()
  })

  test('rejects missing, incomplete, repeated, and unidentified boots', () => {
    expect(() => assertSharedCustomNodeSession(null)).toThrow(
      'application boot is unavailable'
    )
    expect(() =>
      assertSharedCustomNodeSession({
        bootCount: 1,
        booted: false,
        id: 'page-1'
      })
    ).toThrow('application boot is unavailable')
    expect(() =>
      assertSharedCustomNodeSession({
        bootCount: 2,
        booted: true,
        id: 'page-1'
      })
    ).toThrow('booted 2 times')
    expect(() =>
      assertSharedCustomNodeSession({ bootCount: 1, booted: true, id: '' })
    ).toThrow('no page identity')
  })

  test('counts root app navigations while preserving page identity', async ({
    page
  }) => {
    await page.route('http://127.0.0.1:43210/', (route) =>
      route.fulfill({
        body: '<main>shared session</main>',
        contentType: 'text/html'
      })
    )
    await installSharedCustomNodeBootProbe(page)

    await page.goto('http://127.0.0.1:43210/')
    const first = await markSharedCustomNodeSessionBooted(page, 'user-1')
    assertSharedCustomNodeSession(first)

    await page.reload()
    const second = await readSharedCustomNodeSession(page)
    expect(second).toEqual({
      bootCount: 2,
      booted: false,
      id: first.id
    })
    expect(() => assertSharedCustomNodeSession(second)).toThrow(
      'application boot is unavailable'
    )
  })
})
