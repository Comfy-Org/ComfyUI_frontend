if (__DISTRIBUTION__ === 'cloud') {
  const { initDatadogRum } = await import('@/platform/telemetry/initDatadogRum')
  await import('@/platform/telemetry/initErrorReporter')
  const { flushErrorReports } = await import('@comfyorg/telemetry/reportError')
  await initDatadogRum()
    .then(flushErrorReports)
    .catch(() => {})
}

await import('./main')

export {}
