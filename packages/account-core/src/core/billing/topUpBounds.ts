export interface TopUpBound {
  usd: number
  credits: number
}

/** The served bound when both cents and credits are served, else the fallback. */
export function servedTopUpBound(
  fallback: TopUpBound,
  served: { cents: number | undefined; credits: number | undefined }
): TopUpBound {
  return served.cents === undefined || served.credits === undefined
    ? fallback
    : { usd: served.cents / 100, credits: served.credits }
}
