import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Job } from '@comfyorg/sdk/low'
import { launchWorkflows } from './workflow-catalogue'
import { workflowGraphSchema } from './workflow-execution'
import { buildWorkflowSnippet, workflowInputs } from './workflow-snippets'

const sources = import.meta.glob('../data/workflows/*.json', {
  eager: true,
  import: 'default'
})
const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})
const job: Job = {
  id: 'job-test',
  started_at: null,
  completed_at: null,
  queue_position: null,
  progress: null,
  error: null,
  status: 'succeeded',
  created_at: '2026-09-21T00:00:00Z',
  expires_at: '2026-09-22T00:00:00Z',
  outputs: [
    {
      node_id: 'output',
      name: 'result.png',
      type: 'image',
      content_type: 'image/png',
      size_bytes: 3,
      id: 'output-1',
      hash: null,
      url: '/api/v2/assets/output-1/content',
      url_expires_at: '2026-09-22T00:00:00Z'
    }
  ],
  urls: {
    self: '/api/v2/jobs/job-test',
    events: '/api/v2/jobs/job-test/events',
    cancel: '/api/v2/jobs/job-test/cancel'
  }
}
const transport = `
const requests = [];
globalThis.fetch = async (target, init = {}) => {
  const url = new URL(target);
  if (url.pathname.startsWith('/api/v2/assets/by-hash/')) return new Response(null, { status: 404 });
  if (url.pathname === '/api/v2/assets') {
    const file = init.body.get('file');
    if (!(file instanceof Blob)) throw new Error('Expected upload bytes');
    return Response.json({ id: 'asset-' + init.body.get('file_path'), hash: init.body.get('expected_hash'), size_bytes: file.size, content_type: file.type, created_at: '2026-09-21T00:00:00Z', url: '/unused', url_expires_at: '2026-09-22T00:00:00Z' }, { status: 201 });
  }
  if (url.pathname === '/api/v2/jobs' && init.method === 'POST') {
    requests.push({ url: url.href, body: JSON.parse(init.body), key: new Headers(init.headers).get('Idempotency-Key') });
    return Response.json(${JSON.stringify(job)}, { status: 201 });
  }
  if (url.pathname === '/api/v2/assets/output-1/content') return new Response(new Uint8Array([1,2,3]), { headers: { 'Content-Type': 'image/png' } });
  if (url.pathname === '/api/v2/jobs/job-test') return Response.json(${JSON.stringify(job)});
  throw new Error('Unexpected request: ' + url.href);
};
console.log = () => {};
`

describe('workflow API snippets', () => {
  it('preserves edited text and uploads media in the cURL deployment example', () => {
    const workflow = launchWorkflows.find(
      (item) => item.execution === 'deployment-demo'
    )!
    const graph = workflowGraphSchema.parse(
      sources[`../data/workflows/${workflow.template}.json`]
    )
    const directory = mkdtempSync(join(tmpdir(), 'workflow-curl-'))
    directories.push(directory)
    writeFileSync(
      join(directory, `${workflow.slug}.api.json`),
      JSON.stringify(graph)
    )
    const prompt =
      'Remove the glass; keep "her" face and don\'t run $(echo injected).'
    const snippet = buildWorkflowSnippet('curl', workflow, graph, {
      '54:9.text': prompt
    })
    const stub = `
curl() {
  local url=""
  for arg in "$@"; do
    case "$arg" in https://*) url="$arg" ;; esac
  done
  case "$url" in
    https://test-deployment.run.comfy.app/api/v2/assets) printf '%s' '{"id":"input-asset"}' ;;
    https://test-deployment.run.comfy.app/api/v2/jobs) cat > submitted.json; printf '%s' '${JSON.stringify(job)}' ;;
    https://test-deployment.run.comfy.app/api/v2/jobs/job-test) printf '%s' '${JSON.stringify(job)}' ;;
    *) return 1 ;;
  esac
}
`
    execFileSync('bash', [], {
      cwd: directory,
      input: stub + snippet,
      env: {
        PATH: process.env.PATH,
        COMFY_API_KEY: 'test-key',
        COMFY_BASE_URL: 'https://test-deployment.run.comfy.app'
      }
    })
    const submitted = JSON.parse(
      readFileSync(join(directory, 'submitted.json'), 'utf8')
    )
    expect(submitted.workflow['54:9'].inputs.text).toBe(prompt)
    expect(submitted.workflow['39'].inputs.file).toEqual({
      __type: 'core/ASSET',
      info: { id: 'input-asset' }
    })
    expect(submitted.extra_data.api_key_comfy_org).toBe('test-key')
  })
  it.for(launchWorkflows)(
    '$slug submits its graph and media through the SDK',
    (workflow) => {
      const graph = workflowGraphSchema.parse(
        sources[`../data/workflows/${workflow.template}.json`]
      )
      const directory = mkdtempSync(join(tmpdir(), 'workflow-snippet-'))
      directories.push(directory)
      symlinkSync(
        join(process.cwd(), 'node_modules'),
        join(directory, 'node_modules'),
        'dir'
      )
      writeFileSync(
        join(directory, `${workflow.slug}.api.json`),
        JSON.stringify(graph)
      )
      const inputs = workflowInputs(workflow, graph)
      for (const input of inputs) {
        expect(Object.hasOwn(graph[input.node].inputs, input.input)).toBe(true)
        if (input.filename)
          writeFileSync(
            join(directory, input.filename),
            new Uint8Array([1, 2, 3])
          )
      }
      for (const [node, value] of Object.entries(graph)) {
        if (
          [
            'LoadImage',
            'LoadImageMask',
            'LoadVideo',
            'LoadAudio',
            'VHS_LoadVideo',
            'VHS_LoadVideoPath'
          ].includes(value.class_type)
        )
          expect(
            inputs.some((input) => input.node === node && input.filename),
            `Missing media binding: ${node} ${value.class_type}`
          ).toBe(true)
      }
      const snippet = buildWorkflowSnippet('typescript', workflow, graph)
      const result = JSON.parse(
        execFileSync(process.execPath, ['--input-type=module', '-'], {
          cwd: directory,
          encoding: 'utf8',
          timeout: 10000,
          input:
            transport +
            snippet +
            '\nprocess.stdout.write(JSON.stringify(requests));',
          env: {
            PATH: process.env.PATH,
            COMFY_API_KEY: 'test-key',
            COMFY_BASE_URL: 'https://test-deployment.run.comfy.app'
          }
        })
      )
      expect(result).toHaveLength(1)
      expect(result[0].url).toBe(
        workflow.execution
          ? 'https://test-deployment.run.comfy.app/api/v2/jobs'
          : 'https://cloud.comfy.org/api/v2/jobs'
      )
      expect(result[0].key).toBeTruthy()
      expect(result[0].body.extra_data.api_key_comfy_org).toBe('test-key')
      for (const input of inputs) {
        const value = result[0].body.workflow[input.node].inputs[input.input]
        if (input.filename)
          expect(value).toMatchObject({
            __type: 'core/ASSET',
            info: { id: `asset-${input.filename}` }
          })
        else expect(value).toEqual(input.value)
      }
      expect([
        ...readFileSync(join(directory, 'results/0-result.png'))
      ]).toEqual([1, 2, 3])
      execFileSync(
        'python3',
        ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'],
        { input: buildWorkflowSnippet('python', workflow, graph) }
      )
      execFileSync('bash', ['-n'], {
        input: buildWorkflowSnippet('curl', workflow, graph)
      })
    }
  )
})
