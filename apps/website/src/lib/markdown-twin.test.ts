import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { writeMarkdownTwins } from '../integrations/markdown-twins'
import { htmlToTwin, renderTwin } from './markdown-twin'
import { markdownTwinPath } from './markdown-twin-path'

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <title>Comfy CLI - Drive ComfyUI from your terminal</title>
  <meta name="description" content="The command line for the full ComfyUI engine.">
  <link rel="canonical" href="https://comfy.org/cli/">
</head>
<body>
  <astro-island><nav><a href="/mcp/">Comfy MCP</a><a href="/cloud/">Comfy Cloud</a></nav></astro-island>
  <main>
    <section>
      <h1>Drive ComfyUI from your terminal. <br>Or your agent's.</h1>
      <p>Generate from <a href="/cloud/">Comfy Cloud</a> or <a href="#setup">your own GPU</a> with <strong>comfy-cli</strong>.</p>
      <div aria-hidden="true"><p>Claude Code Codex Cursor</p></div>
      <div aria-hidden="true"><p>Claude Code Codex Cursor</p></div>
      <img src="/img/hero.webp" alt="Terminal session generating a cat">
      <img src="/img/hero.webp" alt="Terminal session generating a cat">
      <img src="/img/decoration.svg" alt="">
      <svg><title>icon</title></svg>
      <video src="/clip.mp4"></video>
      <button>Copy</button>
    </section>
    <section>
      <h2>Set up Comfy CLI</h2>
      <ol>
        <li>Install: <code>pip install comfy-cli</code></li>
        <li>Sign in
          <ul><li>Cloud: <code>comfy cloud login</code></li><li>Local: run <em>comfy setup</em></li></ul>
        </li>
      </ol>
      <pre><code>comfy generate flux-pro \\
  --prompt "a cat"</code></pre>
      <table>
        <tr><th>Plan</th><th>Credits</th></tr>
        <tr><td>Pro</td><td>1,000 | more</td></tr>
      </table>
      <blockquote><p>Method, not magic.</p></blockquote>
    </section>
    <script>window.track()</script>
  </main>
  <footer><h3>Products</h3><a href="/download/">Comfy Desktop</a></footer>
</body>
</html>`

describe('markdownTwinPath', () => {
  it('maps a route to its sibling .md file', () => {
    expect(markdownTwinPath('/')).toBe('/index.md')
    expect(markdownTwinPath('/api')).toBe('/api.md')
    expect(markdownTwinPath('/cloud/pricing/')).toBe('/cloud/pricing.md')
    expect(markdownTwinPath('/zh-CN/cli/')).toBe('/zh-CN/cli.md')
    expect(markdownTwinPath('/api.md')).toBe('/api.md')
  })
})

describe('htmlToTwin', () => {
  const page = htmlToTwin(PAGE, 'https://comfy.org/fallback/')

  it('reads the title, description, language, and canonical URL', () => {
    expect(page.title).toBe('Comfy CLI - Drive ComfyUI from your terminal')
    expect(page.description).toBe(
      'The command line for the full ComfyUI engine.'
    )
    expect(page.lang).toBe('en')
    expect(page.canonical).toBe('https://comfy.org/cli/')
  })

  it('keeps main content and drops chrome, scripts, media, and controls', () => {
    expect(page.body).toContain(
      "# Drive ComfyUI from your terminal. Or your agent's."
    )
    expect(page.body).not.toContain('Comfy MCP')
    expect(page.body).not.toContain('Products')
    expect(page.body).not.toContain('window.track')
    expect(page.body).not.toContain('icon')
    expect(page.body).not.toContain('Copy')
    expect(page.body).not.toContain('clip.mp4')
  })

  it('makes links absolute, drops anchor links, and keeps emphasis', () => {
    expect(page.body).toContain(
      'Generate from [Comfy Cloud](https://comfy.org/cloud/) or your own GPU with **comfy-cli**.'
    )
  })

  it('keeps one copy of an image with alt text and no decorative ones', () => {
    const images = page.body.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []
    expect(images).toEqual([
      '![Terminal session generating a cat](https://comfy.org/img/hero.webp)'
    ])
  })

  it('drops aria-hidden duplicates such as marquee copies', () => {
    expect(page.body).not.toContain('Claude Code Codex Cursor')
  })

  it('renders nested lists, code, tables, and quotes', () => {
    expect(page.body).toContain('1. Install: `pip install comfy-cli`')
    expect(page.body).toContain('2. Sign in')
    expect(page.body).toContain('  - Cloud: `comfy cloud login`')
    expect(page.body).toContain('  - Local: run *comfy setup*')
    expect(page.body).toContain(
      '```\ncomfy generate flux-pro \\\n  --prompt "a cat"\n```'
    )
    expect(page.body).toContain(
      '| Plan | Credits |\n| --- | --- |\n| Pro | 1,000 \\| more |'
    )
    expect(page.body).toContain('> Method, not magic.')
  })

  it('falls back to the route when the page has no canonical link', () => {
    const bare = htmlToTwin(
      '<html><body><main><p>x</p></main></body></html>',
      'https://comfy.org/x/'
    )
    expect(bare.canonical).toBe('https://comfy.org/x/')
    expect(bare.lang).toBe('en')
  })
})

describe('renderTwin', () => {
  it('writes front matter agents can read before the content', () => {
    const twin = renderTwin({
      title: 'Comfy "CLI"',
      description: 'Drive ComfyUI',
      lang: 'zh-CN',
      canonical: 'https://comfy.org/zh-CN/cli/',
      body: '# 标题'
    })
    expect(twin).toBe(
      '---\ntitle: "Comfy \\"CLI\\""\ndescription: "Drive ComfyUI"\ncanonical: https://comfy.org/zh-CN/cli/\nlang: zh-CN\nindex: https://comfy.org/llms.txt\n---\n\n# 标题\n'
    )
  })
})

describe('writeMarkdownTwins', () => {
  it('writes a twin per built page, skipping noindex pages and existing twins', async () => {
    const root = await mkdtemp(join(tmpdir(), 'twins-'))
    const page = (title: string) =>
      `<html lang="en"><head><title>${title}</title></head><body><main><h1>${title}</h1></main></body></html>`
    await mkdir(join(root, 'cli'), { recursive: true })
    await writeFile(join(root, 'cli', 'index.html'), page('CLI'))
    await writeFile(join(root, 'index.html'), page('Home'))
    await writeFile(join(root, '404.html'), page('Not found'))
    await mkdir(join(root, 'payment', 'success'), { recursive: true })
    await writeFile(
      join(root, 'payment', 'success', 'index.html'),
      page('Paid')
    )
    await mkdir(join(root, 'api'), { recursive: true })
    await writeFile(join(root, 'api', 'index.html'), page('API'))
    await writeFile(join(root, 'api.md'), '# hand-written\n')

    const report = await writeMarkdownTwins(root, [
      'cli/',
      '',
      '404',
      'payment/success/',
      'api/',
      'missing/'
    ])

    expect(report.written).toEqual(['/cli.md', '/index.md', '/404.md'])
    expect(report.skipped).toEqual([
      '/payment/success.md',
      '/api.md',
      '/missing.md'
    ])
    expect(await readFile(join(root, 'cli.md'), 'utf8')).toContain(
      'canonical: https://comfy.org/cli/\nlang: en\nindex: https://comfy.org/llms.txt\n---\n\n# CLI\n'
    )
    expect(await readFile(join(root, 'api.md'), 'utf8')).toBe(
      '# hand-written\n'
    )
  })
})
