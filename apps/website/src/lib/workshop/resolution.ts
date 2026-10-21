const RESOLUTIONS = [
  '4K',
  '3K',
  '2K',
  '1.5K',
  '1080p',
  '1K',
  '720p',
  '540p',
  '480p'
] as const
export type Resolution = (typeof RESOLUTIONS)[number]
