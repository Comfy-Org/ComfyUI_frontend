import { expect } from '@playwright/test'

import { modelCases } from '../../acceptance/cases'
import {
  runAndVerify,
  test,
  useAdvancedInputs,
  useOwnInputs
} from '../../acceptance/fixtures'

for (const model of modelCases) {
  test(`${model.slug}: defaults, own inputs, advanced settings${model.smoke ? ' @smoke' : ''}`, async ({
    page,
    submissions
  }, testInfo) => {
    await page.goto(`/models/${model.slug}/`)
    await expect(page.getByTestId('run-button')).toHaveAttribute(
      'data-gate',
      'ready'
    )
    const defaults = await runAndVerify(
      page,
      submissions,
      model,
      'defaults',
      testInfo
    )
    await useOwnInputs(page, model)
    const own = await runAndVerify(page, submissions, model, 'own', testInfo)
    await useAdvancedInputs(page, model)
    const advanced = await runAndVerify(
      page,
      submissions,
      model,
      'advanced',
      testInfo
    )
    expect(new Set([defaults, own, advanced]).size).toBe(3)
  })
}
