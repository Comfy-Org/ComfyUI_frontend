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
  try {
    const { reportError } = await import('@/platform/telemetry/reportError')
    reportError(error, {
      errorType: 'failure_initializing_app',
      surface: 'platform'
    })
  } catch (reporterFailure) {
    console.error(
      '[bootstrap] failed to report app initialization failure',
      error,
      reporterFailure
    )
  }
}

export {}
