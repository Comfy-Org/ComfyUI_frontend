export async function getOggMetadata(file: File) {
  const reader = new FileReader()
  const read_process = new Promise(
    (r) => (reader.onload = (event) => r(event?.target?.result))
  )
  reader.readAsArrayBuffer(file)
  const arrayBuffer = (await read_process) as ArrayBuffer
  const signature = String.fromCharCode(...new Uint8Array(arrayBuffer, 0, 4))
  if (signature !== 'OggS') console.error('Invalid file signature.')
  let oggs = 0
  let header = ''
  while (header.length < arrayBuffer.byteLength) {
    const page = String.fromCharCode(
      ...new Uint8Array(arrayBuffer, header.length, header.length + 4096)
    )
    if (page.match('OggS\u0000')) oggs++
    header += page
    if (oggs > 1) break
  }
  let workflow, prompt
  const prompt_s = header
    .match(/prompt=(\{.*?(\}.*?\u0000))/s)?.[1]
    ?.match(/\{.*\}/)?.[0]
  if (prompt_s) {
    try {
      prompt = JSON.parse(prompt_s)
    } catch {}
  }
  const workflow_s = header
    .match(/workflow=(\{.*?(\}.*?\u0000))/s)?.[1]
    ?.match(/\{.*\}/)?.[0]
  if (workflow_s) {
    try {
      workflow = JSON.parse(workflow_s)
    } catch {}
  }
  return { prompt, workflow }
}
