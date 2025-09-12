import { FullConfig } from '@playwright/test'

import { restoreLitegraph } from './i18nSetup'

export default async function globalTeardown(config: FullConfig) {
  await restoreLitegraph()
}
