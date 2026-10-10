import { v5 as uuidv5 } from 'uuid'

import { appModels } from '@/config/workshop-app-content'
import { workshopDisplayEntries } from '@/config/workshop-browse-content'
import { useCaseFor } from '@/config/models-catalogue'
import {
  getWorkshopPageDetail,
  workshopPages
} from '@/config/workshop-page-content'

// Only export the currently published projection. Authored/disabled content
// must never enter a public preview seed, even when it is in the source tree.
export const entries = [...workshopPages, ...appModels].map((model) => {
  const detail = getWorkshopPageDetail(model.slug) ?? model
  const legacyId = workshopDisplayEntries.find(
    (entry) => entry.slug === model.slug
  )?.id
  const uid =
    legacyId && /^[0-9a-f-]{36}$/i.test(legacyId)
      ? legacyId
      : uuidv5(`comfy-site:${legacyId ?? model.slug}`, uuidv5.URL)
  return {
    uid,
    kind:
      model.type === 'APP'
        ? 'APP'
        : model.type === 'CLOUD' || model.type === 'SERVERLESS'
          ? 'WORKFLOW'
          : 'MODEL',
    slug: model.href?.replace(/\/$/, ''),
    enabled: true,
    visibility: 'PUBLIC',
    data: {
      ...detail,
      form: undefined,
      legacy_id: legacyId,
      generation_type: useCaseFor(model),
      use_cases: []
    }
  }
})
