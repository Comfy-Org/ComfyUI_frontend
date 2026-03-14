import { api } from '@/scripts/api'

/**
 * Upload FormData to marketplace media endpoint with progress tracking.
 * Uses XMLHttpRequest since fetch does not support upload progress events.
 */
export async function uploadMarketplaceMediaWithProgress(
  route: string,
  body: FormData,
  onProgress?: (percent: number) => void
): Promise<Response> {
  const url = api.apiURL(route)
  const headers = await api.getRequestHeaders()

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: new Headers(
            xhr
              .getAllResponseHeaders()
              .split('\r\n')
              .filter(Boolean)
              .map((line) => {
                const [key, ...parts] = line.split(': ')
                return [key, parts.join(': ')]
              }) as [string, string][]
          )
        })
      )
    })

    xhr.addEventListener('error', () =>
      reject(new Error('Network request failed'))
    )
    xhr.addEventListener('abort', () => reject(new Error('Request aborted')))

    xhr.open('POST', url)
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value)
    }
    xhr.send(body)
  })
}
