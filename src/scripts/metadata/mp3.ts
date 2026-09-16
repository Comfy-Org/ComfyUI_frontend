import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { parseJsonWithNonFinite } from '@/utils/jsonUtil'

const NULL = '\0'

/** Extracts the JSON text from an `<key>\0{...}\0` ID3 text frame. */
function readNullTerminatedJson(header: string, key: string) {
  const frameStart = header.indexOf(`${key}${NULL}{`)
  if (frameStart === -1) return undefined
  const jsonStart = frameStart + key.length + NULL.length
  const jsonEnd = header.indexOf(`}${NULL}`, jsonStart)
  if (jsonEnd === -1) return undefined
  return header.slice(jsonStart, jsonEnd + 1)
}

export async function getMp3Metadata(file: File) {
  const reader = new FileReader()
  const read_process = new Promise<ArrayBuffer | null>((r) => {
    reader.onload = (event) => r((event?.target?.result as ArrayBuffer) ?? null)
    reader.onerror = () => r(null)
    reader.onabort = () => r(null)
  })
  reader.readAsArrayBuffer(file)
  const arrayBuffer = await read_process
  if (!arrayBuffer) return { prompt: undefined, workflow: undefined }
  //https://stackoverflow.com/questions/7302439/how-can-i-determine-that-a-particular-file-is-in-fact-an-mp3-file#7302482
  const sig_bytes = new Uint8Array(arrayBuffer, 0, 3)
  if (
    (sig_bytes[0] != 0xff || sig_bytes[1] != 0xfb) &&
    (sig_bytes[0] != 0x49 || sig_bytes[1] != 0x44 || sig_bytes[2] != 0x33)
  )
    console.error('Invalid file signature.')
  let header = ''
  while (header.length < arrayBuffer.byteLength) {
    const page = String.fromCharCode(
      ...new Uint8Array(
        arrayBuffer,
        header.length,
        Math.min(4096, arrayBuffer.byteLength - header.length)
      )
    )
    header += page
    if (page.match('\u00ff\u00fb')) break
  }
  let workflow: ComfyWorkflowJSON | undefined
  let prompt: ComfyApiWorkflow | undefined
  const prompt_s = readNullTerminatedJson(header, 'prompt')
  if (prompt_s) {
    try {
      prompt = parseJsonWithNonFinite<ComfyApiWorkflow>(prompt_s)
    } catch (e) {
      console.error('Failed to parse MP3 prompt metadata', e)
    }
  }
  const workflow_s = readNullTerminatedJson(header, 'workflow')
  if (workflow_s) {
    try {
      workflow = parseJsonWithNonFinite<ComfyWorkflowJSON>(workflow_s)
    } catch (e) {
      console.error('Failed to parse MP3 workflow metadata', e)
    }
  }
  return { prompt, workflow }
}
