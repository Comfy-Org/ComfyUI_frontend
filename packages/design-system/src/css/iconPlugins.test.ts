import path from 'node:path'
import { compile } from 'tailwindcss'
import { describe, expect, it } from 'vitest'

async function buildIconCss(plugin: string, candidate: string) {
  const compiler = await compile(
    `@plugin "./${plugin}";\n@tailwind utilities;`,
    {
      base: import.meta.dirname,
      loadModule: async (id, base) => {
        const file = path.resolve(base, id)
        return {
          path: file,
          base: path.dirname(file),
          module: (await import(file)).default
        }
      }
    }
  )
  return compiler.build([candidate])
}

describe('icon utilities in forced-colors mode', () => {
  it.for([
    {
      name: 'Lucide icon',
      plugin: 'iconifyDynamicPlugin.ts',
      candidate: 'icon-[lucide--settings]'
    },
    {
      name: 'Comfy icon',
      plugin: 'iconifyDynamicPlugin.ts',
      candidate: 'icon-[comfy--node]'
    },
    {
      name: 'mask icon',
      plugin: 'iconifyDynamicPlugin.ts',
      candidate: 'icon-mask-[comfy--node]'
    },
    {
      name: 'stroke-width icon',
      plugin: 'lucideStrokePlugin.js',
      candidate: 'icon-s1.5-[lucide--settings]'
    }
  ])(
    'paints a $name in the theme text color',
    async ({ plugin, candidate }) => {
      const css = await buildIconCss(plugin, candidate)

      expect(css).toContain('@media (forced-colors: active)')
      expect(css).toContain('forced-color-adjust: none')
      expect(css).toContain('background-color: CanvasText')
    }
  )

  it('leaves image-based icons in their own colors', async () => {
    const css = await buildIconCss(
      'iconifyDynamicPlugin.ts',
      'icon-img-[comfy--node]'
    )

    expect(css).toContain('icon-img-')
    expect(css).not.toContain('forced-colors')
  })
})
