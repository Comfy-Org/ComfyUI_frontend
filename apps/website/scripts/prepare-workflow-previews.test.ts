// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Window } from 'happy-dom'
import { describe, expect, it, onTestFinished } from 'vitest'

import { workflowPreviewSvg } from './prepare-workflow-previews'

const source = {
  nodes: [
    {
      id: 1,
      type: 'LoadImage',
      pos: [-300, 30],
      size: [200, 100],
      outputs: [{ name: 'IMAGE' }]
    },
    {
      id: 2,
      type: 'SaveImage',
      pos: [40, 80],
      size: [250, 130],
      inputs: [{ name: 'images' }]
    }
  ],
  links: [[1, 1, 0, 2, 0, 'IMAGE']]
}

function documentFor(svg: string) {
  const window = new Window()
  onTestFinished(() => window.close())
  return new window.DOMParser().parseFromString(svg, 'image/svg+xml')
}

describe('offline workflow previews', () => {
  it('preserves node positions, dimensions and connections', () => {
    const document = documentFor(workflowPreviewSvg(source))
    const load = document.querySelector('svg svg')
    expect(load?.getAttribute('x')).toBe('-300')
    expect(load?.getAttribute('y')).toBe('4')
    expect(load?.getAttribute('width')).toBe('200')
    expect(document.querySelector('.links path')?.getAttribute('d')).toBe(
      'M-100 44 C-30 44,-30 94,40 94'
    )
    expect(document.documentElement.textContent).toContain('Load Image')
  })

  it('keeps graph text inert and excludes custom content', () => {
    const title =
      '</text><script>alert(1)</script><image href="https://example.com" onload="alert(2)"/>'
    const document = documentFor(
      workflowPreviewSvg({
        ...source,
        nodes: source.nodes.map((node) => ({
          ...node,
          title,
          color: 'url(https://example.com)',
          widgets_values: ['<script>bad()</script>']
        }))
      })
    )
    expect(document.querySelector('script, image, foreignObject, a')).toBeNull()
    expect(
      [...document.querySelectorAll('*')]
        .flatMap((element) => element.getAttributeNames())
        .filter((name) => name.startsWith('on') || name.includes('href'))
    ).toEqual([])
    expect(document.querySelector('.title')?.textContent).toBe(title)
    expect(document.documentElement.textContent).not.toContain('bad()')
  })

  it.for([
    { nodes: [] },
    { nodes: [source.nodes[0], source.nodes[0]] },
    { nodes: [{ ...source.nodes[0], pos: [Number.NaN, 0] }] },
    { nodes: [{ ...source.nodes[0], size: [-20, 30] }] },
    { links: [[1, 1, 5, 2, 0, 'IMAGE']] },
    { links: [[1, 1, 0, 9, 0, 'IMAGE']] }
  ])(
    'rejects malformed geometry and unresolved connections: %j',
    (override) => {
      expect(() => workflowPreviewSvg({ ...source, ...override })).toThrow()
    }
  )

  it.for(['remove-background', 'change-material', 'product-mockup'])(
    'provides the original UI graph and nested preview for %s',
    (name) => {
      const directory = join(import.meta.dirname, '../public/workflow-graphs')
      const raw: unknown = JSON.parse(
        readFileSync(join(directory, `${name}.json`), 'utf8')
      )
      const prepared = readFileSync(join(directory, `${name}.svg`), 'utf8')
      expect(workflowPreviewSvg(raw)).toBe(prepared)
      const document = documentFor(prepared)
      expect(document.querySelectorAll('.heading')).toHaveLength(2)
      expect(document.documentElement.textContent).toContain('Workflow inputs')
      expect(document.documentElement.textContent).toContain('Workflow outputs')
      expect(document.querySelectorAll('.links path').length).toBeGreaterThan(8)
    }
  )
})
