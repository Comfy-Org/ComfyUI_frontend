if (__DISTRIBUTION__ === 'cloud') {
  const { initDatadogRum } = await import('@/platform/telemetry/initDatadogRum')
  const { flushErrorReports } = await import('@/platform/telemetry/reportError')
  void initDatadogRum()
    .then(flushErrorReports)
    .catch(() => {})
}

try {
  await import('./main')
} catch (error) {
  const { reportError } = await import('@/platform/telemetry/reportError')
  reportError(error, {
    errorType: 'failure_initializing_app',
    surface: 'platform'
  })
}

export {}
