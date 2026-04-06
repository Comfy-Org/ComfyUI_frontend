/**
 * Generates a Cloudflare video frame extraction URL for use as a poster/fallback image.
 * Only works for videos hosted on Cloudflare CDN (engcomfy.com domains).
 * Returns null for local/relative video URLs.
 *
 * @param videoUrl - The video URL (full HTTPS or relative path)
 * @param timeSeconds - The time offset in seconds to extract the frame from (default: 1)
 * @returns The Cloudflare frame extraction URL, or null if not applicable
 */
export function getVideoFrameUrl(
  videoUrl: string,
  timeSeconds: number = 1
): string | null {
  try {
    const parsed = new URL(videoUrl)
    if (!parsed.hostname.includes('engcomfy.com')) return null
    // Insert cdn-cgi/media/mode=frame,time={N}s/ between the origin and the path
    const framePath = `cdn-cgi/media/mode=frame,time=${timeSeconds}s`
    return `${parsed.origin}/${framePath}${parsed.pathname}`
  } catch {
    // Not a valid absolute URL (relative path) -- no Cloudflare extraction available
    return null
  }
}
