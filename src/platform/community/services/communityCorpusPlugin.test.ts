import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  TestWorkflowCollections,
  TestWorkflowPage,
  TestWorkflowSummary
} from '@comfyorg/ingest-types/test-workflows'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createCommunityCorpusHandler } from '../../../../build/plugins/communityCorpusPlugin'

const collection = 'harvey-human-qa'
const backend = 'http://backend.invalid'
const collectionURL = `${backend}/api/test-workflow-library/collections`
const entriesURL = `${collectionURL}/${collection}/entries`
const privateMarker = 'PRIVATE CORPUS FIXTURE'

function summary(number: number): TestWorkflowSummary {
  return {
    workflow_sha256: number.toString(16).padStart(64, '0'),
    metadata_sha256: 'a'.repeat(64),
    name: privateMarker,
    description: 'Unsupported fixture; no render certification',
    tags: ['test'],
    tasks: ['image generation'],
    structural_cluster: 'fixture',
    node_count: 1,
    unresolved_pack_count: 1,
    verified: false
  }
}

const entries = Array.from({ length: 51 }, (_, number) => summary(number))
const indexBytes = JSON.stringify({ entries })
const indexSha256 = createHash('sha256').update(indexBytes).digest('hex')

function listing(collections: TestWorkflowCollections['collections']) {
  return Response.json({
    collections,
    truncated: false
  } satisfies TestWorkflowCollections)
}

function page(records = entries, next_cursor = '', total = entries.length) {
  return Response.json({
    entries: records,
    total,
    verified: 0,
    unresolved: total,
    next_cursor
  } satisfies TestWorkflowPage)
}

describe('private Community corpus collection authorization', () => {
  let directory: string
  const fetchBackend = vi.fn<typeof fetch>()

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'community-corpus-test-'))
    await writeFile(join(directory, 'index.json'), indexBytes)
    fetchBackend.mockImplementation(async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      if (url.href === collectionURL)
        return listing([{ id: collection, count: entries.length }])
      if (url.pathname === new URL(entriesURL).pathname) {
        expect(url.searchParams.get('limit')).toBe('50')
        return url.searchParams.get('cursor') === 'next-page'
          ? page(entries.slice(50))
          : page(entries.slice(0, 50), 'next-page')
      }
      throw new Error('Unexpected backend request')
    })
    vi.stubGlobal('fetch', fetchBackend)
  })

  afterEach(async () => {
    expect(directory.startsWith(join(tmpdir(), 'community-corpus-test-'))).toBe(
      true
    )
    await rm(directory, { recursive: true, force: true })
  })

  function request(path = 'index.json', method = 'GET', authenticated = true) {
    return new Request(`http://qa.invalid/api/community-corpus/${path}`, {
      method,
      headers: authenticated
        ? { authorization: 'Bearer fixture', 'comfy-user': 'workspace-fixture' }
        : {
            'comfy-user': 'workspace-fixture',
            'x-user-email': 'user@comfy.org'
          }
    })
  }

  function handler() {
    return createCommunityCorpusHandler(directory, backend, {
      collection,
      indexSha256
    })
  }

  async function expectDenied(response: Response, status: number) {
    expect(response.status).toBe(status)
    expect(await response.text()).toBe('')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  }

  it('returns exact reviewed index bytes only after the full scoped collection is readable', async () => {
    const response = await handler()(request())
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(indexBytes)
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(fetchBackend).toHaveBeenCalledTimes(3)
    for (const [, options] of fetchBackend.mock.calls) {
      const headers = new Headers(options?.headers)
      expect(headers.get('authorization')).toBe('Bearer fixture')
      expect(headers.get('comfy-user')).toBe('workspace-fixture')
      expect(options?.redirect).toBe('manual')
    }
  })

  it.for([[], [{ id: 'own-unrelated', count: entries.length }]])(
    'withholds the fixed index when list200 contains no exact shared grant: %j',
    async (collections) => {
      fetchBackend.mockResolvedValueOnce(listing(collections))
      await expectDenied(await handler()(request()), 403)
      expect(fetchBackend).toHaveBeenCalledTimes(1)
    }
  )

  it.for([401, 403])(
    'withholds every private asset when the scoped read returns %i despite list200',
    async (status) => {
      fetchBackend.mockResolvedValueOnce(
        listing([{ id: collection, count: entries.length }])
      )
      fetchBackend.mockResolvedValueOnce(new Response(null, { status }))
      await expectDenied(await handler()(request()), status)
      expect(fetchBackend).toHaveBeenCalledTimes(2)
    }
  )

  it('withholds an index with a different reviewed byte digest', async () => {
    await writeFile(join(directory, 'index.json'), `${indexBytes}\n`)
    await expectDenied(await handler()(request()), 503)
    expect(fetchBackend).toHaveBeenCalledTimes(1)
  })

  it('rejects an unrelated native collection with the same count', async () => {
    fetchBackend.mockResolvedValueOnce(
      listing([{ id: collection, count: entries.length }])
    )
    fetchBackend.mockResolvedValueOnce(page([summary(999)], '', entries.length))
    await expectDenied(await handler()(request()), 503)
  })

  it.for(['missing', 'duplicate', 'repeated-cursor', 'changed-total'])(
    'withholds an incomplete or inconsistent native snapshot: %s',
    async (failure) => {
      fetchBackend.mockResolvedValueOnce(
        listing([{ id: collection, count: entries.length }])
      )
      fetchBackend.mockResolvedValueOnce(
        page(entries.slice(0, 50), failure === 'missing' ? '' : 'next-page')
      )
      if (failure !== 'missing')
        fetchBackend.mockResolvedValueOnce(
          page(
            failure === 'duplicate' ? [entries[0]] : entries.slice(50),
            failure === 'repeated-cursor' ? 'next-page' : '',
            failure === 'changed-total' ? entries.length + 1 : entries.length
          )
        )
      await expectDenied(await handler()(request()), 503)
    }
  )

  it('does not reuse a prior account grant for a later denied request', async () => {
    const serve = handler()
    expect((await serve(request())).status).toBe(200)
    fetchBackend.mockResolvedValueOnce(listing([]))
    await expectDenied(await serve(request()), 403)
  })

  it('requires operator collection and index binding instead of accepting browser claims', async () => {
    const serve = createCommunityCorpusHandler(directory, backend)
    await expectDenied(await serve(request()), 503)
    expect(fetchBackend).not.toHaveBeenCalled()
  })

  it('does not trust email/workspace headers as authentication', async () => {
    await expectDenied(
      await handler()(request('index.json', 'GET', false)),
      401
    )
    expect(fetchBackend).not.toHaveBeenCalled()
  })

  it.for([401, 403, 500, 302])(
    'withholds private bytes after listing failure %i',
    async (status) => {
      fetchBackend.mockResolvedValueOnce(new Response(null, { status }))
      await expectDenied(
        await handler()(request()),
        status === 401 || status === 403 ? status : 503
      )
    }
  )

  it('fails closed on malformed native JSON or a network failure', async () => {
    fetchBackend.mockResolvedValueOnce(new Response('not JSON'))
    await expectDenied(await handler()(request()), 503)
    fetchBackend.mockRejectedValueOnce(new Error('Unavailable'))
    await expectDenied(await handler()(request()), 503)
  })

  it('rejects oversized native bodies without serving the private index', async () => {
    fetchBackend.mockResolvedValueOnce(
      new Response(' '.repeat(8 * 1024 * 1024 + 1))
    )
    await expectDenied(await handler()(request()), 503)
  })

  it('requires a new grant for HEAD and for each indexed graph or detail', async () => {
    const id = entries[0].workflow_sha256
    await mkdir(join(directory, id))
    await writeFile(join(directory, id, 'workflow.json'), '{"private":"graph"}')
    await writeFile(join(directory, id, 'detail.json'), '{"private":"detail"}')
    const serve = handler()
    const head = await serve(request('index.json', 'HEAD'))
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
    expect(await (await serve(request(`${id}/workflow.json`))).text()).toBe(
      '{"private":"graph"}'
    )
    fetchBackend.mockResolvedValueOnce(listing([]))
    await expectDenied(await serve(request(`${id}/detail.json`)), 403)
    expect(fetchBackend).toHaveBeenCalledTimes(7)
  })

  it('withholds files whose graph identity is not in the bound native snapshot', async () => {
    const id = summary(999).workflow_sha256
    await mkdir(join(directory, id))
    await writeFile(join(directory, id, 'detail.json'), privateMarker)
    await expectDenied(await handler()(request(`${id}/detail.json`)), 404)
  })

  it('leaves a deployment without a private corpus directory unavailable', async () => {
    await expectDenied(
      await createCommunityCorpusHandler(undefined, backend)(request()),
      404
    )
    expect(fetchBackend).not.toHaveBeenCalled()
  })

  it('rejects unlisted paths and mutation methods without backend or private access', async () => {
    await expectDenied(await handler()(request('unlisted.json')), 404)
    await expectDenied(await handler()(request('index.json', 'POST')), 405)
    expect(fetchBackend).not.toHaveBeenCalled()
  })
})
