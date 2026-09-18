import { describe, expect, it } from 'vitest'

import { LOCALE_CODES } from '../config/locales'
import { isLocaleInvariantPath } from '../config/routes'
import { drops } from './drops'

/**
 * Every drop links somewhere, and each locale's URL used to be typed out by hand
 * beside the English one. Two of the seven were wrong: `/zh-CN/enterprise` and
 * `/zh-CN/p/supported-models` have never existed, so the Chinese launches page
 * shipped two dead links. Deriving each locale's URL from the route table
 * instead means a link can only point where that locale actually serves.
 */
describe('drop links', () => {
  const hrefs = drops.map((drop) => drop.cta.href)

  it('gives every locale a URL for every drop', () => {
    for (const href of hrefs) {
      for (const locale of LOCALE_CODES) {
        expect(href[locale], `missing ${locale} href`).toBeTypeOf('string')
      }
    }
  })

  it('never prefixes a route that only exists in English', () => {
    const offenders = hrefs
      .filter((href) => isLocaleInvariantPath(href.en))
      .flatMap((href) =>
        LOCALE_CODES.filter((locale) => href[locale] !== href.en).map(
          (locale) => `${locale}: ${href[locale]} should be ${href.en}`
        )
      )

    expect(offenders).toEqual([])
  })

  it('still prefixes routes the locale does serve', () => {
    const download = hrefs.find((href) => href.en === '/download')

    expect(download?.['zh-CN']).toBe('/zh-CN/download')
  })
})
