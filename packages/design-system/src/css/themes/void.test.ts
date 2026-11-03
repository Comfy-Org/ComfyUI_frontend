import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { build } from 'vite'
import { assert, expect, it } from 'vitest'

const VOID_WITH_COMPONENTS = `
  @import 'tailwindcss' source(none);
  @import './void.css';
  @source '../../components';
  @source not '../../components/**/*.test.ts';
  @source not '../../components/**/*.stories.ts';
  @source not '../../components/**/*.md';
`

async function compileCss(fixture: string) {
  const entry = resolve(import.meta.dirname, 'fixture.css')
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'void-theme-fixture',
        resolveId: (id) => (id === entry ? entry : undefined),
        load: (id) => (id === entry ? fixture : undefined)
      },
      tailwindcss()
    ],
    build: {
      write: false,
      cssMinify: false,
      rollupOptions: { input: entry }
    }
  })
  assert(!Array.isArray(result) && 'output' in result)
  const asset = result.output.find(
    (output) => output.type === 'asset' && output.fileName.endsWith('.css')
  )
  assert(asset?.type === 'asset')
  return asset.source.toString()
}

function utilitySelectors(css: string) {
  const start = css.indexOf('@layer utilities {')
  const end = css.indexOf('\n}', start)
  return new Set(
    Array.from(
      css.slice(start, end).matchAll(/^ {2}(\.[^{}]+?)\s*\{$/gm),
      ([, selectors]) => selectors.split(/(?<!\\),\s*/)
    ).flat()
  )
}

it('generates every utility the components get under the ComfyUI theme', async () => {
  const [comfyWithComponents, comfyWithoutComponents, voidWithComponents] =
    await Promise.all([
      compileCss(`@import '../style.css' source(none);`),
      compileCss(`@import '../theme.css' source(none);`),
      compileCss(VOID_WITH_COMPONENTS)
    ])

  const comfySafelist = utilitySelectors(comfyWithoutComponents)
  const componentSelectors = [...utilitySelectors(comfyWithComponents)].filter(
    (selector) => !comfySafelist.has(selector)
  )
  const voidSelectors = utilitySelectors(voidWithComponents)

  expect(componentSelectors.length).toBeGreaterThan(0)
  expect(
    componentSelectors.filter((selector) => !voidSelectors.has(selector))
  ).toEqual([])
}, 60_000)

it('defines every theme variable the component utilities read', async () => {
  const css = await compileCss(VOID_WITH_COMPONENTS)

  const defined = new Set(
    Array.from(css.matchAll(/(--[\w-]+):/g), ([, name]) => name)
  )
  const read = new Set(
    Array.from(css.matchAll(/var\((--[\w-]+)\)/g), ([, name]) => name)
  )
  const undefinedVariables = [...read].filter(
    (name) =>
      !defined.has(name) &&
      !name.startsWith('--tw-') &&
      !name.startsWith('--reka-')
  )

  expect(undefinedVariables).toEqual([])
}, 60_000)
