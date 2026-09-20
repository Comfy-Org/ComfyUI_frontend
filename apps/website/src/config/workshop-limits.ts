export const MAX_REQUEST_BYTES = 10 * 1024 * 1024
export const MAX_URL_UPLOAD_BYTES = 100_000_000

export function encodedWorkshopFileBytes(file: {
  size: number
  type: string
}): number {
  return 4 * Math.ceil(file.size / 3) + file.type.length + 256
}

export function formatWorkshopUploadLimit(
  bytes: number,
  locale: string
): string {
  const binary = bytes % (1024 * 1024) === 0
  const size = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2
  }).format(bytes / (binary ? 1024 * 1024 : 1_000_000))
  return `${size} ${binary ? 'MiB' : 'MB'}`
}
