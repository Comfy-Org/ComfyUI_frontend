/**
 * Combined global teardown for i18n collection tests
 * Includes both regular teardown and litegraph restoration
 */
import globalTeardown from './globalTeardown'
import { restoreLitegraph } from './i18nSetup'

export default async function globalTeardownWithI18n() {
  // First run regular teardown
  await globalTeardown()

  // Then restore litegraph files
  await restoreLitegraph()
}
