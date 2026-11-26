import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

type LiteralAtMessages = {
  auth: { errors: { signupBlocked: string } }
  comfyHubProfile: { usernamePlaceholder: string }
}

const catalogs = Object.entries(
  import.meta.glob<LiteralAtMessages>('./locales/*/main.json', {
    eager: true,
    import: 'default'
  })
).map(([path, messages]) => ({ locale: path.split('/')[2], messages }))

describe('literal at signs in locale messages', () => {
  it.for(catalogs)(
    '$locale renders contact email and username prefix without compiler errors',
    ({ locale, messages }) => {
      const { t } = createI18n({
        legacy: false,
        locale,
        fallbackLocale: false,
        messages: { [locale]: messages }
      }).global

      expect(t('auth.errors.signupBlocked')).toContain('support@comfy.org')
      expect(t('comfyHubProfile.usernamePlaceholder')).toBe('@')
      expect(console.error).not.toHaveBeenCalled()
    }
  )
})
