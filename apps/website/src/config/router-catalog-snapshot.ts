import { z } from 'zod'

export const DOCS_REPO = 'Comfy-Org/docs'

const catalogModelSchema = z.object({
  id: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  docsPath: z
    .string()
    .regex(/^\/development\/comfy-router\/models\/[\w.-]+\/[\w.-]+\/code$/),
  name: z.string().min(1).optional()
})

const providerCoverageRowSchema = z.object({
  name: z.string().min(1),
  docsPath: catalogModelSchema.shape.docsPath,
  id: catalogModelSchema.shape.id,
  comfy: z.string().min(1),
  providers: z.array(z.string().min(1)),
  altProviders: z.array(z.string().min(1))
})

const routerCatalogSnapshotSchema = z
  .object({
    sourceRepo: z.literal(DOCS_REPO),
    sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
    models: z.array(catalogModelSchema).min(1),
    providerCoverage: z.object({
      providers: z.array(z.string().min(1)),
      rows: z.array(providerCoverageRowSchema)
    })
  })
  .superRefine((snapshot, context) => {
    const ids = new Set(snapshot.models.map((model) => model.id))
    const paths = new Set(snapshot.models.map((model) => model.docsPath))
    if (ids.size !== snapshot.models.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['models'],
        message: 'Duplicate catalog model ids'
      })
    }
    if (paths.size !== snapshot.models.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['models'],
        message: 'Duplicate catalog model paths'
      })
    }
    const byPath = new Map(
      snapshot.models.map((model) => [model.docsPath, model.id])
    )
    snapshot.providerCoverage.rows.forEach((row, index) => {
      if (byPath.get(row.docsPath) !== row.id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['providerCoverage', 'rows', index],
          message: 'Coverage row is not a catalog model'
        })
      }
    })
  })

type RouterCatalogSnapshot = z.infer<typeof routerCatalogSnapshotSchema>

const altProviderDocument = z.object({
  'x-comfy-router-alt-providers': z
    .array(z.object({ provider: z.string().min(1) }))
    .default([])
})

const MODEL_LINE =
  /^- \[([^\]]+)\]\((\/development\/(comfy-router\/models\/[\w.-]+\/[\w.-]+)\/code)\): `([^`]+)`$/

interface ListedModel {
  name: string
  id: string
}

function catalogModelLinks(markdown: string): string[] {
  return [
    ...new Set(markdown.match(/comfy-router\/models\/[\w.-]+\/[\w.-]+/g) ?? [])
  ]
}

function parseCatalogModels(
  markdown: string
): z.infer<typeof catalogModelSchema>[] {
  const listed = new Map<string, ListedModel>()
  for (const match of markdown.matchAll(new RegExp(MODEL_LINE.source, 'gm'))) {
    const name = match[1]
    const stem = match[3]
    const id = match[4]
    if (!name || !stem || !id) throw new Error('Malformed catalog model line')
    const previous = listed.get(stem)
    if (previous && (previous.id !== id || previous.name !== name)) {
      throw new Error(`Catalog lists ${stem} more than once`)
    }
    listed.set(stem, { name, id })
  }

  const stems = catalogModelLinks(markdown)
  if (stems.length !== listed.size) {
    throw new Error(
      `Catalog has ${stems.length} model links and ${listed.size} named lines`
    )
  }

  return stems.map((stem) => {
    const item = listed.get(stem)
    if (!item) throw new Error(`Catalog link ${stem} has no model line`)
    return {
      id: item.id,
      docsPath: `/development/${stem}/code`,
      name: item.name
    }
  })
}

function cells(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())
}

function parseProviderCoverage(markdown: string): {
  providers: string[]
  rows: Array<{
    name: string
    docsPath: string
    comfy: string
    providers: string[]
  }>
} {
  const start = markdown.indexOf('## Provider coverage')
  if (start < 0) throw new Error('Missing "## Provider coverage"')
  const lines = markdown
    .slice(start)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
  const [header, , ...body] = lines
  if (!header) throw new Error('Provider coverage table is empty')
  const columns = cells(header).map((column) => column.replaceAll('**', ''))
  if (columns[0] !== 'Model / provider' || columns[1] !== 'Comfy (default)') {
    throw new Error(
      `Unexpected provider coverage header: ${columns.join(' | ')}`
    )
  }
  const providers = columns.slice(2)
  const rows = body.map((line) => {
    const [model, comfy, ...routes] = cells(line)
    if (!model || !comfy) {
      throw new Error(`Unexpected provider coverage row: ${line}`)
    }
    const link = /^\[(.+)\]\((.+)\)$/.exec(model)
    if (!link?.[1] || !link[2])
      throw new Error(`Unexpected model cell: ${model}`)
    return {
      name: link[1],
      docsPath: link[2],
      comfy,
      providers: providers.filter((_, index) => routes[index] !== '-')
    }
  })
  return { providers, rows }
}

function readAltProviders(document: unknown): string[] {
  return altProviderDocument
    .parse(document)
    ['x-comfy-router-alt-providers'].map(({ provider }) => provider)
}

export function readRouterCatalogSnapshot(
  input: unknown
): RouterCatalogSnapshot {
  return routerCatalogSnapshotSchema.parse(input)
}

export async function buildRouterCatalogSnapshot(input: {
  sourceCommit: string
  modelsMarkdown: string
  providersMarkdown: string
  readSchema: (modelId: string) => Promise<unknown>
}): Promise<RouterCatalogSnapshot> {
  const models = parseCatalogModels(input.modelsMarkdown)
  const coverage = parseProviderCoverage(input.providersMarkdown)
  const byPath = new Map(models.map((model) => [model.docsPath, model]))
  const covered = coverage.rows.map((row) => {
    const model = byPath.get(row.docsPath)
    if (!model) {
      throw new Error(
        `Provider coverage names ${row.docsPath}, which is not in the catalog`
      )
    }
    return { row, model }
  })
  const documents = await Promise.all(
    covered.map(({ model }) => input.readSchema(model.id))
  )
  return readRouterCatalogSnapshot({
    sourceRepo: DOCS_REPO,
    sourceCommit: input.sourceCommit,
    models,
    providerCoverage: {
      providers: coverage.providers,
      rows: covered.map(({ row, model }, index) => {
        const document = documents[index]
        return {
          name: row.name,
          docsPath: row.docsPath,
          id: model.id,
          comfy: row.comfy,
          providers: row.providers,
          altProviders: readAltProviders(document)
        }
      })
    }
  })
}
