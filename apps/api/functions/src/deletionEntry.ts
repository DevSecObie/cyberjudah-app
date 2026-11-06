import { initializeApp, getApps, getApp } from 'firebase-admin/app'

// This entry point is exclusively for the CyberJudah deployment artifact.
// Never fall back to the inherited Bible Strong Firebase project.
if (getApps().length === 0) initializeApp()
if (getApp().options.projectId !== 'cyberjudah-app') {
  throw new Error('CyberJudah deletion functions require project cyberjudah-app')
}

export { deleteUser } from './users'
