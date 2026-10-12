import fs from 'fs'
import path from 'path'
import { z } from 'zod'

import {
  zComfyWorkflow,
  zComfyWorkflow1
} from '../src/platform/workflow/validation/schemas/workflowSchema'
import { zComfyNodeDef as zComfyNodeDefV2 } from '../src/schemas/nodeDef/nodeDefSchemaV2'
import { zComfyNodeDef as zComfyNodeDefV1 } from '../src/schemas/nodeDefSchema'

function toNamedJsonSchema(schema: z.ZodType, title: string) {
  return {
    title,
    ...z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
  }
}

// Convert both workflow schemas to JSON Schema
const workflow04Schema = toNamedJsonSchema(zComfyWorkflow, 'ComfyWorkflow0_4')

const workflow1Schema = toNamedJsonSchema(zComfyWorkflow1, 'ComfyWorkflow1_0')

const nodeDefV1Schema = toNamedJsonSchema(zComfyNodeDefV1, 'ComfyNodeDefV1')

const nodeDefV2Schema = toNamedJsonSchema(zComfyNodeDefV2, 'ComfyNodeDefV2')

// Create output directory if it doesn't exist
const outputDir = './schemas'
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Write schemas to files
fs.writeFileSync(
  path.join(outputDir, 'workflow-0_4.json'),
  JSON.stringify(workflow04Schema, null, 2)
)

fs.writeFileSync(
  path.join(outputDir, 'workflow-1_0.json'),
  JSON.stringify(workflow1Schema, null, 2)
)

fs.writeFileSync(
  path.join(outputDir, 'node-def-v1.json'),
  JSON.stringify(nodeDefV1Schema, null, 2)
)

fs.writeFileSync(
  path.join(outputDir, 'node-def-v2.json'),
  JSON.stringify(nodeDefV2Schema, null, 2)
)

console.log('JSON Schemas generated successfully!')
