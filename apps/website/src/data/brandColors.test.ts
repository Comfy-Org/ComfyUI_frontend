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
const read = (relative: string) =>
  readFileSync(join(websiteRoot, relative), 'utf-8')

interface Rgb {
  r: number
  g: number
  b: number
}

const COLOUR_LITERAL =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|(?:ok)?l(?:ab|ch)|color|color-mix)\([^)]*\)/gi

function parseColour(literal: string): Rgb | undefined {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(literal)
  if (hex) {
    const digits = hex[1]
    const channels =
      digits.length === 3 || digits.length === 4
        ? [...digits.slice(0, 3)].map((c) => c + c)
        : digits.length === 6 || digits.length === 8
          ? [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)]
          : undefined
    if (!channels) return undefined
    const [r, g, b] = channels.map((pair) => parseInt(pair, 16))
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

const coloursIn = (svg: string) => svg.match(COLOUR_LITERAL) ?? []

function yellowsIn(svg: string): string[] {
  const yellows = coloursIn(svg)
    .map(parseColour)
    .filter((colour): colour is Rgb => colour !== undefined && isYellow(colour))
    .map(toHex)
  return [...new Set(yellows)].sort()
}

function unreadableColoursIn(svg: string): string[] {
  const unreadable = coloursIn(svg).filter(
    (literal) => parseColour(literal) === undefined
  )
  return [...new Set(unreadable.map((c) => c.toLowerCase()))].sort()
}

/*
 * Everything asserted here is a place a design-system colour has to be written
 * out as a literal, because the consumer cannot read a CSS custom property:
 * a data table rendered as copyable text, a <meta> value the browser parses
 * itself, and standalone SVGs fetched as images. Since they cannot reference
 * the token, these tests are what stops them drifting from it.
 */
describe('brand colours that cannot reference a token', () => {
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
    for (const colour of brandColors) {
      const hex = colour.hex.replace('#', '')
      const fromHex = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
      const declared = colour.rgb.split(',').map((n) => Number(n.trim()))
      expect(declared, `${colour.name} rgb`).toEqual(fromHex)
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
    const files = [
      'public/favicon.svg',
      'public/icons/logo.svg',
      'public/icons/logomark.svg',
      'public/icons/comfyicon.svg',
      'public/affiliates/brand/comfy-full-logo-yellow.svg',
      'public/affiliates/brand/comfy-color-combo-yellow.svg',
      'public/affiliates/brand/comfy-amplified-logo-mark.svg'
    ]

    for (const file of files) {
      expect(yellowsIn(read(file)), `${file} yellows`).toEqual([yellow])
    }
  })

  it('every colour in a brand SVG is one the yellow check can read', () => {
    const files = [
      'public/favicon.svg',
      'public/icons/logo.svg',
      'public/icons/logomark.svg',
      'public/icons/comfyicon.svg',
      'public/affiliates/brand/comfy-full-logo-yellow.svg',
      'public/affiliates/brand/comfy-color-combo-yellow.svg',
      'public/affiliates/brand/comfy-amplified-logo-mark.svg',
      'public/affiliates/brand/comfy-color-combo-ink.svg',
      'public/affiliates/brand/comfy-full-logo-ink.svg'
    ]

    for (const file of files) {
      expect(unreadableColoursIn(read(file)), `${file} colour syntax`).toEqual(
        []
      )
    }
  })
})

describe('yellowsIn', () => {
  const yellow = '#f2ff59'

  it('catches a stale yellow written as shorthand hex', () => {
    expect(yellowsIn(`<path fill="${yellow}"/><path fill="#ff0"/>`)).toEqual([
      '#f2ff59',
      '#ffff00'
    ])
  })

  it('catches a stale yellow written as rgb()', () => {
    expect(
      yellowsIn(`<path fill="${yellow}"/><path fill="rgb(240, 255, 65)"/>`)
    ).toEqual(['#f0ff41', '#f2ff59'])
  })

  it('catches a stale yellow written as 8-digit hex', () => {
    expect(
      yellowsIn(`<path fill="${yellow}"/><path fill="#f0ff41ff"/>`)
    ).toEqual(['#f0ff41', '#f2ff59'])
  })

  it('ignores colours outside the yellow family', () => {
    expect(
      yellowsIn(`<path fill="${yellow}"/><path fill="#211927" stroke="none"/>`)
    ).toEqual([yellow])
  })

  it('reports a colour syntax it cannot read rather than ignoring it', () => {
    expect(unreadableColoursIn('<path fill="hsl(65 100% 67%)"/>')).toEqual([
      'hsl(65 100% 67%)'
    ])
    expect(unreadableColoursIn(`<path fill="${yellow}"/>`)).toEqual([])
  })

  it('standalone brand SVGs use comfy-ink where they are two-tone', () => {
    const ink = token('color-primary-comfy-ink')
    const files = [
      'public/favicon.svg',
      'public/icons/comfyicon.svg',
      'public/affiliates/brand/comfy-color-combo-ink.svg',
      'public/affiliates/brand/comfy-full-logo-ink.svg'
    ]

    for (const file of files) {
      const svg = read(file).toLowerCase()
      expect(svg, `${file} should use ${ink}`).toContain(ink)
    }
  })
})
