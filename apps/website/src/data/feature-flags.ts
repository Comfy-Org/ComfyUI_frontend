export interface FeatureFlagsSnapshot {
  fetchedAt: string
  flags: {
    cloudFreeTier: boolean
  }
}
