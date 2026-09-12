import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execSync: vi.fn(),
  readFileSync: vi.fn(),
  globSync: vi.fn()
}))

vi.mock('child_process', () => ({
  execSync: mocks.execSync,
  default: { execSync: mocks.execSync }
}))
vi.mock('fs', () => ({
  readFileSync: mocks.readFileSync,
  default: { readFileSync: mocks.readFileSync }
}))
vi.mock('glob', () => ({
  globSync: mocks.globSync,
  default: { globSync: mocks.globSync }
}))

beforeEach(() => {
  vi.resetModules()
  vi.spyOn(process, 'exit').mockImplementation(vi.fn<() => never>())
})

it('checks all new keys while reading each source file only once', async () => {
  mocks.execSync.mockImplementation((command: string) => {
    if (command.startsWith('git diff')) return 'src/locales/en/main.json'
    if (command.startsWith('git show HEAD:')) {
      return JSON.stringify({ old: 'Existing key' })
    }
    return JSON.stringify({
      old: 'Existing key',
      kept: { title: 'Used key' },
      missing: { first: 'Unused key', second: 'Another unused key' },
      commands: { dynamic: 'Dynamically resolved' }
    })
  })
  mocks.globSync.mockReturnValue(['src/empty.ts', 'src/usage.ts'])
  mocks.readFileSync.mockImplementation((file: string) =>
    file === 'src/empty.ts' ? '' : "t('kept.title')"
  )
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  await import('./check-unused-i18n-keys')

  expect(mocks.readFileSync.mock.calls).toEqual([
    ['src/empty.ts', 'utf-8'],
    ['src/usage.ts', 'utf-8']
  ])
  expect(
    warn.mock.calls
      .map(([message]) => message)
      .filter((message) => message.startsWith('  - '))
  ).toEqual(['  - missing.first', '  - missing.second'])
  expect(process.exit).toHaveBeenCalledWith(0)
})
