import { z } from 'astro/zod'

export function validDocumentationURL(value: string) {
  try {
    const url = new URL(value)
    return (
      value === value.trim() &&
      !/[\u0000-\u001f\u007f]/.test(value) &&
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443')
    )
  } catch {
    return false
  }
}

export function validCloudShareURL(value: string) {
  if (!validDocumentationURL(value)) return false
  const url = new URL(value)
  return (
    [
      'cloud.comfy.org',
      'stagingcloud.comfy.org',
      'testcloud.comfy.org'
    ].includes(url.hostname) &&
    url.pathname === '/' &&
    !url.hash &&
    [...url.searchParams.keys()].length === 1 &&
    /^[a-f0-9]{12}$/.test(url.searchParams.get('share') ?? '')
  )
}

export function validWorkflowDownloadURL(value: string) {
  if (
    /^\/(?:preview-media\/[1-9]\d*\/|catalog-media\/)[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(
      value
    )
  )
    return true
  if (/^\/workflow-graphs\/[a-z0-9-]+\.json$/.test(value)) return true
  if (!validDocumentationURL(value)) return false
  const url = new URL(value)
  return (
    !url.hash &&
    ([
      'media.comfy.org',
      'comfy-hub-assets.comfy.org',
      'cdn.jsdelivr.net',
      'raw.githubusercontent.com'
    ].includes(url.hostname) ||
      (url.hostname === 'cloud.comfy.org' &&
        url.pathname.startsWith('/templates/')))
  )
}

export function validAuthorAvatarURL(raw: string) {
  try {
    const url = new URL(raw)
    return (
      url.protocol === 'https:' && !url.username && !url.password && !url.hash
    )
  } catch {
    return false
  }
}

export const workflowCatalogDetailsSchema = z.object({
  locale: z.enum(['en', 'zh-CN', 'ja']),
  cloudShareURL: z.string().refine(validCloudShareURL).optional(),
  documentationURL: z.string().refine(validDocumentationURL).optional(),
  workflowFiles: z
    .array(
      z.object({
        name: z.string().min(1),
        uid: z.uuid(),
        version: z.uuid().optional(),
        href: z.string().refine(validWorkflowDownloadURL)
      })
    )
    .optional(),
  longDescription: z.string().optional(),
  faqs: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      answer: z.string()
    })
  ),
  worksOnCloud: z.boolean().optional(),
  runnable: z.boolean().optional(),
  scriptCode: z
    .object({
      python: z.string().max(60000).optional(),
      typescript: z.string().max(60000).optional(),
      curl: z.string().max(60000).optional()
    })
    .optional(),
  outputType: z
    .enum(['image', 'video', 'audio', '3d', 'text', 'mixed'])
    .optional(),
  models: z.array(
    z.object({ uid: z.string(), name: z.string(), href: z.string().optional() })
  ),
  author: z.string().optional(),
  authorAvatarURL: z.string().refine(validAuthorAvatarURL).optional(),
  runs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  downloads: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .optional()
})

export type WorkflowCatalogDetails = z.output<
  typeof workflowCatalogDetailsSchema
>
