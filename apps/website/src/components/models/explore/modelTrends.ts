import { z } from 'zod'

export const modelTrendSnapshotSchema = z.object({
  asOf: z.string().datetime(),
  source: z.literal('comfy-cloud-partner-successes'),
  rows: z.array(
    z.object({
      model: z.string().min(1),
      usersCurrent: z.number().int().nonnegative(),
      usersPrevious: z.number().int().nonnegative(),
      runsCurrent: z.number().int().nonnegative()
    })
  )
})

export const trendModelVersions = [
  {
    id: 'meshy-7.1',
    name: 'Meshy 7.1',
    modality: '3d',
    href: 'https://docs.meshy.ai/en/api/changelog',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/4c4a756a-cd5f-4375-b600-7ecef483c2c9.webp'
  },
  {
    id: 'kling-v3',
    name: 'Kling Video 3.0',
    modality: 'video',
    href: '/hub/models/kling-3-0-text-to-video/',
    mediaSrc:
      'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/api_kling_v3_video-1.webp'
  },
  {
    id: 'eleven_sfx_v2',
    name: 'ElevenLabs Sound Effects V2',
    modality: 'audio',
    href: 'https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/64815598-007c-46a5-bea5-4afefe9032a5.png'
  },
  {
    id: 'eleven_v3',
    name: 'Eleven v3',
    modality: 'audio',
    href: 'https://elevenlabs.io/v3',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/89e72414-ca2d-4c51-bc43-f453e9a52e12.png'
  },
  {
    id: 'seedream-5-0-flash-260915',
    name: 'Seedream 5.0 Flash',
    modality: 'image',
    href: 'https://docs.byteplus.com/en/docs/ModelArk/model-release-announcement',
    mediaSrc: undefined
  },
  {
    id: 'seedream-5-0-pro-260628',
    name: 'Seedream 5.0 Pro',
    modality: 'image',
    href: '/hub/models/seedream-5-0-pro-text-to-image/',
    mediaSrc:
      'https://media.comfy.org/website/workshop/byteplus/seedream-5-pro/editorial-fashion-portrait.png'
  },
  {
    id: 'dreamina-seedance-2-5-260628',
    name: 'Seedance 2.5',
    modality: 'video',
    href: '/hub/models/seedance-2-5-text-to-video/',
    mediaSrc:
      'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/api_seedance2_5_video_editing-1.webp'
  },
  {
    id: 'gemini-3-pro-image',
    name: 'Gemini 3 Pro Image',
    modality: 'image',
    href: '/hub/models/nano-banana-pro-text-to-image/',
    mediaSrc:
      'https://media.comfy.org/website/workshop/vertexai/gemini-3-pro-image/alpine-lake-at-blue-hour.png'
  },
  {
    id: 'hy-image-v3.5-preview',
    name: 'HY Image 3.5 Preview',
    modality: 'image',
    href: '/p/supported-models/hy-image-3-5-preview/',
    mediaSrc:
      'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/api_tencent_hy_image_3_5_preview_image_edit-1.webp'
  }
] as const

export const modelTrendQuery = `
SELECT
  properties.model AS model,
  uniqIf(person_id, timestamp >= toStartOfDay(now()) - INTERVAL 7 DAY) AS users_current,
  uniqIf(person_id, timestamp < toStartOfDay(now()) - INTERVAL 7 DAY) AS users_previous,
  countIf(timestamp >= toStartOfDay(now()) - INTERVAL 7 DAY) AS runs_current
FROM events
WHERE timestamp >= toStartOfDay(now()) - INTERVAL 14 DAY
  AND timestamp < toStartOfDay(now())
  AND event = 'partner_node:api_call_success'
  AND properties.environment = 'cloud'
  AND properties.model IS NOT NULL
  AND properties.model != ''
GROUP BY model
ORDER BY users_current DESC
LIMIT 100
`

export function rankModelTrends(
  snapshot: z.infer<typeof modelTrendSnapshotSchema>,
  now = new Date()
) {
  const age = now.getTime() - Date.parse(snapshot.asOf)
  if (age < 0 || age > 7 * 86400000) return []
  return snapshot.rows
    .flatMap((row) => {
      const version = trendModelVersions.find((model) => model.id === row.model)
      const gain = row.usersCurrent - row.usersPrevious
      return version && row.usersCurrent >= 50 && gain > 0
        ? [
            {
              ...version,
              gain,
              growthPercent:
                row.usersPrevious === 0
                  ? null
                  : Math.round((100 * gain) / row.usersPrevious),
              usersCurrent: row.usersCurrent
            }
          ]
        : []
    })
    .sort(
      (a, b) =>
        b.gain - a.gain ||
        b.usersCurrent - a.usersCurrent ||
        a.id.localeCompare(b.id)
    )
    .slice(0, 8)
}
