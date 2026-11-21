import { SVG, cleanupSVG } from '@iconify/tools'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

const iconsDirectory = resolve(import.meta.dirname, '../icons')
const icons = readdirSync(iconsDirectory).filter((name) =>
  name.endsWith('.svg')
)

it.for(icons)('%s sanitizes without warnings', (name) => {
  const svg = new SVG(readFileSync(resolve(iconsDirectory, name), 'utf8'))

  cleanupSVG(svg)

  expect(console.warn).not.toHaveBeenCalled()
})
