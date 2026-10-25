import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { build } from 'vite'
import { assert, expect, it } from 'vitest'

it('compiles size-4 icon defaults with explicit sizing overrides', async () => {
  const entry = resolve(import.meta.dirname, 'icon-sizing.css')
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'icon-sizing-fixture',
        resolveId: (id) => (id === entry ? entry : undefined),
        load: (id) =>
          id === entry
            ? `
              @layer theme, components, utilities;
              @import 'tailwindcss/theme' layer(theme);
              @import 'tailwindcss/utilities' layer(utilities) source(none);
              @plugin './iconifyDynamicPlugin.ts';
              @plugin './lucideStrokePlugin.js';
              @source inline('icon-[lucide--check] icon-img-[comfy--comfy-logo] icon-mask-[comfy--comfy-logo] icon-s1.5-[lucide--check] size-3 size-6 w-8 h-5');
            `
            : undefined
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
    (entry) => entry.type === 'asset' && entry.fileName.endsWith('.css')
  )
  assert(asset?.type === 'asset')
  const rules = new Map(
    Array.from(
      asset.source.toString().matchAll(/([^{}]+)\{([^{}]*)\}/g),
      ([, selector, body]) => [
        selector.trim().replaceAll('\\', ''),
        Object.fromEntries(
          Array.from(
            body.matchAll(/([\w-]+):\s*([^;]+);/g),
            ([, property, value]) => [property, value]
          )
        )
      ]
    )
  )

  expect(
    [
      '.icon-[lucide--check]',
      '.icon-img-[comfy--comfy-logo]',
      '.icon-mask-[comfy--comfy-logo]',
      '.icon-s1.5-[lucide--check]'
    ].map((selector) => {
      const rule = rules.get(selector)
      return [rule?.width, rule?.height]
    })
  ).toEqual(
    Array(4).fill(['calc(var(--spacing) * 4)', 'calc(var(--spacing) * 4)'])
  )
  expect(rules.get('.size-3')).toEqual({
    width: 'calc(var(--spacing) * 3)',
    height: 'calc(var(--spacing) * 3)'
  })
  expect(rules.get('.size-6')).toEqual({
    width: 'calc(var(--spacing) * 6)',
    height: 'calc(var(--spacing) * 6)'
  })
  expect(rules.get('.w-8')?.width).toBe('calc(var(--spacing) * 8)')
  expect(rules.get('.h-5')?.height).toBe('calc(var(--spacing) * 5)')
})
