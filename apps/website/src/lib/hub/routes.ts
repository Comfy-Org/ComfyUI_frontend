import { tagSlug } from './tag-aliases'

const HUB = 'https://comfy.org/workflows'
export const HUB_CREATORS_PATH = '/hub/creators'

export const hubTagUrl = (tag: string) => `${HUB}/tag/${tagSlug(tag)}/`
export const hubWorkflowUrl = (shareId: string) =>
  `${HUB}/${shareId}-${shareId}/`
export const hubCreatorUrl = (username: string) =>
  `${HUB_CREATORS_PATH}/${encodeURIComponent(username.toLowerCase())}/`
