import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/api', () => ({
  api: {
    listUserDataFullInfo: vi.fn(),
    getUserData: vi.fn(),
    storeUserData: vi.fn(),
    deleteUserData: vi.fn(),
    moveUserData: vi.fn()
  }
}))

import { api } from '@/scripts/api'

import { UserdataVFS } from './userdata'

const mocked = vi.mocked(api)

function respOk(body = ''): Response {
  return new Response(body, { status: 200 })
}

describe('UserdataVFS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('list returns files under the root', async () => {
    mocked.listUserDataFullInfo.mockResolvedValue([
      { path: 'workflows/a.json', size: 10, modified: 1 },
      { path: 'workflows/b.json', size: 20, modified: 2 }
    ])
    const fs = new UserdataVFS('workflows')
    const entries = await fs.list('/')
    expect(mocked.listUserDataFullInfo).toHaveBeenCalledWith('workflows')
    expect(entries.map((e) => e.name)).toEqual(['a.json', 'b.json'])
    expect(entries[0].type).toBe('file')
  })

  it('list infers subdirs', async () => {
    mocked.listUserDataFullInfo.mockResolvedValue([
      { path: 'workflows/a.json', size: 10, modified: 1 },
      { path: 'workflows/sub/b.json', size: 20, modified: 2 }
    ])
    const fs = new UserdataVFS('workflows')
    const entries = await fs.list('/')
    expect(entries.map((e) => e.name).sort()).toEqual(['a.json', 'sub'])
    expect(entries.find((e) => e.name === 'sub')?.type).toBe('dir')
  })

  it('read returns body text', async () => {
    mocked.getUserData.mockResolvedValue(respOk('hello'))
    const fs = new UserdataVFS('workflows')
    expect(await fs.read('/a.json')).toBe('hello')
    expect(mocked.getUserData).toHaveBeenCalledWith('workflows/a.json')
  })

  it('write POSTs via storeUserData', async () => {
    mocked.storeUserData.mockResolvedValue(respOk())
    const fs = new UserdataVFS('workflows')
    await fs.write('/a.json', '{}')
    expect(mocked.storeUserData).toHaveBeenCalledWith(
      'workflows/a.json',
      '{}',
      expect.objectContaining({ stringify: false })
    )
  })

  it('delete calls deleteUserData', async () => {
    mocked.deleteUserData.mockResolvedValue(respOk())
    const fs = new UserdataVFS('workflows')
    await fs.delete('/a.json')
    expect(mocked.deleteUserData).toHaveBeenCalledWith('workflows/a.json')
  })

  it('move calls moveUserData', async () => {
    mocked.moveUserData.mockResolvedValue(respOk())
    const fs = new UserdataVFS('workflows')
    await fs.move('/a.json', '/b.json')
    expect(mocked.moveUserData).toHaveBeenCalledWith(
      'workflows/a.json',
      'workflows/b.json',
      { overwrite: false }
    )
  })

  it('read throws on non-ok', async () => {
    mocked.getUserData.mockResolvedValue(new Response('no', { status: 404 }))
    const fs = new UserdataVFS('workflows')
    await expect(fs.read('/x')).rejects.toThrow(/read failed/)
  })

  it('empty root lists from user root', async () => {
    mocked.listUserDataFullInfo.mockResolvedValue([
      { path: 'settings.json', size: 5, modified: 1 }
    ])
    const fs = new UserdataVFS('')
    const entries = await fs.list('/')
    expect(entries[0].name).toBe('settings.json')
  })
})
