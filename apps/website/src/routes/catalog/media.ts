import type { APIRoute } from 'astro'
import { z } from 'astro/zod'
import { editorHeaders } from '@/lib/cms/editor-server'

export const GET: APIRoute = async (context) => {
  const deny = () => new Response(null, { status: 404, headers: editorHeaders })
  const { uid, version, rev } = context.params
  const preview = context.url.pathname.startsWith('/preview-media/')
  const session = context.locals.catalogAuthoring
  if (
    !z.uuid().safeParse(uid).success ||
    !z.uuid().safeParse(version).success ||
    context.url.search ||
    (context.request.headers.has('Range') &&
      (!preview || context.request.headers.get('Range') !== 'bytes=0-'))
  )
    return deny()
  if (
    preview &&
    (!session ||
      !rev ||
      !/^[1-9]\d*$/.test(rev) ||
      !Number.isSafeInteger(Number(rev)))
  )
    return deny()
  const origin = process.env.SITE_CATALOG_API_URL
  if (!origin || process.env.VERCEL_ENV === 'production') return deny()
  try {
    const response = await fetch(
      new URL(
        preview
          ? `/api/v1/catalog/preview-media/${rev}/${uid}/${version}`
          : `/api/v1/catalog/media/${uid}/${version}`,
        origin
      ),
      {
        ...(preview && session
          ? { headers: { Authorization: `Bearer ${session.credential}` } }
          : {}),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15000)
      }
    )
    if (!response.ok) return deny()
    const type = response.headers.get('Content-Type')
    if (
      !type ||
      (!/^(image\/(png|jpeg|webp)|application\/json)(;|$)/.test(type) &&
        !(preview && /^video\/(mp4|webm)(;|$)/.test(type)))
    ) {
      await response.body?.cancel()
      return deny()
    }
    return new Response(response.body, {
      headers: {
        ...editorHeaders,
        'Content-Type': type,
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch {
    return deny()
  }
}
export const HEAD: APIRoute = async () =>
  new Response(null, { status: 404, headers: editorHeaders })
