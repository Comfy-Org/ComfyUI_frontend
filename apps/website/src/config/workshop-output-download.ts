const OBJECT_URL_LIFETIME_MS = 60_000

function attachmentName(fileName: string): string {
  return fileName.replaceAll(/[^\w.-]/g, '_') || 'output'
}

/** Cloud Storage answers with an attachment disposition on request, which a
 * browser downloads without CORS. V4 signatures cover the query string, so
 * those URLs are left alone. */
export function attachmentUrl(
  url: string,
  fileName: string
): string | undefined {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'storage.googleapis.com' ||
    parsed.searchParams.has('X-Goog-Signature') ||
    parsed.searchParams.has('response-content-disposition')
  )
    return
  const hashAt = url.indexOf('#')
  const base = hashAt === -1 ? url : url.slice(0, hashAt)
  const hash = hashAt === -1 ? '' : url.slice(hashAt)
  const disposition = encodeURIComponent(
    `attachment; filename="${attachmentName(fileName)}"`
  )
  return `${base}${parsed.search ? '&' : '?'}response-content-disposition=${disposition}${hash}`
}

function save(href: string, fileName: string, target?: '_blank'): void {
  const link = document.createElement('a')
  link.href = href
  link.download = attachmentName(fileName)
  link.rel = 'noopener'
  if (target) link.target = target
  document.body.append(link)
  link.click()
  link.remove()
}

export async function downloadOutput(
  url: string,
  fileName: string
): Promise<void> {
  if (url.startsWith('blob:') || url.startsWith('data:'))
    return save(url, fileName)
  const attachment = attachmentUrl(url, fileName)
  if (attachment) return save(attachment, fileName, '_blank')
  try {
    const response = await fetch(url, { credentials: 'omit' })
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)
    const objectUrl = URL.createObjectURL(await response.blob())
    save(objectUrl, fileName)
    setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_LIFETIME_MS)
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}
