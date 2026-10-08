const palettes = [
  { base: '#772f3c', accent: '#bc4d5a', glow: '#e8a196' },
  { base: '#244c81', accent: '#3e79b8', glow: '#9abedb' },
  { base: '#255e49', accent: '#3b8b66', glow: '#a2c4a0' },
  { base: '#845126', accent: '#bd803b', glow: '#e3ba75' },
  { base: '#583c7b', accent: '#8660ad', glow: '#bd9bce' },
  { base: '#235d69', accent: '#38889b', glow: '#99c3c8' },
  { base: '#753f61', accent: '#af658a', glow: '#d8a5bf' },
  { base: '#716027', accent: '#a68a3c', glow: '#d5c180' }
] as const

const topics = [
  ['video', /video|frame|animation|animatediff|vhs|\bwan\b/i],
  ['audio', /audio|music|sound|speech|voice/i],
  ['palette', /color|colour|palette|lut\b/i],
  ['text', /text|prompt|wildcard|language|\bllm\b/i],
  ['image', /image|photo|upscal|pixel|mask|segment|inpaint/i],
  ['layers', /model|lora|adapter|checkpoint|gguf|loader/i],
  ['tools', /tool|util|helper|essentials|manager/i]
] as const

const motifs = ['rings', 'tiles', 'diagonal'] as const

export function createNodePackThumbnail(identity: string, name = identity) {
  const key = identity.slice(0, 512).normalize('NFKC').trim().toLowerCase()
  let hash = 2166136261
  for (let index = 0; index < key.length; index++) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619) >>> 0
  }

  const label = name
    .slice(0, 512)
    .normalize('NFKC')
    .replace(/^comfy[\s_-]*ui[\s_-]*/i, '')
  const words =
    label.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').match(/[\p{L}\p{N}]+/gu) ?? []
  const initials =
    words.length > 1
      ? words.slice(0, 3).map((word) => Array.from(word)[0])
      : Array.from(words[0] ?? '').slice(0, 2)

  return {
    palette: palettes[hash % palettes.length],
    foreground: '#f3ede2',
    background: hash & 8 ? ('solid' as const) : ('gradient' as const),
    motif: motifs[(hash >>> 4) % motifs.length],
    icon: topics.find(([, pattern]) => pattern.test(label))?.[0] ?? 'network',
    monogram:
      Array.from(initials.join('').toUpperCase()).slice(0, 3).join('') || 'CN'
  }
}
