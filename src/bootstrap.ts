if (__DISTRIBUTION__ === 'cloud') {
  const { initDatadogRum } = await import('@/platform/telemetry/initDatadogRum')
  initDatadogRum()
}

await import('./main')

export {}
