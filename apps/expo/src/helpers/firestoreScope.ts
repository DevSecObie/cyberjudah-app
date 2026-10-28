/** Staging uses the same authenticated UID, with a separate study-data namespace. */
export const scopeFirestorePath = (path: string, scope: string | undefined): string => {
  if (scope !== 'staging') return path
  const [root, ...rest] = path.split('/')
  const scopedRoot = ['users', 'studies', 'users-status'].includes(root) ? `staging_${root}` : root
  return [scopedRoot, ...rest].join('/')
}
