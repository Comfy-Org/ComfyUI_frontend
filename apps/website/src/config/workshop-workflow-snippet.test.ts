// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assert, describe, expect, it } from 'vitest'

import { prepareWorkflowRender } from './workflow-render'
import { workflowCloudRequest } from './workshop-workflow-api'
import { initialWorkshopPageState } from './workshop-page-state'
import { urlUploadField } from './workshop-playground'
import { workflowDetailsBySlug } from './workshop-workflow-content'
import {
  workflowCurl,
  workflowPython,
  workflowSdkPlan,
  workflowSnippetRequest,
  workflowTypeScript
} from './workshop-workflow-snippet'

describe('workflow API snippets', () => {
  it.for([...workflowDetailsBySlug.values()])(
    'matches browser defaults for $slug',
    async (model) => {
      const initial = initialWorkshopPageState(model)
      const inputs = Object.fromEntries(
        initial.schema
          .filter(urlUploadField)
          .map((field) => [field.name, 'https://media.example/' + field.name])
      )
      const request = workflowSnippetRequest(model, inputs)
      const prepared = await prepareWorkflowRender(
        model,
        inputs,
        new AbortController().signal,
        async (source) =>
          'UPLOADED_' + new URL(String(source)).pathname.slice(1) + '_FILENAME'
      )
      expect(request).toEqual({
        ...workflowCloudRequest(model.workflow, prepared),
        extra_data: { api_key_comfy_org: 'YOUR_API_KEY' }
      })
    }
  )

  it.for([...workflowDetailsBySlug.values()])(
    'sets the inputs the browser uploads and saves every output for $slug',
    async (model) => {
      const initial = initialWorkshopPageState(model)
      const inputs = Object.fromEntries(
        initial.schema
          .filter(urlUploadField)
          .map((field) => [field.name, 'https://media.example/' + field.name])
      )
      const uploaded = (url: string) => 'uploaded:' + url
      const plan = workflowSdkPlan(
        model,
        inputs,
        workflowSnippetRequest(model, inputs)
      )
      const prepared = await prepareWorkflowRender(
        model,
        inputs,
        new AbortController().signal,
        async (source) => uploaded(String(source))
      )
      const graph = structuredClone(plan.graph)
      for (const upload of plan.uploads) {
        const node = graph[upload.nodeId]
        assert(typeof node === 'object' && node !== null && 'inputs' in node)
        Reflect.set(Object(node.inputs), upload.input, uploaded(upload.url))
      }

      expect(graph).toEqual(
        workflowCloudRequest(model.workflow, prepared).prompt
      )
      expect(plan.outputNodeIds.length).toBeGreaterThan(0)
      expect(plan.outputNodeIds.filter((id) => !(id in graph))).toEqual([])
    }
  )

  it.for([...workflowDetailsBySlug.values()])(
    'writes SDK snippets that parse and pass the key to run() for $slug',
    (model) => {
      const values = initialWorkshopPageState(model).values
      const plan = workflowSdkPlan(
        model,
        values,
        workflowSnippetRequest(model, values)
      )
      const code = workflowTypeScript(plan)
      const file = join(mkdtempSync(join(tmpdir(), 'sdk-')), 'snippet.mjs')
      writeFileSync(file, code)

      expect(() =>
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
      ).not.toThrow()
      expect(code).toContain('await client.run(workflow, { apiKey })')
      expect(workflowPython(plan)).toContain(
        'client.run(workflow, api_key=api_key)'
      )
    }
  )

  it('fills a picked file from its source URL and a local one from a stand-in', () => {
    const model = workflowDetailsBySlug.get('workflows/remove-object')
    assert(model)
    const file = { name: 'photo.png', size: 1, type: 'image/png' }
    const values = {
      image: { ...file, sourceUrl: 'https://media.example/photo.png' },
      mask: file
    }
    const plan = workflowSdkPlan(
      model,
      values,
      workflowSnippetRequest(model, values)
    )

    expect(plan.uploads.map(({ url }) => url)).toEqual([
      'https://media.example/photo.png',
      'https://example.com/replace-with-a-url/mask'
    ])
    expect(workflowPython(plan)).toContain(
      'client.assets.from_url("https://example.com/replace-with-a-url/mask")'
    )
    expect(workflowTypeScript(plan)).toContain(
      '// Replace each example.com URL with a public URL of your file.'
    )
  })

  it('quotes the exact Cloud request without executing prompt text', () => {
    const model = workflowDetailsBySlug.get('workflows/change-material')
    if (!model) throw new Error('Missing fixture')
    const request = workflowSnippetRequest(model, {
      prompt:
        "Keep 'single quotes', $(printf changed), `printf changed`, and\nnewlines."
    })
    const code = workflowCurl(request)
    const args = execFileSync(
      'sh',
      ['-c', `curl() { printf '%s\\n' "$@"; }\n${code}`],
      { encoding: 'utf8' }
    )
    expect(JSON.parse(args.split('--data\n')[1])).toEqual(request)
    expect(args).toContain('X-API-Key: YOUR_API_KEY\n')
    expect(args).toContain('/api/prompt')
    expect(args).not.toContain('base64')
  })
})
