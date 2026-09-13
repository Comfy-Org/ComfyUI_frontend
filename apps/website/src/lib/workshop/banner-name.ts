// "Recraft V4.1 Pro Text-to-Image" repeats the task chip shown directly
// above the banner heading. When a name ends with its own task label, the
// banner drops the suffix - the full name still stands on the card and the
// model page. One-word labels (the modality fallback: Audio, Video, 3D) are
// left alone: they are real product words in names like "Stable Audio".
// Whitespace is required before the label: a hyphen is not enough, or the
// match starts mid-word ("Context-to-Image") and product names like
// "P-Image" lose their last token.
export function bannerName(name: string, task: string): string {
  const words = task.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return name
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const suffix = new RegExp(`\\s+${escaped.join('[\\s\\-–—]*')}$`, 'i')
  const stripped = name.replace(suffix, '').trim()
  return stripped.length >= 3 ? stripped : name
}
