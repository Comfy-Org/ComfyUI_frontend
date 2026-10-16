import tailwindcss from '@tailwindcss/vite'
import { join } from 'node:path'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

import { websiteRoot } from '@website/paths'

async function stylesheet(name: string) {
  const entry = '\0catalog-style-entry'
  const result = await build({
    root: websiteRoot,
    configFile: false,
    logLevel: 'silent',
    plugins: [
      ...tailwindcss(),
      {
        name: 'catalog-style-entry',
        resolveId: (id) => (id === entry ? entry : undefined),
        load: (id) =>
          id === entry
            ? `import url from ${JSON.stringify(join(websiteRoot, 'src/styles', name) + '?url')}; console.log(url)`
            : undefined
      }
    ],
    build: {
      write: false,
      minify: false,
      cssMinify: false,
      assetsInlineLimit: 0,
      rolldownOptions: { input: entry }
    }
  })
  if (!('output' in result)) throw new Error('Expected one stylesheet build')
  return result.output
    .filter((file) => file.type === 'asset')
    .filter((file) => file.fileName.endsWith('.css'))
    .map((file) => String(file.source))
    .join('\n')
}

describe('catalog stylesheet delivery', () => {
  it('does not ship staff theme tokens or utilities in public CSS', async () => {
    const css = await stylesheet('global.css')
    expect(css).toContain('--color-primary-comfy-ink:')
    expect(css).not.toContain('--color-admin-')
    expect(css).not.toContain('--font-admin')
    expect(css).not.toContain('.bg-admin-')
  })

  it('builds staff palette and portal surfaces separately', async () => {
    const css = await stylesheet('catalog-staff.css')
    expect(css).toContain('--color-admin-chrome:')
    expect(css).toContain('--color-admin-card: #171718')
    expect(css).toContain('--color-admin-fg: #f3f3f3')
    const palette = css.match(/--color-admin-[\w-]+:[^;]+;/g)?.join('\n')
    expect(palette).toBeDefined()
    expect(palette).not.toContain('var(--color-charcoal-')
    expect(palette).not.toContain('var(--color-smoke-')
    expect(css).toContain('.bg-admin-chrome')
    expect(css).toContain('.font-admin')
    expect(css).toContain('.shadow-admin-popover')
    expect(css).toContain('.shadow-admin-dialog')
    expect(css).toContain('.shadow-admin-drawer')
    expect(css).not.toMatch(/@(import|reference|theme|source|tailwind)\b/)
  })
})
