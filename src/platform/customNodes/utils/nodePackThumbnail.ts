const palettes = [
  { base: '#be123c', accent: '#f43f5e', glow: '#fda4af' },
  { base: '#1d4ed8', accent: '#3b82f6', glow: '#93c5fd' },
  { base: '#047857', accent: '#10b981', glow: '#6ee7b7' },
  { base: '#b45309', accent: '#f59e0b', glow: '#fcd34d' },
  { base: '#6d28d9', accent: '#8b5cf6', glow: '#c4b5fd' },
  { base: '#0f766e', accent: '#14b8a6', glow: '#5eead4' },
  { base: '#0e7490', accent: '#06b6d4', glow: '#67e8f9' },
  { base: '#c2410c', accent: '#f97316', glow: '#fdba74' }
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
    foreground: '#f8fafc',
    background: hash & 8 ? ('solid' as const) : ('gradient' as const),
    motif: motifs[(hash >>> 4) % motifs.length],
    icon: topics.find(([, pattern]) => pattern.test(label))?.[0] ?? 'network',
    monogram:
      Array.from(initials.join('').toUpperCase()).slice(0, 3).join('') || 'CN'
  }
}
