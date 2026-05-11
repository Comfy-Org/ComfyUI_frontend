#!/usr/bin/env tsx
/**
 * PKG5 docgen pipeline: TypeDoc → Mintlify MDX
 *
 * Steps:
 * 1. Run TypeDoc with typedoc-plugin-markdown to emit raw markdown into docs-build/raw/
 * 2. Post-process each markdown file:
 *    - Add Mintlify frontmatter (title, description, sidebarTitle, icon)
 *    - Convert ``` fences without lang tag → ```ts
 *    - Replace raw [TypeName] cross-refs with MDX relative links
 *    - Wrap @example blocks in proper code fences
 * 3. Write final .mdx files to docs-build/mintlify/
 * 4. Emit docs-build/mintlify/nav-snippet.json — merges into docs.comfy.org mint.json
 *
 * Run: pnpm --filter @comfyorg/extension-api docs:build
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(__dirname, '..')
const rawDir = path.join(pkgRoot, 'docs-build', 'raw')
const mintlifyDir = path.join(pkgRoot, 'docs-build', 'mintlify')
const watchMode = process.argv.includes('--watch')

// ── Page metadata ────────────────────────────────────────────────────────────
// Controls frontmatter for each generated page. Key = TypeDoc output filename
// stem (lowercased). Unrecognised files get generic metadata.

interface PageMeta {
  title: string
  sidebarTitle?: string
  description: string
  icon?: string
  group: 'core' | 'handles' | 'events' | 'shell' | 'identity' | 'root'
  order: number
}

const PAGE_META: Record<string, PageMeta> = {
  // Top-level overview
  index: {
    title: 'Extension API Overview',
    description: 'TypeScript API reference for ComfyUI custom node extensions.',
    icon: 'puzzle-piece',
    group: 'root',
    order: 0
  },
  // Lifecycle / registration
  defineextension: {
    title: 'defineExtension',
    description: 'Register an app-scoped extension for init, setup, and shell UI contributions.',
    icon: 'code',
    group: 'core',
    order: 1
  },
  definenodeextension: {
    title: 'defineNodeExtension',
    description: 'Register a node-scoped extension reacting to node lifecycle events.',
    icon: 'code',
    group: 'core',
    order: 2
  },
  definewidgetextension: {
    title: 'defineWidgetExtension',
    description: 'Register a custom widget type with its own DOM rendering.',
    icon: 'code',
    group: 'core',
    order: 3
  },
  extensionoptions: {
    title: 'ExtensionOptions',
    description: 'Options object for defineExtension — app-wide lifecycle and shell UI.',
    group: 'core',
    order: 4
  },
  nodeextensionoptions: {
    title: 'NodeExtensionOptions',
    description: 'Options object for defineNodeExtension — node lifecycle hooks.',
    group: 'core',
    order: 5
  },
  widgetextensionoptions: {
    title: 'WidgetExtensionOptions',
    description: 'Options object for defineWidgetExtension — custom widget rendering.',
    group: 'core',
    order: 6
  },
  onnoderemoved: {
    title: 'onNodeRemoved',
    sidebarTitle: 'onNodeRemoved',
    description: 'Implicit-context lifecycle hook: fires when a node is removed from the graph.',
    group: 'core',
    order: 7
  },
  onnodemounted: {
    title: 'onNodeMounted',
    sidebarTitle: 'onNodeMounted',
    description: 'Implicit-context lifecycle hook: fires when a node is fully mounted.',
    group: 'core',
    order: 8
  },
  // Handles
  nodehandle: {
    title: 'NodeHandle',
    description: 'Controlled access to node state, mutations, slots, and events.',
    icon: 'circle-nodes',
    group: 'handles',
    order: 10
  },
  widgethandle: {
    title: 'WidgetHandle',
    description: 'Controlled access to widget state, mutations, and events.',
    icon: 'sliders',
    group: 'handles',
    order: 11
  },
  slotinfo: {
    title: 'SlotInfo',
    description: 'Read-only snapshot of a node slot (input or output).',
    group: 'handles',
    order: 12
  },
  // Events
  nodeexecutedevent: {
    title: 'NodeExecutedEvent',
    description: 'Payload fired when a node finishes execution.',
    group: 'events',
    order: 20
  },
  nodeconnectedevent: {
    title: 'NodeConnectedEvent',
    description: 'Payload fired when a slot connection is made.',
    group: 'events',
    order: 21
  },
  nodedisconnectedevent: {
    title: 'NodeDisconnectedEvent',
    description: 'Payload fired when a slot connection is removed.',
    group: 'events',
    order: 22
  },
  nodepositionchangedevent: {
    title: 'NodePositionChangedEvent',
    description: 'Payload fired when a node is moved on the canvas.',
    group: 'events',
    order: 23
  },
  nodesizechangedevent: {
    title: 'NodeSizeChangedEvent',
    description: 'Payload fired when a node is resized.',
    group: 'events',
    order: 24
  },
  nodemodechangedevent: {
    title: 'NodeModeChangedEvent',
    description: 'Payload fired when a node execution mode changes.',
    group: 'events',
    order: 25
  },
  nodebeforeserializeevent: {
    title: 'NodeBeforeSerializeEvent',
    description: 'Pre-serialization hook payload — override or skip node data.',
    group: 'events',
    order: 26
  },
  widgetvaluechangeevent: {
    title: 'WidgetValueChangeEvent',
    description: 'Payload fired when a widget value changes.',
    group: 'events',
    order: 27
  },
  widgetbeforeserializeevent: {
    title: 'WidgetBeforeSerializeEvent',
    description: 'Pre-serialization hook payload — override or skip widget value.',
    group: 'events',
    order: 28
  },
  widgetbeforequeueevent: {
    title: 'WidgetBeforeQueueEvent',
    description: 'Pre-queue validation payload — call reject() to cancel queue.',
    group: 'events',
    order: 29
  },
  // Shell UI
  sidebartabextension: {
    title: 'SidebarTabExtension',
    description: 'Register a custom sidebar tab.',
    group: 'shell',
    order: 40
  },
  bottompanelextension: {
    title: 'BottomPanelExtension',
    description: 'Register a custom bottom panel tab.',
    group: 'shell',
    order: 41
  },
  toastmanager: {
    title: 'ToastManager',
    description: 'Show toast notifications to the user.',
    group: 'shell',
    order: 42
  },
  commandmanager: {
    title: 'CommandManager',
    description: 'Register keyboard shortcuts and command palette entries.',
    group: 'shell',
    order: 43
  },
  extensionmanager: {
    title: 'ExtensionManager',
    description: 'Access shell UI registration APIs.',
    group: 'shell',
    order: 44
  },
  // Identity
  nodelocatorid: {
    title: 'NodeLocatorId',
    description: 'Branded string ID that uniquely locates a node across graph snapshots.',
    group: 'identity',
    order: 50
  },
  nodeexecutionid: {
    title: 'NodeExecutionId',
    description: 'Branded string ID for a specific node execution run.',
    group: 'identity',
    order: 51
  }
}

const GROUP_LABELS: Record<PageMeta['group'], string> = {
  root: 'Extensions API',
  core: 'Registration',
  handles: 'Handles',
  events: 'Events',
  shell: 'Shell UI',
  identity: 'Identity'
}

// ── Utilities ────────────────────────────────────────────────────────────────

function slug(stem: string): string {
  return stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function metaFor(stem: string): PageMeta {
  const key = stem.toLowerCase().replace(/[^a-z]/g, '')
  return (
    PAGE_META[key] ?? {
      title: stem,
      description: `API reference for ${stem}.`,
      group: 'core',
      order: 99
    }
  )
}

/** Convert TypeDoc raw markdown to Mintlify-compatible MDX. */
function toMintlifyMdx(raw: string, stem: string): string {
  const meta = metaFor(stem)

  // Build frontmatter
  const fm: string[] = [
    `---`,
    `title: "${meta.title}"`,
    ...(meta.sidebarTitle ? [`sidebarTitle: "${meta.sidebarTitle}"`] : []),
    `description: "${meta.description}"`,
    ...(meta.icon ? [`icon: "${meta.icon}"`] : []),
    `---`
  ]

  let body = raw

  // Strip TypeDoc breadcrumb header lines (e.g. "[**@comfyorg/...**](../index.md)\n\n***\n\n[@comfyorg...]...")
  body = body.replace(/^\[.*?\]\(\.\.\/index\.md\)\n+\*+\n+/gm, '')
  body = body.replace(/^\[.*?\]\(\.\.\/index\.md\).*\n+/gm, '')

  // Remove the TypeDoc-generated H1 (we use frontmatter title instead)
  body = body.replace(/^# .+\n+/, '')

  // Ensure opening code fences that have no lang tag get `ts`
  // Only match a ``` that is immediately followed by a newline (opening fence),
  // not a closing fence (which also has just ``` + newline but we can detect
  // by context: opening fences follow non-fence lines; closing fences follow content).
  // Simpler heuristic: replace ``` at start of line only when not already closing a block.
  // We track state via a flag pass instead of a single regex.
  let inBlock = false
  body = body
    .split('\n')
    .map((line) => {
      if (inBlock) {
        if (line.trim() === '```') { inBlock = false; return line }
        return line
      }
      if (line.startsWith('```')) {
        if (line.trim() === '```') {
          // bare opening fence → add ts
          inBlock = true
          return '```ts'
        }
        // has a lang tag already
        inBlock = true
        return line
      }
      return line
    })
    .join('\n')

  // TypeDoc emits `typescript` lang tag; normalize to `ts`
  body = body.replace(/^```typescript\b/gm, '```ts')

  // Fix TypeDoc cross-ref links: [TypeName](../type-alias/TypeName.md) → relative MDX paths
  // Pattern: [Label](../category/FileName.md) → [Label](./filename)
  body = body.replace(
    /\[([^\]]+)\]\(\.\.\/([\w-]+)\/([\w-]+)\.md\)/g,
    (_match, label, _category, file) => `[${label}](./${slug(file)})`
  )
  // Same-dir links
  body = body.replace(
    /\[([^\]]+)\]\(([\w-]+)\.md\)/g,
    (_match, label, file) => `[${label}](./${slug(file)})`
  )

  // TypeDoc wraps @example content in a "## Example" heading; Mintlify prefers
  // code examples to be directly under prose without a sub-heading.
  // Flatten "## Example\n\n```ts" → "```ts"
  body = body.replace(/^## Example\s*\n+/gm, '')

  // Stability tags: render as a <Tip> callout
  body = body.replace(
    /\*\*Stability\*\*: `(stable|experimental|deprecated)`/g,
    (_match, level) => {
      const label =
        level === 'stable'
          ? '<Tip>**Stability:** Stable — part of the public API contract.</Tip>'
          : level === 'experimental'
            ? '<Warning>**Stability:** Experimental — may change before 1.0.</Warning>'
            : '<Warning>**Stability:** Deprecated — will be removed. See migration guide.</Warning>'
      return label
    }
  )

  // @stability TSDoc tag (appears as plain text after TypeDoc strips tags)
  body = body.replace(
    /^Stability: (stable|experimental|deprecated)\s*$/gm,
    (_match, level) => {
      if (level === 'stable') return '<Tip>**Stability:** Stable</Tip>'
      if (level === 'experimental') return '<Warning>**Stability:** Experimental</Warning>'
      return '<Warning>**Stability:** Deprecated</Warning>'
    }
  )

  return [...fm, '', body.trim(), ''].join('\n')
}

// ── Nav snippet builder ───────────────────────────────────────────────────────

interface NavPage {
  group?: string
  pages: (string | NavPage)[]
}

function buildNavSnippet(stems: string[]): NavPage {
  // Sort stems by order then group by category
  const sortedStems = stems.slice().sort((a, b) => metaFor(a).order - metaFor(b).order)
  const sortedByGroup: Record<string, string[]> = {}
  for (const stem of sortedStems) {
    const group = metaFor(stem).group
    if (!sortedByGroup[group]) sortedByGroup[group] = []
    sortedByGroup[group].push(`extensions/api/${slug(stem)}`)
  }

  const groupOrder: PageMeta['group'][] = ['root', 'core', 'handles', 'events', 'shell', 'identity']

  const pages: (string | NavPage)[] = []

  // Overview at top level
  if (sortedByGroup['root']) {
    for (const p of sortedByGroup['root']) pages.push(p)
  }

  for (const grp of groupOrder) {
    if (grp === 'root') continue
    const grpPages = sortedByGroup[grp]
    if (!grpPages?.length) continue
    pages.push({ group: GROUP_LABELS[grp], pages: grpPages })
  }

  return { group: 'Extensions API', pages }
}

// ── Main pipeline ────────────────────────────────────────────────────────────

function runTypedoc(): void {
  console.log('▶ Running TypeDoc...')
  execSync(
    `pnpm exec typedoc --options ${path.join(pkgRoot, 'typedoc.json')} --out ${rawDir}`,
    { cwd: pkgRoot, stdio: 'inherit' }
  )
}

function processFiles(): void {
  if (!fs.existsSync(rawDir)) {
    throw new Error(`TypeDoc output directory not found: ${rawDir}`)
  }

  fs.mkdirSync(mintlifyDir, { recursive: true })

  const mdFiles = fs.readdirSync(rawDir, { recursive: true })
    .filter((f): f is string => typeof f === 'string' && f.endsWith('.md'))

  const stems: string[] = []

  for (const relPath of mdFiles) {
    const src = path.join(rawDir, relPath)
    const stem = path.basename(relPath, '.md')
    const raw = fs.readFileSync(src, 'utf8')
    const mdx = toMintlifyMdx(raw, stem)

    const destName = slug(stem) + '.mdx'
    const dest = path.join(mintlifyDir, destName)
    fs.writeFileSync(dest, mdx)
    console.log(`  ✔ ${relPath} → mintlify/${destName}`)
    stems.push(stem)
  }

  // Write nav snippet
  const nav = buildNavSnippet(stems)
  const navDest = path.join(mintlifyDir, 'nav-snippet.json')
  fs.writeFileSync(navDest, JSON.stringify(nav, null, 2) + '\n')
  console.log(`  ✔ nav-snippet.json`)

  console.log(`\n✅ Mintlify MDX written to: ${mintlifyDir}`)
  console.log(`   ${stems.length} pages + nav-snippet.json`)
}

function run(): void {
  runTypedoc()
  processFiles()
}

if (watchMode) {
  // Simple watch: re-run on change to source files
  console.log('👁  Watch mode — watching src/extension-api/**')
  const srcDir = path.resolve(pkgRoot, '../../src/extension-api')
  let debounce: ReturnType<typeof setTimeout> | null = null

  run()

  fs.watch(srcDir, { recursive: true }, () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      console.log('\n🔄 Source changed — rebuilding...')
      try { run() } catch (e) { console.error(e) }
    }, 500)
  })
} else {
  run()
}
