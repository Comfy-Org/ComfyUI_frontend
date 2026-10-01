export type ModelPageLaunch = 'all' | ReadonlySet<string>

// Launching a page also writes its markdown twin into the section indexes and llms-full.txt.
// Emergency rollback: replace 'all' with a set of Router model ids to keep indexed, or an empty set for none.
export const launchedModelPages: ModelPageLaunch = 'all'

// Typed `boolean` so it can't narrow to `false` and make the lookups it gates look dead.
// Workflow pages stay noindex until they render real HTML and replace their /workflows twins; set to true to launch them.
export const launchedWorkflowPages: boolean = false
