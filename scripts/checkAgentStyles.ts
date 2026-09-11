import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const agentRoot = 'src/workbench/extensions/agent'
const legacyTheme =
  /(?:agent-(?:surface|fg|border|accent|danger|success|pill)|rounded-agent|--color-agent-|--radius-agent)/

for (const entry of await readdir(agentRoot, {
  recursive: true,
  withFileTypes: true
})) {
  if (!entry.isFile() || !/\.(vue|ts|css)$/.test(entry.name)) continue
  const path = join(entry.parentPath, entry.name)
  const source = await readFile(path, 'utf8')
  assert(!legacyTheme.test(source), `Agent theme alias in ${path}`)
  if (entry.name.endsWith('.css')) {
    assert(!source.includes('@theme'), `Agent theme registration in ${path}`)
  }
}

assert(!(await readFile('package.json', 'utf8')).includes('#agent-theme'))
assert(
  !(await readFile('src/assets/css/style.css', 'utf8')).includes('/agent/')
)

const artifacts = process.argv.slice(2)
assert(
  artifacts.length > 0,
  'Pass built output directories, such as dist or storybook-static'
)

for (const directory of artifacts) {
  const styles: string[] = []
  for (const entry of await readdir(directory, {
    recursive: true,
    withFileTypes: true
  })) {
    if (entry.isFile() && entry.name.endsWith('.css')) {
      styles.push(await readFile(join(entry.parentPath, entry.name), 'utf8'))
    }
  }
  const css = styles.join('\n')
  assert(!legacyTheme.test(css), `Compiled Agent theme alias in ${directory}`)
  assert(
    /prefers-reduced-motion:\s*reduce/.test(css),
    `Missing reduced motion in ${directory}`
  )
  for (const required of [
    '.bg-base-background',
    '.bg-secondary-background',
    '.text-base-foreground',
    '.text-muted-foreground',
    '.border-border-default',
    '.border-border-subtle',
    '.rounded-lg',
    '.rounded-xl',
    '.agent-work-summary',
    '@keyframes agent-collapsible-down',
    '@keyframes agent-collapsible-up',
    '@keyframes agent-shimmer'
  ]) {
    assert(css.includes(required), `Missing ${required} in ${directory}`)
  }
  process.stdout.write(
    `${directory}: semantic utilities and local Agent animations verified\n`
  )
}
