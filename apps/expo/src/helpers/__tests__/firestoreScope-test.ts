import { scopeFirestorePath } from '../firestoreScope'

describe('staging Firestore isolation', () => {
  it.each(['users/u/notes/n', 'users/u', 'studies/s/revisions/r', 'users-status/u'])(
    'routes %s to staging, preserving ownership and nested paths',
    path => {
      expect(scopeFirestorePath(path, 'staging')).toBe(`staging_${path}`)
      expect(scopeFirestorePath(path, undefined)).toBe(path)
    }
  )
  it('does not redirect editorial content or double-prefix an existing staging path', () => {
    expect(scopeFirestorePath('plans/p', 'staging')).toBe('plans/p')
    expect(scopeFirestorePath('staging_users/u', 'staging')).toBe('staging_users/u')
  })
})
