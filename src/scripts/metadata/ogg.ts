import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { parseJsonWithNonFinite } from '@/utils/jsonUtil'

export async function getOggMetadata(file: File) {
  const reader = new FileReader()
  const read_process = new Promise<ArrayBuffer | null>((r) => {
    reader.onload = (event) => r((event?.target?.result as ArrayBuffer) ?? null)
    reader.onerror = () => r(null)
    reader.onabort = () => r(null)
  })
  reader.readAsArrayBuffer(file)
  const arrayBuffer = await read_process
  if (!arrayBuffer) return { prompt: undefined, workflow: undefined }
  const signature = String.fromCharCode(...new Uint8Array(arrayBuffer, 0, 4))
  if (signature !== 'OggS') console.error('Invalid file signature.')
  let oggs = 0
  let header = ''
  while (header.length < arrayBuffer.byteLength) {
    const page = String.fromCharCode(
      ...new Uint8Array(
        arrayBuffer,
        header.length,
        Math.min(4096, arrayBuffer.byteLength - header.length)
      )
    )
    if (page.match('OggS\u0000')) oggs++
    header += page
    if (oggs > 1) break
  }
  let workflow: ComfyWorkflowJSON | undefined
  let prompt: ComfyApiWorkflow | undefined
  let prompt_s = header
    .match(/prompt=(\{.*?(\}.*?\u0000))/s)?.[1]
    ?.match(/\{.*\}/)?.[0]
  if (prompt_s) {
    try {
      prompt = parseJsonWithNonFinite<ComfyApiWorkflow>(prompt_s)
    } catch (e) {
      console.error('Failed to parse Ogg prompt metadata', e)
    }
  }
  let workflow_s = header
    .match(/workflow=(\{.*?(\}.*?\u0000))/s)?.[1]
    ?.match(/\{.*\}/)?.[0]
  if (workflow_s) {
    try {
      workflow = parseJsonWithNonFinite<ComfyWorkflowJSON>(workflow_s)
    } catch (e) {
      console.error('Failed to parse Ogg workflow metadata', e)
    }
  }
  return { prompt, workflow }
}
