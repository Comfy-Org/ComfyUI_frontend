import { tagSlug } from './tag-aliases'

const HUB = 'https://comfy.org/workflows'

// The one link that still points at the hub this screen is meant to replace:
// opening a workflow in the app goes through it today.
export const hubWorkflowUrl = (name: string) =>
  `${HUB}/${encodeURIComponent(name)}/`
export const hubTagUrl = (tag: string) => `${HUB}/tag/${tagSlug(tag)}/`
export const hubCreatorUrl = (username: string) =>
  `${HUB}/${encodeURIComponent(username)}/`
