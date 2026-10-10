import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const target = process.argv[2]
if (!target) {
  console.error(
    'Usage: pnpm exec tsx apps/website/scripts/export-cms.ts <output.json>'
  )
  process.exitCode = 1
} else {
  const server = await createServer({
    configFile: false,
    root: resolve('apps/website'),
    resolve: {
      alias: {
        '@': resolve('apps/website/src'),
        'astro:env/client': resolve('apps/website/src/test/astroEnv.ts')
      }
    },
    server: { middlewareMode: true }
  })
  try {
    const { entries } = await server.ssrLoadModule(
      '/scripts/export-cms-seed.ts'
    )
    await writeFile(resolve(target), `${JSON.stringify(entries)}\n`)
    process.stdout.write(`Exported ${entries.length} public Hub records\n`)
  } finally {
    await server.close()
  }
}
