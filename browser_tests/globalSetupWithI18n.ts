import { preprocessLitegraph } from './i18nSetup'

export default async function globalSetupWithI18n() {
  await preprocessLitegraph()
}
