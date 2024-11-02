import { readdirSync, readFileSync } from 'fs'
import lg from '../../utils/litegraph'
import path from 'path'
import { start } from '../../utils'

const WORKFLOW_DIR = 'tests-ui/workflows/examples'

// Resolve basic differences in old prompts
function fixLegacyPrompt(prompt: { inputs: any }) {
  for (const n of Object.values(prompt)) {
    const { inputs } = n

    // Added inputs
    if (n.class_type === 'VAEEncodeForInpaint') {
      if (n.inputs['grow_mask_by'] == null) n.inputs['grow_mask_by'] = 6
    } else if (n.class_type === 'SDTurboScheduler') {
      if (n.inputs['denoise'] == null) n.inputs['denoise'] = 1
    }

    // This has been renamed
    if (inputs['choose file to upload']) {
      const v = inputs['choose file to upload']
      delete inputs['choose file to upload']
      inputs['upload'] = v
    }

    delete n['is_changed']
  }
  return prompt
}

describe('example workflows', () => {
  beforeEach(() => {
    lg.setup(global)
  })

  afterEach(() => {
    lg.teardown(global)
  })

  const workflowFiles = readdirSync(WORKFLOW_DIR).filter((file) =>
    file.endsWith('.json')
  )

  const workflows = workflowFiles.map((file) => {
    const { workflow, prompt } = JSON.parse(
      readFileSync(path.resolve(WORKFLOW_DIR, file), 'utf8')
    )

    let skip = false
    let parsedWorkflow
    try {
      // Workflows with group nodes dont generate the same IDs as the examples
      // they'll need recreating so skip them for now.
      parsedWorkflow = JSON.parse(workflow)
      skip = !!Object.keys(parsedWorkflow?.extra?.groupNodes ?? {}).length
    } catch (error) {}

    // https://github.com/comfyanonymous/ComfyUI_examples/issues/40
    if (file === 'audio_stable_audio_example.flac.json') {
      skip = true
    }

    return { file, workflow, prompt, parsedWorkflow, skip }
  })

  describe.each(workflows)(
    'Workflow Test: %s',
    ({ file, workflow, prompt, parsedWorkflow, skip }) => {
      ;(skip ? test.skip : test)(
        'correctly generates prompt json for ' + file,
        async () => {
          if (!workflow || !prompt) throw new Error('Invalid example json')

          const { app } = await start()
          await app.loadGraphData(parsedWorkflow)

          const output = await app.graphToPrompt()
          expect(output.output).toEqual(fixLegacyPrompt(JSON.parse(prompt)))
        }
      )
    }
  )
})
