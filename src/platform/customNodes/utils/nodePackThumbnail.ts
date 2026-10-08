const palettes = [
  '[--thumbnail-base:var(--color-ink-900)] [--thumbnail-accent:var(--color-plum-600)] [--thumbnail-glow:var(--color-plum-300)]',
  '[--thumbnail-base:var(--color-charcoal-950)] [--thumbnail-accent:var(--color-azure-600)] [--thumbnail-glow:var(--color-azure-300)]',
  '[--thumbnail-base:var(--color-ocean-900)] [--thumbnail-accent:var(--color-jade-600)] [--thumbnail-glow:var(--color-jade-400)]',
  '[--thumbnail-base:var(--color-ink-800)] [--thumbnail-accent:var(--color-gold-700)] [--thumbnail-glow:var(--color-gold-400)]',
  '[--thumbnail-base:var(--color-charcoal-900)] [--thumbnail-accent:var(--color-coral-700)] [--thumbnail-glow:var(--color-coral-500)]',
  '[--thumbnail-base:var(--color-ink-900)] [--thumbnail-accent:var(--color-magenta-700)] [--thumbnail-glow:var(--color-magenta-300)]',
  '[--thumbnail-base:var(--color-ocean-900)] [--thumbnail-accent:var(--color-ocean-600)] [--thumbnail-glow:var(--color-ocean-300)]',
  '[--thumbnail-base:var(--color-charcoal-950)] [--thumbnail-accent:var(--color-brand-blue)] [--thumbnail-glow:var(--color-brand-yellow)]'
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
    background: hash & 8 ? ('solid' as const) : ('gradient' as const),
    motif: motifs[(hash >>> 4) % motifs.length],
    icon: topics.find(([, pattern]) => pattern.test(label))?.[0] ?? 'network',
    monogram:
      Array.from(initials.join('').toUpperCase()).slice(0, 3).join('') || 'CN'
  }
}
