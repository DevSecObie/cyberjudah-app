import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import Box, { VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Switch from '~common/ui/Switch'
import Text from '~common/ui/Text'
import useLogin from '~helpers/useLogin'
import { useTheme } from '~themes/ThemeProvider'
import { getNoteRequest, requestNotes, type NoteRequestState } from './noteRequests'

const TELL_LABEL = 'Tell me when they’re ready'

/**
 * A class without notes yet: notes are written when readers ask, the most asked first, so the
 * reader can ask here (counted with the asks from the Telegram app) and choose to be told when the
 * notes are published. Once asked, it stays asked.
 */
const RequestNotesCard = ({ video, title }: { video: string; title: string }) => {
  const theme = useTheme()
  const router = useRouter()
  const { isLogged } = useLogin()
  const client = useQueryClient()
  const [tell, setTell] = useState(true)
  const key = ['cyberjudah-note-request', video]
  const state = useQuery({
    queryKey: key,
    queryFn: () => getNoteRequest(video),
    enabled: isLogged,
    staleTime: 60 * 1000,
    retry: 1,
  })
  const ask = useMutation({
    mutationFn: (wish: boolean) => requestNotes(video, title, wish),
    onSuccess: next => {
      client.setQueryData<NoteRequestState>(key, next)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    },
    onError: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  })

  const current = state.data
  const mine = !!current?.mine
  const told = !!current?.tell
  const count = current?.count ?? 0
  const others = mine ? count - 1 : count
  const label = ask.isPending
    ? 'Sending…'
    : mine
      ? others > 0
        ? `Notes requested · you and ${others} ${others === 1 ? 'other' : 'others'}`
        : 'Notes requested'
      : ask.isError
        ? 'Couldn’t send. Try again'
        : count > 0
          ? `Request notes · ${count} asked`
          : 'Request notes'
  const signedOut = !isLogged || current?.signedIn === false

  return (
    <VStack className="mx-[16px] my-[20px] p-[16px] gap-[12px] rounded-[16px] border-continuous bg-surface">
      <Text className="text-[16px] font-bold">No notes for this class yet.</Text>
      <Text className="text-[14px] text-grey">
        Notes are written when readers ask. The most requested are written first.
      </Text>
      {signedOut ? (
        <Button onPress={() => router.push('/login')} accessibilityHint="Opens sign in">
          Sign in to request notes
        </Button>
      ) : (
        <>
          <Button
            onPress={() => ask.mutate(tell)}
            disabled={mine || ask.isPending || state.isPending}
            reverse={mine}
            accessibilityState={{ disabled: mine, busy: ask.isPending }}
          >
            {label}
          </Button>
          {mine && told ? (
            <Text className="text-[13px] text-grey">
              We’ll let you know here when the notes are ready.
            </Text>
          ) : (
            <Box className="min-h-[44px] flex-row items-center gap-[12px]">
              <Text className="flex-1 text-[15px]">{TELL_LABEL}</Text>
              <Switch
                accessibilityLabel={TELL_LABEL}
                value={mine ? false : tell}
                disabled={ask.isPending}
                onValueChange={value => {
                  void Haptics.selectionAsync()
                  // Asked already: turning it on now adds the reader to those told.
                  if (mine) {
                    if (value) ask.mutate(true)
                  } else setTell(value)
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                ios_backgroundColor={theme.colors.border}
                thumbColor="#ffffff"
              />
            </Box>
          )}
        </>
      )}
    </VStack>
  )
}

export default RequestNotesCard
