import type { CccWebsiteCardsPage } from '@comfyorg/ingest-types'
import { zCccWebsiteCardsPage } from '@comfyorg/ingest-types/zod'

export async function readCatalogCards(
  response: Response
): Promise<CccWebsiteCardsPage | undefined> {
  if (!response.body) return undefined
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 262144) {
        await reader.cancel()
        return undefined
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
    const data: unknown = JSON.parse(text + decoder.decode())
    const parsed = zCccWebsiteCardsPage.safeParse(data)
    if (!parsed.success) return undefined
    const value = parsed.data
    const revision = Number(value.revision_id)
    const generation =
      value.generation === undefined ? undefined : Number(value.generation)
    const items = value.items.map((item) => ({
      ...item,
      revision: Number(item.revision)
    }))
    if (
      !Number.isSafeInteger(revision) ||
      revision < 0 ||
      (generation !== undefined &&
        (!Number.isSafeInteger(generation) || generation < 0)) ||
      items.some(
        (item) =>
          !Number.isSafeInteger(item.revision) ||
          item.revision < 0 ||
          item.revision > revision
      ) ||
      items.length > value.page_size ||
      new Set(items.map((item) => item.uid)).size !== items.length ||
      (value.has_more && !value.next_cursor) ||
      (!value.has_more && value.next_cursor !== undefined)
    )
      return undefined
    return { ...value, revision_id: revision, generation, items }
  } catch {
    return undefined
  } finally {
    reader.releaseLock()
  }
}
