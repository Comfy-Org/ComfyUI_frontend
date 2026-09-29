export type ModelPageLaunch = 'all' | ReadonlySet<string>

// Emergency rollback: replace 'all' with a set of Router model ids to keep indexed, or an empty set for none.
export const launchedModelPages: ModelPageLaunch = 'all'

// Workflow pages stay noindex until they render real HTML and replace their /workflows twins; set to true to launch them.
export const launchedWorkflowPages: boolean = false
