if (__DISTRIBUTION__ === 'cloud') {
  const { initDatadogRum } = await import('@/platform/telemetry/initDatadogRum')
  void initDatadogRum().catch(() => {})
}

await import('./main')

export {}
