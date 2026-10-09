import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { URL } from 'node:url'
import { parse, stringify } from 'yaml'

const sourcePath = process.argv[2]
if (!sourcePath)
  throw new Error('Pass the exact Cloud services/ingest/openapi.yaml path')
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an OpenAPI mapping')
  return Object.fromEntries(Object.entries(value))
}

const source = record(parse(await readFile(sourcePath, 'utf8')))
const components = record(source.components)
const paths = Object.fromEntries(
  Object.entries(record(source.paths)).filter(([path]) =>
    path.startsWith('/api/test-workflow-library/')
  )
)
const schemas = Object.fromEntries(
  Object.entries(record(components.schemas)).filter(([name]) =>
    name.startsWith('TestWorkflow')
  )
)
await writeFile(
  new URL('../test-workflows.openapi.yaml', import.meta.url),
  stringify({
    openapi: source.openapi,
    info: { title: 'Comfy Cloud Test Workflow Library', version: '1.0.0' },
    paths,
    components: {
      schemas,
      parameters: {
        TestWorkflowCollection: record(components.parameters)
          .TestWorkflowCollection
      }
    }
  })
)
