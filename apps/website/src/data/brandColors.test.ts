import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { brandColors } from './brandColors'

const require = createRequire(import.meta.url)
const paletteCss = readFileSync(
  require.resolve('@comfyorg/design-system/css/_palette.css'),
  'utf-8'
)

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(
    paletteCss
  )
  if (!match) throw new Error(`token --${name} not found in the design system`)
  return match[1].toLowerCase()
}

const websiteRoot = join(import.meta.dirname, '..', '..')
const repoRoot = join(websiteRoot, '..', '..')
const read = (relative: string) =>
  readFileSync(join(websiteRoot, relative), 'utf-8')
const readRepo = (relative: string) =>
  readFileSync(join(repoRoot, relative), 'utf-8')

const yellowSvgs = [
  'apps/website/public/favicon.svg',
  'apps/website/public/icons/logo.svg',
  'apps/website/public/icons/logomark.svg',
  'apps/website/public/icons/comfyicon.svg',
  'apps/website/public/affiliates/brand/comfy-full-logo-yellow.svg',
  'apps/website/public/affiliates/brand/comfy-color-combo-yellow.svg',
  'apps/website/public/affiliates/brand/comfy-amplified-logo-mark.svg',
  'apps/desktop-ui/public/assets/images/comfy-brand-mark.svg',
  'public/assets/images/comfy-cloud-logo.svg'
]

const inkSvgs = [
  'apps/website/public/favicon.svg',
  'apps/website/public/icons/comfyicon.svg',
  'apps/website/public/affiliates/brand/comfy-color-combo-ink.svg',
  'apps/website/public/affiliates/brand/comfy-full-logo-ink.svg'
]

const brandSvgs = [...new Set([...yellowSvgs, ...inkSvgs])]

interface Rgb {
  r: number
  g: number
  b: number
}

const COLOR_LITERAL =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|(?:ok)?l(?:ab|ch)|color|color-mix)\([^)]*\)/gi

function parseColor(literal: string): Rgb | undefined {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(literal)
  if (hex) {
    const digits = hex[1]
    const rrggbb =
      digits.length === 3 || digits.length === 4
        ? digits.slice(0, 3).replace(/./g, '$&$&')
        : digits.length === 6 || digits.length === 8
          ? digits.slice(0, 6)
          : undefined
    if (!rrggbb) return undefined
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(rrggbb.slice(i, i + 2), 16))
    return { r, g, b }
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(literal)
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] }
  return undefined
}

const toHex = ({ r, g, b }: Rgb) =>
  '#' +
  [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')

const isYellow = ({ r, g, b }: Rgb) => r > 200 && g > 200 && b < 200

const colorsIn = (svg: string) =>
  svg.replace(/url\([^)]*\)/gi, '').match(COLOR_LITERAL) ?? []

function yellowsIn(svg: string): string[] {
  const yellows = colorsIn(svg)
    .map(parseColor)
    .filter((color): color is Rgb => color !== undefined && isYellow(color))
    .map(toHex)
  return [...new Set(yellows)].sort()
}

function unreadableColorsIn(svg: string): string[] {
  const unreadable = colorsIn(svg).filter(
    (literal) => parseColor(literal) === undefined
  )
  return [...new Set(unreadable.map((c) => c.toLowerCase()))].sort()
}

/*
 * Everything asserted here is a place a design-system color has to be written
 * out as a literal, because the consumer cannot read a CSS custom property:
 * a data table rendered as copyable text, a <meta> value the browser parses
 * itself, and standalone SVGs fetched as images. Since they cannot reference
 * the token, these tests are what stops them drifting from it.
 */
describe('brand colors that cannot reference a token', () => {
  it('the /brand palette table matches the design system', () => {
    const expected: Record<string, string> = {
      'Comfy Yellow': token('color-electric-400'),
      'Comfy Ink': token('color-primary-comfy-ink'),
      'Comfy Canvas': token('color-primary-comfy-canvas'),
      'Comfy Plum': token('color-plum-600')
    }

    for (const [name, hex] of Object.entries(expected)) {
      const entry = brandColors.find((c) => c.name === name)
      expect(entry, `${name} missing from brandColors`).toBeDefined()
      expect(entry!.hex.toLowerCase(), `${name} hex`).toBe(hex)
    }
  })

  it('the /brand palette table rgb values agree with its own hex values', () => {
    for (const color of brandColors) {
      const hex = color.hex.replace('#', '')
      const fromHex = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
      const declared = color.rgb.split(',').map((n) => Number(n.trim()))
      expect(declared, `${color.name} rgb`).toEqual(fromHex)
    }
  })

  it('the theme-color meta tag matches comfy-ink', () => {
    const html = read('src/layouts/BaseLayout.astro')
    const meta = /name="theme-color"\s+content="(#[0-9a-fA-F]{6})"/.exec(html)
    expect(meta, 'theme-color meta tag not found').not.toBeNull()
    expect(meta![1].toLowerCase()).toBe(token('color-primary-comfy-ink'))
  })

  it('standalone brand SVGs use the brand yellow', () => {
    const yellow = token('color-electric-400')

    for (const file of yellowSvgs) {
      expect(yellowsIn(readRepo(file)), `${file} yellows`).toEqual([yellow])
    }
  })

  it('every color in a brand SVG is one the yellow check can read', () => {
    for (const file of brandSvgs) {
      expect(
        unreadableColorsIn(readRepo(file)),
        `${file} color syntax`
      ).toEqual([])
    }
  })

  it('standalone brand SVGs use comfy-ink where they are two-tone', () => {
    const ink = token('color-primary-comfy-ink')

    for (const file of inkSvgs) {
      const svg = readRepo(file).toLowerCase()
      expect(svg, `${file} should use ${ink}`).toContain(ink)
    }
  })
})

describe('yellowsIn', () => {
  const yellow = token('color-electric-400')
  const ink = token('color-primary-comfy-ink')
  const retiredYellow = '#f0ff41'
  const someOtherYellow = '#ffff00'

  it('catches a second yellow written as shorthand hex', () => {
    expect(yellowsIn(`<path fill="${yellow}"/><path fill="#ff0"/>`)).toEqual(
      [yellow, someOtherYellow].sort()
    )
  })

  it('catches a retired yellow written as rgb()', () => {
    expect(
      yellowsIn(`<path fill="${yellow}"/><path fill="rgb(240, 255, 65)"/>`)
    ).toEqual([yellow, retiredYellow].sort())
  })

  it('catches a retired yellow written as 8-digit hex', () => {
    expect(
      yellowsIn(`<path fill="${yellow}"/><path fill="${retiredYellow}ff"/>`)
    ).toEqual([yellow, retiredYellow].sort())
  })

  it('ignores colors outside the yellow family', () => {
    expect(
      yellowsIn(`<path fill="${yellow}"/><path fill="${ink}" stroke="none"/>`)
    ).toEqual([yellow])
  })

  it('reports a color syntax it cannot read rather than ignoring it', () => {
    expect(unreadableColorsIn('<path fill="hsl(65 100% 67%)"/>')).toEqual([
      'hsl(65 100% 67%)'
    ])
    expect(unreadableColorsIn(`<path fill="${yellow}"/>`)).toEqual([])
  })

  it('reports a malformed hex literal as unreadable', () => {
    expect(unreadableColorsIn('<path fill="#12345"/>')).toEqual(['#12345'])
    expect(yellowsIn('<path fill="#ffff7"/>')).toEqual([])
  })

  it('finds nothing in markup that carries no color', () => {
    expect(yellowsIn('')).toEqual([])
    expect(unreadableColorsIn('')).toEqual([])
    expect(yellowsIn('<path d="M334.584 -244.988L252.495 -197.594"/>')).toEqual(
      []
    )
    expect(unreadableColorsIn('<path d="M0 0h1v1H0z" fill="none"/>')).toEqual(
      []
    )
  })

  it('does not mistake a url() reference for a color', () => {
    const gradientRef =
      '<defs><linearGradient id="ffee00"/></defs>' +
      `<path fill="${yellow}"/><path fill="url(#ffee00)"/>`
    expect(yellowsIn(gradientRef)).toEqual([yellow])
    expect(unreadableColorsIn(gradientRef)).toEqual([])
  })
})
