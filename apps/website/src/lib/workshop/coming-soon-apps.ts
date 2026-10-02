import type { Locale } from '../../i18n/translations'
import type { CatalogueApp } from './catalogue-apps'
import { ac } from './catalogue-apps'

const UPCOMING = [
  ['move-anything', 'moveAnything', '/images/apps/move-anything/example.jpg'],
  ['relight', 'relight', '/images/apps/relight/example.jpg'],
  [
    'hand-product-swap',
    'handProductSwap',
    '/images/apps/hand-product-swap/result-can.jpg'
  ],
  [
    'background-removal',
    'backgroundRemoval',
    '/images/apps/background-removal/example.jpg'
  ],
  ['virtual-try-on', 'virtualTryOn', '/images/apps/virtual-try-on/person.jpg'],
  ['sprite-sheet', 'spriteSheet', '/images/apps/sprite-sheet/example.png'],
  [
    'paparazzi-me',
    'paparazziMe',
    '/images/apps/paparazzi-me/example-result.jpg'
  ]
] as const

/** Apps still being built, listed without a page of their own yet. */
export function upcomingApps(locale: Locale): readonly CatalogueApp[] {
  return UPCOMING.map(([key, copy, image]) => ({
    key,
    name: ac(`${copy}Name`, locale),
    task: ac(`${copy}Task`, locale),
    image
  }))
}
