// @vitest-environment node
import type { ContentCatalogRecord } from '@comfyorg/ingest-types'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import CatalogDetailPage from '@/components/workshop/CatalogDetailPage.vue'
import { workflowCloudRequest } from '@/config/workshop-workflow-api'
import { getWorkshopPageDetail } from '@/config/workshop-page-content'
import { loadCatalogDetailPage } from '@/lib/cms/detail-page-server'

const RUN_FOOTER = 'data-testid="workflow-run-footer"'
const STATIC_SLUG = 'change-material'

const download = '00000000-0000-4000-8000-0000000000a1'
const api = '00000000-0000-4000-8000-0000000000a3'
const fileVersion = '00000000-0000-4000-8000-0000000000a2'

// The run fields of cloud's "Example runnable workflow fields" (schema v2),
// plus the API graph and media URLs the catalog read adds.
const runFields = {
  runnable: true,
  workflow_versions: [
    {
      name: 'V1',
      download: { src: 'media', id: download, file_version_uid: fileVersion },
      api: { src: 'media', id: api, file_version_uid: fileVersion }
    }
  ],
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', minLength: 1, default: 'A product photo' },
      image: { type: 'string' }
    },
    required: ['prompt'],
    additionalProperties: false
  },
  inputs: {
    prompt: {
      label: 'Prompt',
      help: 'Describe the image',
      hidden: false,
      advanced: false,
      control: 'text-area'
    },
    image: {
      label: 'Reference image',
      help: 'Optional',
      hidden: false,
      advanced: false,
      control: 'media'
    }
  },
  inputBindings: {
    prompt: {
      encoding: 'scalar',
      targets: [{ nodeId: '6', inputName: 'text' }]
    },
    image: {
      encoding: 'cloud-asset',
      mediaKind: 'image',
      targets: [{ nodeId: '10', inputName: 'image' }]
    }
  },
  output_type: 'image',
  outputs: [{ id: 'image', nodeId: '9', key: 'images', kind: 'image' }],
  compatibility: {
    website: {
      workflow: {
        outputs: [{ id: 'image', nodeId: '9', key: 'images', kind: 'image' }]
      }
    }
  },
  website_api_workflow: {
    '6': { class_type: 'CLIPTextEncode', inputs: { text: '' } },
    '9': { class_type: 'SaveImage', inputs: { images: ['8', 0] } },
    '10': { class_type: 'LoadImage', inputs: { image: '' } }
  },
  website_media: {
    '$.workflow_versions[0].download': `/catalog-media/${download}/${fileVersion}`,
    '$.workflow_versions[0].api': `/catalog-media/${api}/${fileVersion}`
  }
}

function workflowRecord(
  slug: string,
  fields: Record<string, unknown> = {}
): ContentCatalogRecord {
  return {
    uid: '00000000-0000-4000-8000-0000000000c1',
    edit_version: '00000000-0000-4000-8000-0000000000c2',
    kind: 'WORKFLOW',
    slug: `/hub/workflows/${slug}`,
    enabled: true,
    visibility: 'PUBLIC',
    deleted: false,
    revision: 1,
    data: {
      type: 'workflow',
      schema_version: 2,
      slug,
      title: 'Catalog workflow',
      description: 'A workflow read from the catalog',
      source_locale: 'en',
      ...fields
    }
  }
}

function serveRecord(record: ContentCatalogRecord) {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  vi.mocked(fetch).mockImplementation(() =>
    Promise.resolve(
      Response.json({ revision_id: 1, generation: 0, items: [record] })
    )
  )
}

async function loadPage(record: ContentCatalogRecord) {
  serveRecord(record)
  const pathname = `${record.slug}/`
  const load = await loadCatalogDetailPage({}, pathname, 'en')
  if (load.status !== 'ok') throw new Error(`record ${load.status}`)
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h(CatalogDetailPage, {
          path: pathname,
          initial: load.page,
          locale: 'en'
        })
    })
  )
  return { model: load.page.model, html }
}

describe('Run form on a catalog workflow page', () => {
  it('renders a Run form from the record run contract that submits to its API graph', async () => {
    const { model, html } = await loadPage(
      workflowRecord('catalog-runnable', runFields)
    )
    expect(html).toContain(RUN_FOOTER)
    expect(html).toContain('Reference image')
    if (model.type !== 'CLOUD') throw new Error('Not a workflow page')
    expect(
      workflowCloudRequest(model.workflow, {
        workflowId: model.workflow.id,
        definitionVersion: model.workflow.definitionVersion,
        appInputs: { prompt: 'A red chair' }
      })
    ).toMatchObject({ prompt: { '6': { inputs: { text: 'A red chair' } } } })
    expect(model.workflow.outputs).toEqual(runFields.outputs)
  })

  it('shows no Run form for a record without run fields', async () => {
    const { html } = await loadPage(workflowRecord('catalog-download-only'))
    expect(html).not.toContain(RUN_FOOTER)
  })

  it('keeps the static Run form for a Workshop workflow whose record has no run fields', async () => {
    const legacy = getWorkshopPageDetail(`workflows/${STATIC_SLUG}`)
    if (legacy?.type !== 'CLOUD') throw new Error('Static workflow missing')
    const { model, html } = await loadPage(workflowRecord(STATIC_SLUG))
    expect(html).toContain(RUN_FOOTER)
    if (model.type !== 'CLOUD') throw new Error('Not a workflow page')
    expect(model.name).toBe('Catalog workflow')
    expect(model.workflow).toEqual(legacy.workflow)
  })

  it('keeps the record run contract for a Workshop workflow that has one', async () => {
    const { model, html } = await loadPage(
      workflowRecord(STATIC_SLUG, runFields)
    )
    expect(html).toContain(RUN_FOOTER)
    if (model.type !== 'CLOUD') throw new Error('Not a workflow page')
    expect(Object.keys(model.workflow.inputs)).toEqual(['prompt', 'image'])
  })
})
