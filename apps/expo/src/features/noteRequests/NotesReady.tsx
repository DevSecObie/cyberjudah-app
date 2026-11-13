import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { readCachedClassLibrary } from '~features/passageMediaLibrary/cyberJudahClasses'
import { toast } from '~helpers/toast'
import useLogin from '~helpers/useLogin'
import { takeReadyNotes, type ReadyNote } from './noteRequests'

/**
 * Notes the reader asked to be told about: each time the app opens or comes back to the
 * foreground, it asks the server for those published since, and shows each one once with a way
 * into the class. A failed check stays silent; the notes wait on the server for the next one.
 */
const NotesReady = () => {
  const router = useRouter()
  const { isLogged } = useLogin()

  useEffect(() => {
    if (!isLogged) return
    let checking = false
    const open = (note: ReadyNote) => {
      const listed = readCachedClassLibrary()?.find(row => row.providerId === note.video)
      router.push({
        pathname: '/(explore)/passage-media-player',
        params: listed ? { workId: listed.workId } : { video: note.video, title: note.title },
      })
    }
    const check = async () => {
      if (checking) return
      checking = true
      try {
        for (const note of await takeReadyNotes()) {
          toast.success('Your notes are ready', {
            description: note.teacher ? `${note.title} · ${note.teacher}` : note.title,
            duration: 10000,
            action: { label: 'Open', onClick: () => open(note) },
          })
        }
      } catch {
        // Offline or the server is down: the notes are still kept for the next check.
      } finally {
        checking = false
      }
    }
    void check()
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') void check()
    })
    return () => subscription.remove()
  }, [isLogged, router])

  return null
}

export default NotesReady
