import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

if (process.env.CUSTOM_NODE_SHARED_WORKER_RESTART_PROOF === '1') {
  test('shared page survives an unexpected failure', async ({ page }) => {
    const id = crypto.randomUUID()
    await page.evaluate(
      ({ id, pid }) => {
        Reflect.set(window, '__sharedWorkerRestartProof', { id, pid })
      },
      { id, pid: process.pid }
    )
    console.warn(`[shared-worker-proof] first pid=${process.pid} id=${id}`)
    expect('deliberate worker replacement').toBe('unexpected failure')
  })

  test('replacement worker reconnects to the same page', async ({ page }) => {
    const first = await page.evaluate(
      () =>
        Reflect.get(window, '__sharedWorkerRestartProof') as
          | { id: string; pid: number }
          | undefined
    )
    expect(first).toBeDefined()
    expect(first!.pid).not.toBe(process.pid)
    console.warn(
      `[shared-worker-proof] second pid=${process.pid} firstPid=${first!.pid} id=${first!.id}`
    )
  })
}
