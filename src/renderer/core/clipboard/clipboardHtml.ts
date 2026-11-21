const metadataHtmlPrefix =
  '<meta charset="utf-8"><div><span data-comfy-metadata="'
const legacyMetadataHtmlPrefix =
  '<meta charset="utf-8"><div><span data-metadata="'
const metadataHtmlSuffix =
  '"></span></div><span style="white-space:pre-wrap;">Text</span>'
const chromiumHtmlWrappers = [
  { before: '', after: '' },
  { before: "<meta charset='utf-8'>", after: '' },
  {
    before: '<html>\r\n<body>\r\n<!--StartFragment-->',
    after: '<!--EndFragment-->\r\n</body>\r\n</html>'
  }
]

export function clipboardHtml(data: string): string {
  return `${metadataHtmlPrefix}${encodeClipboardData(data)}${metadataHtmlSuffix}`
}

function between(text: string, before: string, after: string) {
  if (!text.startsWith(before) || !text.endsWith(after)) return undefined
  return text.slice(before.length, text.length - after.length)
}

function readMetadata(html: string): string | undefined {
  return chromiumHtmlWrappers
    .flatMap(({ before, after }) =>
      [metadataHtmlPrefix, legacyMetadataHtmlPrefix].map((prefix) =>
        between(html, before + prefix, metadataHtmlSuffix + after)
      )
    )
    .find((base64Data) => base64Data !== undefined)
}

const clipboardByteChunkSize = 0x8000

function bytesToBinaryString(bytes: Uint8Array): string {
  const chunks: string[] = []

  for (
    let offset = 0;
    offset < bytes.length;
    offset += clipboardByteChunkSize
  ) {
    chunks.push(
      String.fromCharCode(
        ...bytes.subarray(offset, offset + clipboardByteChunkSize)
      )
    )
  }

  return chunks.join('')
}

function encodeClipboardData(data: string): string {
  return btoa(bytesToBinaryString(new TextEncoder().encode(data)))
}

type ClipboardHtmlParse =
  | { status: 'absent' }
  | { status: 'unreadable'; cause: unknown }
  | { status: 'read'; text: string; payload: unknown }

export function parseClipboardHtml(html: string): ClipboardHtmlParse {
  const base64Data = readMetadata(html)
  if (!base64Data) return { status: 'absent' }
  try {
    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
    const text = new TextDecoder().decode(bytes)
    return { status: 'read', text, payload: JSON.parse(text) }
  } catch (cause) {
    return { status: 'unreadable', cause }
  }
}
