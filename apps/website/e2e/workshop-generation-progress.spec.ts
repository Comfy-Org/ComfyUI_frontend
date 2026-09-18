import { expect } from '@playwright/test'

import { test } from './fixtures/generationProgress'

test('default Run uses the measured estimate and finishes only when the result arrives @smoke', async ({
  page,
  generationProgress
}, testInfo) => {
  await page.getByTestId('run-button').click()
  await generationProgress.requested
  const output = page.getByTestId('playground-output')
  const progress = page.getByRole('progressbar', {
    name: 'Estimated generation progress'
  })
  await expect(progress).toHaveAttribute('aria-valuenow', '0')
  await expect(page.getByText('Estimated time: 50 sec')).toBeVisible()
  await page.clock.fastForward(50_000)
  await expect(progress).toHaveAttribute('aria-valuenow', '95')
  await output.screenshot({
    path: testInfo.outputPath('progress-95.png'),
    animations: 'disabled'
  })
  await page.clock.fastForward(50_000)
  await expect(progress).toHaveAttribute('aria-valuenow', '99')
  await expect(output).toHaveAttribute('data-state', 'running')
  await output.screenshot({
    path: testInfo.outputPath('progress-99.png'),
    animations: 'disabled'
  })

  generationProgress.complete()
  await expect(output).toHaveAttribute('data-state', 'succeeded')
  await expect(progress).toHaveCount(0)
  await expect(
    output.getByRole('img', { name: 'Output', exact: true })
  ).toHaveJSProperty('naturalWidth', 1)
})
