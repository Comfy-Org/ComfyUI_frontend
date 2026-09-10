export function smokeCommand(frontendUrl: string): string {
  return `PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=${frontendUrl} pnpm exec playwright test agentHarnessSmoke --project=agent-harness`
}
