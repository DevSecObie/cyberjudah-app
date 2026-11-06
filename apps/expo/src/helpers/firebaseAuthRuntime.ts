import { deleteUser, getAuth } from '@react-native-firebase/auth'

export const getCurrentAuthUser = () => getAuth().currentUser
export const deleteCurrentAuthUser = async (expectedUid?: string) => {
  const user = getCurrentAuthUser()
  if (expectedUid && user?.uid !== expectedUid)
    throw Object.assign(new Error('The signed-in account changed.'), { code: 'auth/user-mismatch' })
  if (user) await deleteUser(user)
}
