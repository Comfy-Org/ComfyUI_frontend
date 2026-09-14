if (__DISTRIBUTION__ === 'cloud') {
  const { initDatadogRum } = await import('@/platform/telemetry/initDatadogRum')
  const { flushErrorReports } = await import('@/platform/telemetry/reportError')
  void initDatadogRum()
    .then(flushErrorReports)
    .catch(() => {})
}

await import('./main')

export {}
