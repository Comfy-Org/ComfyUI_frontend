if (__DISTRIBUTION__ === 'cloud') {
  const { initDatadogRum } = await import('@/platform/telemetry/initDatadogRum')
  const { flushErrorReports } = await import('@/platform/telemetry/reportError')
  // Awaited (not fired with `void`) so `reportError()`'s synchronous `getFrontendBucket()`
  // read is never racing this resolution — otherwise the first errors of a session, which
  // are disproportionately startup failures, permanently miss the `bucket` Sentry tag
  // (Sentry delivery is never retried once `sentryDelivered` is true). Capped by the
  // existing 1s fetch timeout inside `initDatadogRum`, so this can't hang boot.
  await initDatadogRum()
    .then(flushErrorReports)
    .catch(() => {})
}

await import('./main')

export {}
