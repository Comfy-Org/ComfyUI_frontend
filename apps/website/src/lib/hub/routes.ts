import { tagSlug } from './tag-aliases'

const HUB = 'https://comfy.org/workflows'

export const hubWorkflowUrl = (name: string) => `${HUB}/${name}/`
export const hubTagUrl = (tag: string) => `${HUB}/tag/${tagSlug(tag)}/`
export const hubCreatorUrl = (username: string) =>
  `${HUB}/${encodeURIComponent(username)}/`
