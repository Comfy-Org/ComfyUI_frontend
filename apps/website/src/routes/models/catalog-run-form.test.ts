// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { detailSchema } from '@/config/models-page-data'
import { workflowCloudRequest } from '@/config/workshop-workflow-api'
import { getWorkshopPageDetail } from '@/config/workshop-page-content'
import { initialWorkshopPageState } from '@/config/workshop-page-state'
import { catalogPresentation } from '@/lib/cms/catalog-presentation'
import {
  RUN_FOOTER,
  STATIC_SLUG,
  loadPage,
  runFields,
  workflowRecord
} from './catalog-run-form-fixture'
import { prepareModelPage } from './model-page'

const MISMATCH_NOTICE = 'data-testid="workflow-input-mismatch"'

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

describe('static Run form fallback on a Workshop slug', () => {
  it.for([
    {
      shape: 'download versions without an API graph',
      fields: {
        workflow_versions: runFields.workflow_versions,
        website_media: runFields.website_media
      },
      footer: true,
      notice: false
    },
    {
      shape: 'an input schema without input settings',
      fields: { inputSchema: runFields.inputSchema },
      footer: false,
      notice: true
    },
    {
      shape: 'runnable set to false',
      fields: { runnable: false },
      footer: false,
      notice: false
    },
    {
      shape: 'runnable set to false and catalog details that do not parse',
      fields: { runnable: false, script_code: 'print("hi")' },
      footer: false,
      notice: false
    }
  ])(
    'a record with $shape shows Run form: $footer, mismatch notice: $notice',
    async ({ fields, footer, notice }) => {
      const { html } = await loadPage(workflowRecord(STATIC_SLUG, fields))
      expect(html.includes(RUN_FOOTER)).toBe(footer)
      expect(html.includes(MISMATCH_NOTICE)).toBe(notice)
    }
  )

  it('builds the page form from the static workflow it runs', async () => {
    const legacy = getWorkshopPageDetail(`workflows/${STATIC_SLUG}`)
    if (legacy?.type !== 'CLOUD') throw new Error('Static workflow missing')
    const detail = detailSchema.parse(
      catalogPresentation(workflowRecord(STATIC_SLUG))
    )
    const page = await prepareModelPage(detail.slug, 'en', {
      details: [detail],
      models: []
    })
    if (page.kind !== 'page') throw new Error('Expected a page')
    expect(page.model.form).toEqual(legacy.form)
  })

  it('opens with the prefilled example of the static page', async () => {
    const legacy = getWorkshopPageDetail(`workflows/${STATIC_SLUG}`)
    if (!legacy) throw new Error('Static workflow missing')
    const { model } = await loadPage(
      workflowRecord(STATIC_SLUG, {
        examples: [{ name: 'record-example', title: 'Example', values: {} }]
      })
    )
    const { values } = initialWorkshopPageState(model)
    expect(values).toEqual(initialWorkshopPageState(legacy).values)
    expect(values.prompt).toBeTruthy()
  })
})

describe('media upload kind of a catalog workflow input', () => {
  function imageInput(mediaKind: string, hint: Record<string, unknown> = {}) {
    const view = detailSchema.parse(
      catalogPresentation(
        workflowRecord('catalog-media', {
          ...runFields,
          inputs: {
            ...runFields.inputs,
            image: { ...runFields.inputs.image, ...hint }
          },
          inputBindings: {
            ...runFields.inputBindings,
            image: { ...runFields.inputBindings.image, mediaKind }
          }
        })
      )
    )
    if (view.type !== 'CLOUD') throw new Error('Not a workflow page')
    return view.workflow.inputs.image
  }

  it.for(['image', 'video', 'audio'])(
    'uploads the %s kind of its cloud-asset binding',
    (kind) => {
      expect(imageInput(kind).urlUpload).toBe(kind)
    }
  )

  it('keeps the upload kind the input sets itself', () => {
    expect(imageInput('video', { urlUpload: 'image-or-video' }).urlUpload).toBe(
      'image-or-video'
    )
  })
})
