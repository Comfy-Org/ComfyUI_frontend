import { HUB_CREATORS_PATH, HUB_WORKFLOWS_PATH } from '@/config/hub-paths'

type HubWorkflowsFilter = { capability: string } | { q: string }

/** Same shapes as the comfy-router redirects for the old `/workflows/*` pages. */
export function hubWorkflowsUrl(filter?: HubWorkflowsFilter): string {
  const query = filter
    ? `?${Object.entries(filter)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')}`
    : ''
  return `${HUB_WORKFLOWS_PATH}/${query}`
}

export const hubTagUrl = (tag: string) => hubWorkflowsUrl({ capability: tag })
export const hubModelUrl = (family: string) => hubWorkflowsUrl({ q: family })
export const hubCreatorUrl = (username: string) =>
  `${HUB_CREATORS_PATH}/${encodeURIComponent(username)}/`
