import { deleteUser, getAuth } from 'firebase/auth'

import { firebaseApp } from './firebaseApp.web'

export const getCurrentAuthUser = () => getAuth(firebaseApp).currentUser
export const deleteCurrentAuthUser = async (expectedUid?: string) => {
  const user = getCurrentAuthUser()
  if (expectedUid && user?.uid !== expectedUid)
    throw Object.assign(new Error('The signed-in account changed.'), { code: 'auth/user-mismatch' })
  if (user) await deleteUser(user)
}
