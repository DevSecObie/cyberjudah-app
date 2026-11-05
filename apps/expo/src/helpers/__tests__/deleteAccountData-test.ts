import { deleteAccountWithData } from '../deleteAccountData'

const now = () => Date.parse('2026-11-01T21:00:00Z')
const user = (authTime = '2026-11-01T20:58:00Z') => ({
  uid: 'alice',
  getIdTokenResult: jest.fn(async () => ({ authTime })),
})
const steps = () => ({
  revokeProvider: jest.fn(async (): Promise<void> => undefined),
  unpublishStudies: jest.fn(async (): Promise<void> => undefined),
  deleteRemoteData: jest.fn(async (): Promise<void> => undefined),
  isCurrentUser: jest.fn(() => true),
  deleteLogin: jest.fn(async (): Promise<void> => undefined),
})

describe('deleteAccountWithData', () => {
  it('requires a recent sign-in before deleting data or the login', async () => {
    for (const authTime of ['2026-11-01T20:54:59Z', 'not a date']) {
      const actions = steps()
      await expect(deleteAccountWithData(user(authTime), actions, now)).rejects.toMatchObject({
        code: 'auth/requires-recent-login',
      })
      expect(actions.unpublishStudies).not.toHaveBeenCalled()
      expect(actions.deleteRemoteData).not.toHaveBeenCalled()
      expect(actions.deleteLogin).not.toHaveBeenCalled()
    }
  })

  it('requires publication and server cleanup acknowledgments before deleting the login', async () => {
    const order: string[] = []
    const reader = user()
    await deleteAccountWithData(
      reader,
      {
        isCurrentUser: () => true,
        revokeProvider: async () => {
          order.push('provider')
        },
        unpublishStudies: async () => {
          expect(reader.getIdTokenResult).toHaveBeenCalledWith(true)
          order.push('publication')
        },
        deleteRemoteData: async () => {
          order.push('recursive server cleanup')
        },
        deleteLogin: async () => {
          order.push('login')
        },
      },
      now
    )
    expect(order).toEqual(['provider', 'publication', 'recursive server cleanup', 'login'])
  })

  it('does not start deletion when provider confirmation is cancelled', async () => {
    const actions = steps()
    actions.revokeProvider.mockRejectedValueOnce(
      Object.assign(new Error('cancelled'), { code: '1001' })
    )
    await expect(deleteAccountWithData(user(), actions, now)).rejects.toMatchObject({
      code: '1001',
    })
    expect(actions.unpublishStudies).not.toHaveBeenCalled()
    expect(actions.deleteRemoteData).not.toHaveBeenCalled()
    expect(actions.deleteLogin).not.toHaveBeenCalled()
  })

  it('keeps private data and the login when unpublishing fails', async () => {
    const actions = steps()
    actions.unpublishStudies.mockRejectedValueOnce(new Error('offline'))
    await expect(deleteAccountWithData(user(), actions, now)).rejects.toThrow('offline')
    expect(actions.deleteRemoteData).not.toHaveBeenCalled()
    expect(actions.deleteLogin).not.toHaveBeenCalled()
  })

  it('keeps the login after an interrupted server cleanup and permits a successful retry', async () => {
    const actions = steps()
    actions.deleteRemoteData.mockRejectedValueOnce(new Error('partial cleanup'))
    await expect(deleteAccountWithData(user(), actions, now)).rejects.toThrow('partial cleanup')
    expect(actions.deleteLogin).not.toHaveBeenCalled()
    await deleteAccountWithData(user(), actions, now)
    expect(actions.deleteRemoteData).toHaveBeenCalledTimes(2)
    expect(actions.deleteLogin).toHaveBeenCalledTimes(1)
  })

  it.each(['provider', 'publication', 'server'] as const)(
    'never deletes a different login after the account changes during %s',
    async phase => {
      const actions = steps()
      const changeAccount = async () => {
        actions.isCurrentUser.mockReturnValue(false)
      }
      if (phase === 'provider') actions.revokeProvider.mockImplementation(changeAccount)
      if (phase === 'publication') actions.unpublishStudies.mockImplementation(changeAccount)
      if (phase === 'server') actions.deleteRemoteData.mockImplementation(changeAccount)
      await expect(deleteAccountWithData(user(), actions, now)).rejects.toMatchObject({
        code: 'auth/user-mismatch',
      })
      expect(actions.deleteLogin).not.toHaveBeenCalled()
      if (phase !== 'server') expect(actions.deleteRemoteData).not.toHaveBeenCalled()
    }
  )
})
