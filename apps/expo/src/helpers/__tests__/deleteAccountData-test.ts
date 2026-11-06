import { deleteAccountWithData } from '../deleteAccountData'

// The app must leave Firestore cleanup to Bible Strong's Auth onDelete function.
jest.mock('../firebase', () => ({
  getDocs: () => {
    throw new Error('Unexpected client Firestore read')
  },
  writeBatch: () => {
    throw new Error('Unexpected client Firestore deletion')
  },
}))

const now = () => Date.parse('2026-11-01T21:00:00Z')
const user = (authTime = '2026-11-01T20:58:00Z') => ({
  uid: 'alice',
  getIdTokenResult: jest.fn(async () => ({ authTime })),
})

it('checks recent authentication before removing publications or the login', async () => {
  const unpublishStudies = jest.fn(async () => undefined)
  const deleteLogin = jest.fn(async () => undefined)
  for (const authTime of ['2026-11-01T20:54:59Z', 'not a date']) {
    await expect(
      deleteAccountWithData(
        user(authTime),
        {
          revokeProvider: async () => undefined,
          unpublishStudies,
          deleteLogin,
        },
        now
      )
    ).rejects.toMatchObject({ code: 'auth/requires-recent-login' })
  }
  expect(unpublishStudies).not.toHaveBeenCalled()
  expect(deleteLogin).not.toHaveBeenCalled()
})

it('confirms the provider, removes publications, then deletes Auth for server cleanup', async () => {
  const order: string[] = []
  const reader = user()
  await deleteAccountWithData(
    reader,
    {
      revokeProvider: async () => {
        order.push('provider')
      },
      unpublishStudies: async () => {
        order.push('publications')
      },
      deleteLogin: async () => {
        order.push('auth')
      },
    },
    now
  )
  expect(order).toEqual(['provider', 'publications', 'auth'])
  expect(reader.getIdTokenResult).toHaveBeenCalledWith(true)
})

it('stops when the provider step is cancelled', async () => {
  const unpublishStudies = jest.fn(async () => undefined)
  const deleteLogin = jest.fn(async () => undefined)
  await expect(
    deleteAccountWithData(
      user(),
      {
        revokeProvider: async () => {
          throw new Error('cancelled')
        },
        unpublishStudies,
        deleteLogin,
      },
      now
    )
  ).rejects.toThrow('cancelled')
  expect(unpublishStudies).not.toHaveBeenCalled()
  expect(deleteLogin).not.toHaveBeenCalled()
})

it('keeps the login when publication cleanup fails', async () => {
  const deleteLogin = jest.fn(async () => undefined)
  await expect(
    deleteAccountWithData(
      user(),
      {
        revokeProvider: async () => undefined,
        unpublishStudies: async () => {
          throw new Error('publication unavailable')
        },
        deleteLogin,
      },
      now
    )
  ).rejects.toThrow('publication unavailable')
  expect(deleteLogin).not.toHaveBeenCalled()
})

it('propagates Auth deletion failure without attempting client data cleanup', async () => {
  await expect(
    deleteAccountWithData(
      user(),
      {
        revokeProvider: async () => undefined,
        unpublishStudies: async () => undefined,
        deleteLogin: async () => {
          throw new Error('auth unavailable')
        },
      },
      now
    )
  ).rejects.toThrow('auth unavailable')
})
