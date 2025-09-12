import type { FullConfig } from '@playwright/test'

import { preprocessLitegraph } from './i18nSetup'

export default async function globalSetup(config: FullConfig) {
  await preprocessLitegraph()
}
