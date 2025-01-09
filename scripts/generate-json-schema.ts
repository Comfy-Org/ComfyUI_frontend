import fs from 'fs'
import path from 'path'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { zComfyWorkflow, zComfyWorkflow1 } from '../src/types/comfyWorkflow'

// Convert both workflow schemas to JSON Schema
const workflow04Schema = zodToJsonSchema(zComfyWorkflow, {
  name: 'ComfyWorkflow0_4',
  $refStrategy: 'none'
})

const workflow1Schema = zodToJsonSchema(zComfyWorkflow1, {
  name: 'ComfyWorkflow1_0',
  $refStrategy: 'none'
})

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

console.log('JSON Schemas generated successfully!')
