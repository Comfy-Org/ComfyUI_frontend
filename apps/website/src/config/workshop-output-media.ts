import type { RunOutput } from './workshop-run'

const EXTENSIONS = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
  ['svg', 'image/svg+xml'],
  ['mp4', 'video/mp4'],
  ['webm', 'video/webm'],
  ['mov', 'video/quicktime'],
  ['mp3', 'audio/mpeg'],
  ['wav', 'audio/wav'],
  ['ogg', 'audio/ogg'],
  ['m4a', 'audio/mp4'],
  ['flac', 'audio/flac'],
  ['glb', 'model/gltf-binary'],
  ['gltf', 'model/gltf+json'],
  ['obj', 'model/obj'],
  ['json', 'application/json'],
  ['txt', 'text/plain']
])

export function isPassiveOutputMime(mime: string): boolean {
  return mime !== 'image/svg+xml' && [...EXTENSIONS.values()].includes(mime)
}

export function outputKind(mime: string): RunOutput['kind'] {
  if (!isPassiveOutputMime(mime)) return 'other'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('model/')) return '3d'
  return 'other'
}

export function outputMimeForUrl(value: string): string {
  const extension =
    new URL(value).pathname.split('.').at(-1)?.toLowerCase() ?? ''
  return EXTENSIONS.get(extension) ?? 'application/octet-stream'
}

export function outputExtension(mime: string): string {
  return [...EXTENSIONS].find(([, type]) => type === mime)?.[0] ?? 'bin'
}

function inlineMime(bytes: Uint8Array): string | undefined {
  const prefix = new TextDecoder('latin1').decode(bytes.subarray(0, 16))
  if (bytes[0] === 0x89 && prefix.slice(1, 4) === 'PNG') return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg'
  if (prefix.startsWith('GIF8')) return 'image/gif'
  if (prefix.startsWith('RIFF') && prefix.slice(8, 12) === 'WEBP')
    return 'image/webp'
  if (prefix.startsWith('RIFF') && prefix.slice(8, 12) === 'WAVE')
    return 'audio/wav'
  if (prefix.startsWith('OggS')) return 'audio/ogg'
  if (prefix.startsWith('fLaC')) return 'audio/flac'
  if (prefix.startsWith('ID3')) return 'audio/mpeg'
  if (prefix.startsWith('glTF')) return 'model/gltf-binary'
  if (prefix.slice(4, 8) === 'ftyp') return 'video/mp4'
  return undefined
}

export function inlineOutput(
  value: string,
  mimeHint?: string
): { bytes: Uint8Array; mime: string } | undefined {
  const dataUrl = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(value)
  const encoded = dataUrl?.[2] ?? value
  const declared = dataUrl?.[1] ?? mimeHint
  if (declared && outputKind(declared) === 'other') return undefined
  if (
    encoded.length < 4 ||
    encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
  )
    return undefined
  try {
    const prefix = Uint8Array.from(atob(encoded.slice(0, 24)), (character) =>
      character.charCodeAt(0)
    )
    const mime = inlineMime(prefix) ?? declared
    if (!mime) return undefined
    return {
      bytes: Uint8Array.from(atob(encoded), (character) =>
        character.charCodeAt(0)
      ),
      mime
    }
  } catch {
    return undefined
  }
}
