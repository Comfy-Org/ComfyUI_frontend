// @vitest-environment node
import { writeFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import { entries } from './export-cms-seed'
import { convertDemoSnapshot } from './catalog-demo-conversion'
import { zContentCatalogRecord } from '@comfyorg/ingest-types/zod'
import { modelSchema } from '@/config/models-catalogue-data'
import { detailSchema } from '@/config/models-page-data'
import { catalogPresentation } from '@/lib/cms/catalog-presentation'
import { jsonObject } from '@/lib/cms/editor-document'

function preservesField(
  before: ReturnType<typeof jsonObject.safeParse>,
  after: ReturnType<typeof jsonObject.safeParse>,
  field: string
) {
  return (
    !before.success ||
    (after.success && isDeepStrictEqual(before.data[field], after.data[field]))
  )
}

describe('explicit site snapshot export', () => {
  it('renders every converted record through the actual website contracts with unchanged inputs and bindings', () => {
    const converted = convertDemoSnapshot(entries)
    const checks = converted.contents.map((item, index) => {
      const original = jsonObject.parse(
        JSON.parse(JSON.stringify(entries[index].data))
      )
      const urls = Object.fromEntries(
        converted.media
          .filter((media) => media.originating_uid === item.uid)
          .map((media) => [
            media.role === 'hero'
              ? '$.hero'
              : media.role === 'hero-poster'
                ? '$.hero_poster'
                : `$.examples[${media.role.replace('example-', '')}].media`,
            media.url
          ])
      )
      const record = zContentCatalogRecord.parse({
        uid: item.uid,
        kind: item.type.toUpperCase(),
        slug: entries[index].slug,
        enabled: true,
        visibility: 'PUBLIC',
        deleted: false,
        revision: 3,
        edit_version: '00000000-0000-4000-8000-000000000032',
        data: { ...item.document, type: item.type, website_media: urls }
      })
      const view = catalogPresentation({
        ...record,
        revision: Number(record.revision)
      })
      const model = modelSchema.safeParse(view)
      const detail =
        item.type === 'app' ? undefined : detailSchema.safeParse(view)
      const parsedView = jsonObject.parse(JSON.parse(JSON.stringify(view)))
      const oldWorkflow = jsonObject.safeParse(original.workflow)
      const newWorkflow = jsonObject.safeParse(parsedView.workflow)
      const oldCloud = jsonObject.safeParse(
        oldWorkflow.success ? oldWorkflow.data.cloud : undefined
      )
      const newCloud = jsonObject.safeParse(
        newWorkflow.success ? newWorkflow.data.cloud : undefined
      )
      return {
        uid: item.uid,
        modelErrors: model.success
          ? []
          : model.error.issues.map(
              (issue) => `${issue.path.join('.')}: ${issue.message}`
            ),
        detailErrors:
          !detail || detail.success
            ? []
            : detail.error.issues.map(
                (issue) => `${issue.path.join('.')}: ${issue.message}`
              ),
        bindingsPreserved: preservesField(oldCloud, newCloud, 'inputBindings'),
        inputsPreserved: preservesField(oldWorkflow, newWorkflow, 'inputs')
      }
    })
    expect(
      checks.filter(
        (item) =>
          item.modelErrors.length ||
          item.detailErrors.length ||
          !item.bindingsPreserved ||
          !item.inputsPreserved
      )
    ).toEqual([])
    expect(converted.contents).toHaveLength(180)
    expect(converted.media).toHaveLength(511)
    expect(
      converted.contents.filter(
        (item) =>
          item.type === 'workflow' &&
          Array.isArray(item.document.workflow_files)
      )
    ).toHaveLength(30)
  })
  it('exports current published website records without changing source files', async () => {
    expect(entries.length).toBeGreaterThan(100)
    if (process.env.CCC_DEMO_EXPORT_FILE)
      await writeFile(
        process.env.CCC_DEMO_EXPORT_FILE,
        JSON.stringify(convertDemoSnapshot(entries)),
        { mode: 0o600 }
      )
    const urls = new Set<string>()
    const walk = (value: unknown) => {
      if (
        typeof value === 'string' &&
        /^https:\/\/(?:media\.comfy\.org|comfy-hub-assets\.comfy\.org)\//.test(
          value
        )
      )
        urls.add(value)
      else if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object')
        Object.values(value).forEach(walk)
    }
    entries.forEach(walk)
    console.log(
      JSON.stringify({
        content: entries.length,
        kinds: Object.fromEntries(
          ['MODEL', 'WORKFLOW', 'APP'].map((kind) => [
            kind,
            entries.filter((entry) => entry.kind === kind).length
          ])
        ),
        mediaURLs: urls.size,
        mediaExtensions: [
          ...new Set(
            [...urls].map((url) => new URL(url).pathname.split('.').at(-1))
          )
        ],
        examples: ['MODEL', 'WORKFLOW', 'APP'].map((kind) => {
          const item = entries.find((item) => item.kind === kind)!
          const data = jsonObject.parse(JSON.parse(JSON.stringify(item.data)))
          const execution = jsonObject.safeParse(data.execution)
          return {
            kind,
            uid: item.uid,
            slug: item.slug,
            keys: Object.keys(item.data),
            execution:
              data.type === 'MODEL' && execution.success
                ? Object.keys(execution.data)
                : undefined
          }
        })
      })
    )
  })
})
