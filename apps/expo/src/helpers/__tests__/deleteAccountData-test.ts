import { deleteAccountWithData, deleteOwnAccountData } from '../deleteAccountData'

type Ref = { path: string }
const mockStore = new Map<string, Record<string, unknown>>()
const mockBatches: string[][] = []
let mockFailRead = false
let mockFailReadPath: string | undefined
let mockFailBatch: number | undefined
const unpublishStudies = jest.fn(async () => undefined)

jest.mock('../firebase', () => {
  const join = (parent: unknown, segments: string[]) =>
    [
      ...(parent && typeof parent === 'object' && 'path' in parent ? [(parent as Ref).path] : []),
      ...segments,
    ].join('/')
  const children = (path: string) =>
    [...mockStore.keys()].filter(
      key => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/')
    )
  return {
    firebaseDb: {},
    doc: (parent: unknown, ...segments: string[]) => ({ path: join(parent, segments) }),
    collection: (parent: unknown, ...segments: string[]) => ({ path: join(parent, segments) }),
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    query: (ref: Ref, filter: { field: string; value: unknown }) => ({ ...ref, filter }),
    getDocs: async (ref: Ref & { filter?: { field: string; value: unknown } }) => {
      if (mockFailRead || ref.path === mockFailReadPath) throw new Error('offline')
      const paths = children(ref.path).filter(path => {
        if (!ref.filter) return true
        const owner = (mockStore.get(path)?.user as { id?: string } | undefined)?.id
        return owner === ref.filter.value
      })
      return { docs: paths.map(path => ({ ref: { path } })) }
    },
    writeBatch: () => {
      const deletes: string[] = []
      return {
        delete: (ref: Ref) => deletes.push(ref.path),
        commit: async () => {
          if (mockBatches.length === mockFailBatch) throw new Error('write failed')
          mockBatches.push(deletes)
          for (const path of deletes) mockStore.delete(path)
        },
      }
    },
  }
})

const seed = () => {
  mockStore.clear()
  mockBatches.length = 0
  mockFailRead = false
  mockFailReadPath = undefined
  mockFailBatch = undefined
  unpublishStudies.mockReset().mockResolvedValue(undefined)
  for (const [path, data] of Object.entries({
    'users/alice': { displayName: 'Alice' },
    'users-status/alice': { lastSeen: 1 },
    'users/alice/highlights/h1': {},
    'users/alice/notes/n1': {},
    'users/alice/notes/n1/revisions/r1': {},
    'users/alice/strongsHebreu/H430': {},
    'users/alice/tabGroups/main': {},
    'users/alice/studies/old': {},
    'users/alice/studies/old/revisions/r1': {},
    'studies/s1': { user: { id: 'alice' } },
    'studies/s1/revisions/r1': {},
    'studies/other': { user: { id: 'bob' } },
    'users/bob/highlights/h1': {},
  }))
    mockStore.set(path, data)
}

describe('deleteOwnAccountData', () => {
  beforeEach(seed)

  it("removes everything the owner keeps and nothing of another account's", async () => {
    expect(await deleteOwnAccountData('alice')).toBe(11)
    expect([...mockStore.keys()].sort()).toEqual(['studies/other', 'users/bob/highlights/h1'])
    const deleted = mockBatches.flat()
    expect(deleted.indexOf('studies/s1/revisions/r1')).toBeLessThan(deleted.indexOf('studies/s1'))
    for (const parent of ['users/alice/notes/n1', 'users/alice/studies/old'])
      expect(deleted.indexOf(`${parent}/revisions/r1`)).toBeLessThan(deleted.indexOf(parent))
    expect(deleted.at(-1)).toBe('users/alice')
  })

  it('deletes nothing when a read fails', async () => {
    mockFailRead = true
    await expect(deleteOwnAccountData('alice')).rejects.toThrow('offline')
    expect(mockBatches).toEqual([])
    expect(mockStore.size).toBe(13)
  })

  it('stays within the Firestore batch limit', async () => {
    for (let i = 0; i < 950; i++) mockStore.set(`users/alice/highlights/x${i}`, {})
    await deleteOwnAccountData('alice')
    expect(mockBatches.map(batch => batch.length)).toEqual([400, 400, 161])
  })

  it('deletes nothing when a nested revision cannot be listed', async () => {
    mockFailReadPath = 'users/alice/notes/n1/revisions'
    await expect(deleteOwnAccountData('alice')).rejects.toThrow('offline')
    expect(mockBatches).toEqual([])
    expect(mockStore.size).toBe(13)
  })

  it('keeps a parent discoverable when a later history batch fails, then supports retry', async () => {
    for (let i = 0; i < 850; i++) mockStore.set(`users/alice/notes/n1/revisions/r${i}`, {})
    mockFailBatch = 1
    await expect(deleteOwnAccountData('alice')).rejects.toThrow('write failed')
    expect(mockStore.has('users/alice/notes/n1')).toBe(true)
    expect(mockStore.has('users/alice')).toBe(true)
    mockFailBatch = undefined
    await deleteOwnAccountData('alice')
    expect([...mockStore.keys()].sort()).toEqual(['studies/other', 'users/bob/highlights/h1'])
  })
})

describe('deleteAccountWithData', () => {
  const now = () => Date.parse('2026-11-01T21:00:00Z')
  const user = (authTime: string) => ({
    uid: 'alice',
    getIdTokenResult: jest.fn(async () => ({ authTime })),
  })
  beforeEach(seed)

  it('asks for a recent sign-in before deleting anything', async () => {
    const deleteLogin = jest.fn(async () => undefined)
    const revokeProvider = jest.fn(async () => undefined)
    for (const authTime of ['2026-11-01T20:54:59Z', 'not a date'])
      await expect(
        deleteAccountWithData(
          user(authTime),
          { revokeProvider, unpublishStudies, deleteLogin },
          now
        )
      ).rejects.toMatchObject({ code: 'auth/requires-recent-login' })
    expect(deleteLogin).not.toHaveBeenCalled()
    expect(unpublishStudies).not.toHaveBeenCalled()
    expect(mockBatches).toEqual([])
  })

  it('revokes the provider, then deletes the data, then the login', async () => {
    const order: string[] = []
    const reader = user('2026-11-01T20:58:00Z')
    await deleteAccountWithData(
      reader,
      {
        revokeProvider: async () => {
          order.push(mockStore.has('users/alice') ? 'revoke' : 'revoke after data')
        },
        unpublishStudies: async () => {
          expect(reader.getIdTokenResult).toHaveBeenCalledWith(true)
          expect(mockBatches).toEqual([])
          order.push('unpublish')
        },
        deleteLogin: async () => {
          order.push(mockStore.has('users/alice/notes/n1') ? 'login before data' : 'login')
        },
      },
      now
    )
    expect(order).toEqual(['revoke', 'unpublish', 'login'])
    // The token is refreshed so a fresh Apple sign-in counts as recent.
    expect(reader.getIdTokenResult).toHaveBeenCalledWith(true)
  })

  it('deletes nothing when the Apple step fails or is cancelled', async () => {
    const deleteLogin = jest.fn(async () => undefined)
    const revokeProvider = jest.fn(async () => {
      throw Object.assign(new Error('canceled'), { code: '1001' })
    })
    await expect(
      deleteAccountWithData(
        user('2026-11-01T20:58:00Z'),
        { revokeProvider, unpublishStudies, deleteLogin },
        now
      )
    ).rejects.toMatchObject({ code: '1001' })
    expect(deleteLogin).not.toHaveBeenCalled()
    expect(unpublishStudies).not.toHaveBeenCalled()
    expect(mockBatches).toEqual([])
  })

  it('keeps the login when the data cannot be deleted, so the reader can try again', async () => {
    mockFailRead = true
    const deleteLogin = jest.fn(async () => undefined)
    await expect(
      deleteAccountWithData(
        user('2026-11-01T20:58:00Z'),
        { revokeProvider: async () => undefined, unpublishStudies, deleteLogin },
        now
      )
    ).rejects.toThrow()
    expect(deleteLogin).not.toHaveBeenCalled()
  })

  it('keeps the login and private data when published studies cannot be removed', async () => {
    const deleteLogin = jest.fn(async () => undefined)
    unpublishStudies.mockRejectedValueOnce(new Error('publish_failed'))
    await expect(
      deleteAccountWithData(
        user('2026-11-01T20:58:00Z'),
        {
          revokeProvider: async () => undefined,
          unpublishStudies,
          deleteLogin,
        },
        now
      )
    ).rejects.toThrow('publish_failed')
    expect(deleteLogin).not.toHaveBeenCalled()
    expect(mockBatches).toEqual([])
    expect(mockStore.size).toBe(13)
  })
})
