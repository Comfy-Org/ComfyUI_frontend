export type ModelPageLaunch = 'all' | ReadonlySet<string>

// Emergency rollback: replace 'all' with a set of Router model ids to keep indexed, or an empty set for none.
export const launchedModelPages: ModelPageLaunch = 'all'
