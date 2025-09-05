import { restoreLitegraph } from './i18nSetup'

export default async function globalTeardownWithI18n() {
  await restoreLitegraph()
}
