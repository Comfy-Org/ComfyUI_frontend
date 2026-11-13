import { expect, test } from '@e2e/fixtures/liveExecution'

test.describe('M1 real backend smoke', { tag: ['@smoke', '@workflow'] }, () => {
  test('single job completes with correct canvas and backend output', async ({
    comfyPage,
    liveExecution
  }) => {
    await comfyPage.workflow.loadWorkflow('execution/partial_execution')
    const jobId = await liveExecution.run(comfyPage)
    await expect
      .poll(() => liveExecution.hasEvent(jobId, 'execution_success'))
      .toBe(true)
    const job = await liveExecution.job(jobId)
    expect(job.status).toBe('completed')
    expect(job.outputs?.['1'].text).toEqual(['foo'])
    const output = await comfyPage.nodeOps.getNodeRefById(1)
    await expect
      .poll(async () => (await output.getWidget(0)).getValue())
      .toBe('foo')
  })

  test('overlapping runs keep the later run visible when the earlier run finishes', async ({
    comfyPage,
    liveExecution
  }) => {
    await comfyPage.workflow.loadWorkflow('execution/parallel_sleep')
    const first = await liveExecution.run(comfyPage)
    await expect
      .poll(() => liveExecution.hasEvent(first, 'execution_start'))
      .toBe(true)
    await liveExecution.editRunInputs(comfyPage)
    const second = await liveExecution.run(comfyPage)
    await expect
      .poll(() => liveExecution.hasEvent(second, 'execution_start'))
      .toBe(true)
    expect(liveExecution.hasEvent(first, 'execution_success')).toBe(false)

    await expect
      .poll(() => liveExecution.hasEvent(first, 'execution_success'))
      .toBe(true)
    expect(liveExecution.hasEvent(second, 'execution_success')).toBe(false)
    expect((await liveExecution.job(second)).status).toBe('in_progress')
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => String(window.app!.runningNodeId))
      )
      .toBe('2')

    await expect
      .poll(() => liveExecution.hasEvent(second, 'execution_success'))
      .toBe(true)
    expect((await liveExecution.job(first)).outputs?.['3'].text).toEqual([
      'first-run'
    ])
    expect((await liveExecution.job(second)).outputs?.['3'].text).toEqual([
      'second-run'
    ])
    const output = await comfyPage.nodeOps.getNodeRefById(3)
    await expect
      .poll(async () => (await output.getWidget(0)).getValue())
      .toBe('second-run')
    expect(
      liveExecution.frames.filter((frame) => frame.type === 'execution_error')
    ).toEqual([])
  })

  test('different workflow tabs overlap without clearing the foreground run or mixing outputs', async ({
    comfyPage,
    liveExecution
  }) => {
    await comfyPage.workflow.loadWorkflow('execution/parallel_sleep')
    const firstTab = await comfyPage.menu.topbar.getActiveTabName()
    const first = await liveExecution.run(comfyPage)
    await expect
      .poll(() => liveExecution.hasConcurrentNodes(first, ['2']))
      .toBe(true)

    await comfyPage.workflow.loadWorkflow(
      'execution/parallel_sleep_other_workflow'
    )
    const secondTab = await comfyPage.menu.topbar.getActiveTabName()
    expect(secondTab).not.toBe(firstTab)
    const second = await liveExecution.run(comfyPage)
    expect(liveExecution.workflowIdsByJob[first]).toBeDefined()
    expect(liveExecution.workflowIdsByJob[second]).toBeDefined()
    expect(liveExecution.workflowIdsByJob[second]).not.toBe(
      liveExecution.workflowIdsByJob[first]
    )
    await expect
      .poll(() => liveExecution.hasConcurrentNodes(second, ['2']))
      .toBe(true)
    expect(liveExecution.hasEvent(first, 'execution_success')).toBe(false)

    await comfyPage.workflow.switchToTab(firstTab)
    await comfyPage.nextFrame()
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => String(window.app!.runningNodeId))
      )
      .toBe('2')
    await comfyPage.workflow.switchToTab(secondTab)
    await comfyPage.nextFrame()
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => String(window.app!.runningNodeId))
      )
      .toBe('2')

    await expect
      .poll(() => liveExecution.hasEvent(first, 'execution_success'))
      .toBe(true)
    expect((await liveExecution.job(second)).status).toBe('in_progress')
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => String(window.app!.runningNodeId))
      )
      .toBe('2')
    await expect
      .poll(() => liveExecution.hasEvent(second, 'execution_success'))
      .toBe(true)
    expect((await liveExecution.job(first)).outputs?.['3'].text).toEqual([
      'first-run'
    ])
    expect((await liveExecution.job(second)).outputs?.['3'].text).toEqual([
      'other-workflow'
    ])
    const secondOutput = await comfyPage.nodeOps.getNodeRefById(3)
    await expect
      .poll(async () => (await secondOutput.getWidget(0)).getValue())
      .toBe('other-workflow')
    await comfyPage.workflow.switchToTab(firstTab)
    await comfyPage.nextFrame()
    const firstOutput = await comfyPage.nodeOps.getNodeRefById(3)
    await expect
      .poll(async () => (await firstOutput.getWidget(0)).getValue())
      .toBe('first-run')
    expect(
      liveExecution.frames.filter((frame) => frame.type === 'execution_error')
    ).toEqual([])
  })

  test('independent async branches overlap and preserve both outputs', async ({
    comfyPage,
    liveExecution
  }) => {
    await comfyPage.workflow.loadWorkflow('execution/parallel_branches')
    const jobId = await liveExecution.run(comfyPage)
    await expect
      .poll(() => liveExecution.hasConcurrentNodes(jobId, ['2', '5']))
      .toBe(true)
    await expect
      .poll(() => liveExecution.hasEvent(jobId, 'execution_success'))
      .toBe(true)
    const job = await liveExecution.job(jobId)
    expect(job.outputs?.['3'].text).toEqual(['branch-a'])
    expect(job.outputs?.['6'].text).toEqual(['branch-b'])
    expect(
      liveExecution.frames.filter((frame) => frame.type === 'execution_error')
    ).toEqual([])
  })
})
