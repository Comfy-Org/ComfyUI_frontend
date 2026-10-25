import { expect } from '@playwright/test'

import { modelCases } from '@website/acceptance/cases'
import {
  runAndVerify,
  signIn,
  test,
  useAdvancedInputs,
  useOwnInputs
} from '@website/acceptance/fixtures'
import { expectedCharge } from '@website/acceptance/settings'
import { hubModelHref } from '@/config/hub-models'

for (const model of modelCases) {
  test(`${model.slug}: defaults, own inputs, advanced settings${model.smoke ? ' @smoke' : ''}`, async ({
    page,
    billing
  }, testInfo) => {
    expectedCharge(model.slug, 'defaults')
    expectedCharge(model.slug, 'own')
    expectedCharge(model.slug, 'advanced')
    await signIn(page, hubModelHref(model.slug))
    const defaults = await runAndVerify(
      page,
      billing,
      model,
      'defaults',
      testInfo
    )
    await useOwnInputs(page, model)
    const own = await runAndVerify(page, billing, model, 'own', testInfo)
    await useAdvancedInputs(page, model)
    const advanced = await runAndVerify(
      page,
      billing,
      model,
      'advanced',
      testInfo
    )
    expect(new Set([defaults, own, advanced]).size).toBe(3)
  })
}
