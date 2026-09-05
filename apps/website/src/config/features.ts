import snapshot from '../data/feature-flags.snapshot.json' with { type: 'json' }

export const SHOW_FREE_TIER = snapshot.flags.cloudFreeTier
