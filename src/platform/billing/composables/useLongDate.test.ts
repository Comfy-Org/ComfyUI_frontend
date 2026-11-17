import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import { useLongDate as createLongDate } from './useLongDate'

const apps: App<Element>[] = []
const originalTimeZone = process.env.TZ

function useLongDate(): ReturnType<typeof createLongDate> {
  let result: ReturnType<typeof createLongDate> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        result = createLongDate()
        return () => null
      }
    })
  )
  app.use(createI18n({ legacy: false, locale: 'en', messages: { en: {} } }))
  app.mount(document.createElement('div'))
  apps.push(app)
  if (!result) throw new Error('long date not initialized')
  return result
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  process.env.TZ = originalTimeZone
})

describe('useLongDate', () => {
  it('formats in UTC so a browser west of UTC shows the same day as the plan row', () => {
    process.env.TZ = 'America/Los_Angeles'

    expect(useLongDate().longDate('2026-12-31T00:00:00Z')).toBe(
      'December 31, 2026'
    )
  })

  it.for([null, undefined, '', 'not-a-date'])(
    'returns an empty string for %s',
    (raw) => {
      expect(useLongDate().longDate(raw)).toBe('')
    }
  )
})
