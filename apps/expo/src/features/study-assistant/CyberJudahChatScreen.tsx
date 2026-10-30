import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { selectUserLoginInfo } from '~redux/selectors/user'
import { storage } from '~helpers/storage'
import Box, { HStack } from '~common/ui/Box'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useTheme } from '~themes/ThemeProvider'
import AskInteractiveAnswer from './AskInteractiveAnswer'
import AskCreditsCard from './AskCreditsCard'
import AskProgress from './AskProgress'
import AskGlassBackdrop from './AskGlassBackdrop'
import {
  askCyberJudah,
  askModels,
  CyberJudahAskError,
  reportAskAnswer,
  type CyberJudahModel,
} from './cyberJudahAsk'
import {
  chatHistory,
  consentKey,
  newChat,
  type Chat,
  type ChatSummary,
  type ChatTurn,
} from './cyberJudahConversations'
import {
  deleteChat,
  observeChat,
  observeChats,
  saveChatTurn,
} from './cyberJudahConversationRepository'

const STARTERS = [
  ['Why do we keep the Passover?', 'The feast, from the law to Christ'],
  ['Who are the twelve tribes today?', 'Where the scattered nation is now'],
  ['What does the law say about usury?', 'Lending among the brethren'],
  ['How is the Sabbath kept?', 'The day, the rest and the assembly'],
]

function IconButton({
  name,
  label,
  onPress,
  disabled = false,
}: {
  name: React.ComponentProps<typeof FeatherIcon>['name']
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <FeatherIcon name={name} size={20} />
    </Pressable>
  )
}

export default function CyberJudahChatScreen() {
  const { id } = useSelector(selectUserLoginInfo)
  // Remount on account changes: no previous user's transcript, consent, callbacks or drafts survive.
  return <AccountChat key={id || 'signed-out'} account={id || ''} />
}

function AccountChat({ account }: { account: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [chat, setChat] = useState<Chat>(newChat)
  const [history, setHistory] = useState<ChatSummary[]>([])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState<ChatTurn | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState(false)
  const [unsaved, setUnsaved] = useState<{ chat: Chat; turn: ChatTurn } | null>(null)
  const [panel, setPanel] = useState<'history' | 'models' | null>(null)
  const [models, setModels] = useState<CyberJudahModel[]>([])
  const [model, setModel] = useState('')
  const [questionLimit, setQuestionLimit] = useState(400)
  const [purchasesEnabled, setPurchasesEnabled] = useState(false)
  const [consent, setConsent] = useState<{
    provider: string
    question: string
    retry: boolean
  } | null>(null)
  const [copied, setCopied] = useState('')
  const [reported, setReported] = useState<string[]>([])
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const scroll = useRef<ScrollView>(null)
  const nearBottom = useRef(true)
  const selected = models.find(item => item.id === model)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.abort()
      active.current = null
    }
  }, [])
  useEffect(() => {
    if (!account) return
    const controller = new AbortController()
    void askModels(controller.signal)
      .then(result => {
        if (!mounted.current) return
        setModels(result.models)
        setModel(result.default)
        setQuestionLimit(result.maxQuestionLength)
        setPurchasesEnabled(result.purchasesEnabled)
      })
      .catch(() => {}) // Existing staging supports the default free model before the catalogue rolls out.
    const stop = observeChats(
      account,
      value => {
        setHistory(value)
        setHistoryError(false)
      },
      () => setHistoryError(true)
    )
    return () => {
      controller.abort()
      stop()
    }
  }, [account])
  useEffect(() => {
    if (!account) return
    return observeChat(
      account,
      chat.id,
      remote => {
        if (remote && !active.current) setChat(remote)
      },
      () => setHistoryError(true)
    )
  }, [account, chat.id])

  const agreedProviders = (): string[] => {
    try {
      const saved = JSON.parse(storage.getString(consentKey(account)) || '[]')
      return Array.isArray(saved) ? saved.filter(x => typeof x === 'string') : []
    } catch {
      return []
    }
  }
  const save = async (conversation: Chat, turn: ChatTurn) => {
    try {
      await saveChatTurn(account, conversation, turn)
      if (mounted.current) setUnsaved(null)
    } catch {
      if (mounted.current) setUnsaved({ chat: conversation, turn })
    }
  }
  const send = async (asked = question, retry = false) => {
    const current = asked.trim()
    if (!account || current.length < 2 || current.length > questionLimit || active.current) return
    if (chat.turns.length >= 150 && !retry) {
      setError(t('askChat.full', { defaultValue: 'Start a new chat to keep asking.' }))
      return
    }
    const base = retry ? chat.turns.slice(0, -1) : chat.turns
    const conversation = { ...chat, title: chat.title || current.slice(0, 100), turns: base }
    const turn: ChatTurn = {
      id: retry ? chat.turns.at(-1)!.id : newChat().id,
      question: current,
      answer: '',
      sources: [],
      createdAt: retry ? chat.turns.at(-1)!.createdAt : Date.now(),
      state: 'interrupted',
      ...(model ? { model } : {}),
    }
    const controller = new AbortController()
    active.current = controller
    setChat(conversation)
    setPending({ ...turn })
    setBusy(true)
    setQuestion('')
    setError('')
    setConsent(null)
    setStatus(t('assistant.cyberjudah.searching'))
    nearBottom.current = true
    const deadline = setTimeout(() => controller.abort(), 130000)
    let keep = true
    try {
      const result = await askCyberJudah(
        {
          question: current,
          history: chatHistory(base),
          consent: agreedProviders(),
          ...(model ? { model } : {}),
          account,
        },
        controller.signal,
        event => {
          if (active.current !== controller || !mounted.current) return
          if (event.reset) {
            turn.answer = ''
            delete turn.ui
            delete turn.teachingFound
          }
          if (event.ui) {
            turn.ui = event.ui
            turn.sources = event.sources ?? []
            turn.teachingFound = event.teachingFound
            setStatus('')
          }
          if (event.delta) {
            turn.answer += event.delta
            setStatus('')
          }
          if (event.status) {
            setStatus(event.status)
            if (/^(Searching|Reading|Looking)/.test(event.status))
              turn.steps = [...(turn.steps ?? []), event.status].slice(-20)
          }
          setPending({ ...turn })
        }
      )
      if (active.current !== controller || !mounted.current) return
      Object.assign(turn, result, { state: 'complete' })
    } catch (cause) {
      if (active.current !== controller || !mounted.current) return
      if (cause instanceof CyberJudahAskError && cause.code === 'CONSENT') {
        keep = false
        setConsent({
          provider: cause.provider || selected?.provider || 'Cloudflare (Workers AI)',
          question: current,
          retry,
        })
        setQuestion(current)
        if (retry) setChat(chat)
      } else {
        turn.state = controller.signal.aborted ? 'interrupted' : 'error'
        const code = cause instanceof CyberJudahAskError ? cause.code : ''
        setError(
          controller.signal.aborted
            ? t('assistant.interrupted')
            : t(
                code === 'DAILY_LIMIT'
                  ? 'assistant.limit'
                  : code === 'PAUSED'
                    ? 'assistant.cyberjudah.paused'
                    : code === 'SIGN_IN_REQUIRED'
                      ? 'assistant.signIn'
                      : 'assistant.unavailable'
              )
        )
      }
    } finally {
      clearTimeout(deadline)
      if (active.current === controller && mounted.current) {
        active.current = null
        setBusy(false)
        setStatus('')
        setPending(null)
        if (keep) {
          const next = { ...conversation, updatedAt: Date.now(), turns: [...base, turn] }
          setChat(next)
          void save(next, turn)
        }
      }
    }
  }
  const startNew = () => {
    if (active.current) return
    setChat(newChat())
    setQuestion('')
    setError('')
    setConsent(null)
    setPanel(null)
    nearBottom.current = true
  }
  const report = (turn: ChatTurn) =>
    Alert.alert(
      t('askChat.report', { defaultValue: 'Report answer' }),
      t('askChat.reportNotice', {
        defaultValue: 'Only the model and reason are sent. Your question and answer stay private.',
      }),
      [
        { text: t('Annuler'), style: 'cancel' },
        ...(['wrong', 'harmful'] as const).map(reason => ({
          text: t(`askChat.${reason}`, {
            defaultValue: reason === 'wrong' ? 'Wrong or misquoted' : 'Harmful or offensive',
          }),
          onPress: () => {
            const controller = new AbortController()
            void reportAskAnswer(turn.model, reason, controller.signal, turn.traceId)
              .then(() => {
                if (mounted.current) setReported(old => [...old, turn.id])
              })
              .catch(() =>
                Alert.alert(
                  t('askChat.reportFailed', {
                    defaultValue: 'Report could not be sent. Please try again later.',
                  })
                )
              )
          },
        })),
      ]
    )
  const allTurns = [...chat.turns, ...(pending ? [pending] : [])]

  return (
    <Container className="bg-reverse">
      <Header
        title="Ask CyberJudah"
        fontSize={16}
        hasBackButton
        rightComponent={
          <HStack className="pr-2">
            <IconButton
              name="clock"
              label={t('askChat.history', { defaultValue: 'Chat history' })}
              onPress={() => setPanel('history')}
              disabled={busy}
            />
            <IconButton name="edit" label={t('assistant.new')} onPress={startNew} disabled={busy} />
          </HStack>
        }
      >
        <Pressable
          onPress={() => setPanel('models')}
          disabled={busy || !account}
          accessibilityRole="button"
          accessibilityLabel={t('askChat.chooseModel', { defaultValue: 'Choose a model' })}
          className="mx-5 mb-3 min-h-11 flex-row items-center gap-2 self-start rounded-full px-3 py-2"
        >
          <AskGlassBackdrop radius={100} />
          <Text className="text-xs">
            {selected?.name || t('askChat.freeModel', { defaultValue: 'Free Ask' })}
          </Text>
          <FeatherIcon name="chevron-down" size={14} color="grey" />
        </Pressable>
      </Header>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          scrollEventThrottle={100}
          onScroll={e => {
            const v = e.nativeEvent
            nearBottom.current =
              v.contentSize.height - v.layoutMeasurement.height - v.contentOffset.y < 100
          }}
          onContentSizeChange={() => {
            if (nearBottom.current) scroll.current?.scrollToEnd({ animated: false })
          }}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 24,
            maxWidth: 760,
            width: '100%',
            alignSelf: 'center',
            flexGrow: 1,
          }}
        >
          {!allTurns.length && (
            <Box className="flex-1 justify-center py-5">
              <Text className="mb-2 text-2xl font-bold">
                {t('askChat.welcome', { defaultValue: 'What would you like to study?' })}
              </Text>
              <Text className="mb-6 text-sm leading-6 text-grey">
                {t('askChat.intro', {
                  defaultValue:
                    'Answers from the classes and the library, with sources you can open.',
                })}
              </Text>
              <Box className="gap-3">
                {STARTERS.map(([title, subtitle], i) => (
                  <Pressable
                    key={title}
                    onPress={() => setQuestion(title)}
                    disabled={!account}
                    accessibilityRole="button"
                    className="rounded-2xl bg-light-grey p-4"
                    style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                  >
                    <HStack className="items-center gap-3">
                      <Box className="flex-1">
                        <Text className="font-bold">
                          {t(`askChat.starter${i}Title`, { defaultValue: title })}
                        </Text>
                        <Text className="mt-1 text-xs text-grey">
                          {t(`askChat.starter${i}Detail`, { defaultValue: subtitle })}
                        </Text>
                      </Box>
                      <FeatherIcon name="arrow-up-right" size={18} color="grey" />
                    </HStack>
                  </Pressable>
                ))}
              </Box>
              <Text className="mt-5 text-xs text-grey">
                {t('askChat.privacy', {
                  defaultValue:
                    'Chats are saved privately to your CyberJudah account. You can delete them from history.',
                })}
              </Text>
            </Box>
          )}
          {allTurns.map((turn, i) => (
            <Box key={turn.id} className="mb-7">
              <Box className="mb-5 max-w-[90%] self-end rounded-2xl bg-light-grey px-4 py-3">
                <Text selectable className="leading-6">
                  {turn.question}
                </Text>
              </Box>
              <AskProgress
                question={turn.question}
                steps={turn.steps ?? []}
                live={busy && pending?.id === turn.id}
                waiting={busy && pending?.id === turn.id && !turn.answer && !turn.ui}
                status={status}
              />
              <AskInteractiveAnswer
                turn={turn}
                streaming={busy && pending?.id === turn.id}
                onAsk={
                  !busy && i === chat.turns.length - 1
                    ? question => {
                        void send(question)
                      }
                    : undefined
                }
              />
              {pending?.id !== turn.id && (
                <>
                  {turn.state !== 'complete' && (
                    <Text className="mt-3 text-xs text-grey">
                      {t(
                        turn.state === 'interrupted'
                          ? 'assistant.interrupted'
                          : 'assistant.unavailable'
                      )}
                    </Text>
                  )}
                  <HStack className="mt-2 items-center gap-1">
                    {!!turn.answer && (
                      <IconButton
                        name={copied === turn.id ? 'check' : 'copy'}
                        label={t('askChat.copy', { defaultValue: 'Copy answer' })}
                        onPress={() => {
                          Clipboard.setString(turn.answer)
                          setCopied(turn.id)
                        }}
                      />
                    )}
                    {i === chat.turns.length - 1 && (
                      <IconButton
                        name="rotate-ccw"
                        label={t('askChat.retry', { defaultValue: 'Retry answer' })}
                        disabled={busy}
                        onPress={() => void send(turn.question, true)}
                      />
                    )}
                    {!!turn.answer && (
                      <IconButton
                        name={reported.includes(turn.id) ? 'check' : 'flag'}
                        label={t('askChat.report', { defaultValue: 'Report answer' })}
                        onPress={() => report(turn)}
                        disabled={reported.includes(turn.id)}
                      />
                    )}
                  </HStack>
                  {!busy &&
                    !turn.ui &&
                    i === chat.turns.length - 1 &&
                    turn.followups?.map(followup => (
                      <Pressable
                        key={followup}
                        onPress={() => void send(followup)}
                        className="mt-2 flex-row items-center justify-between rounded-xl bg-light-grey p-3"
                      >
                        <Text className="flex-1 text-sm">{followup}</Text>
                        <FeatherIcon name="arrow-up-right" size={16} />
                      </Pressable>
                    ))}
                </>
              )}
            </Box>
          ))}
          {!!error && (
            <Text accessibilityRole="alert" className="mt-3 text-sm text-grey">
              {error}
            </Text>
          )}
          {!!consent && (
            <Box className="mt-3 rounded-2xl bg-light-grey p-4">
              <Text>{t('assistant.cyberjudah.consent', { provider: consent.provider })}</Text>
              <HStack className="mt-3 gap-4">
                <Pressable
                  onPress={() => {
                    const providers = agreedProviders()
                    storage.set(
                      consentKey(account),
                      JSON.stringify([...new Set([...providers, consent.provider])])
                    )
                    void send(consent.question, consent.retry)
                  }}
                  className="rounded-full bg-primary px-4 py-3"
                >
                  <Text className="font-bold text-white">{t('assistant.cyberjudah.agree')}</Text>
                </Pressable>
                <Pressable onPress={() => setConsent(null)} className="p-3">
                  <Text className="text-default">{t('assistant.cyberjudah.notNow')}</Text>
                </Pressable>
              </HStack>
            </Box>
          )}
          {!account && (
            <Pressable
              onPress={() => router.push('/profile')}
              className="mt-4 rounded-full bg-primary p-3"
            >
              <Text className="text-center font-bold text-white">{t('assistant.signIn')}</Text>
            </Pressable>
          )}
        </ScrollView>
        {(historyError || unsaved) && (
          <Pressable
            disabled={!unsaved}
            onPress={() => unsaved && void save(unsaved.chat, unsaved.turn)}
            className="px-5 py-2"
          >
            <Text className="text-xs text-grey" accessibilityRole="alert">
              {unsaved
                ? t('askChat.unsaved', {
                    defaultValue: 'This answer has not synced. Tap to retry saving.',
                  })
                : t('askChat.historyUnavailable', {
                    defaultValue: 'Chat history could not sync. Check your connection.',
                  })}
            </Text>
          </Pressable>
        )}
        <Box
          className="w-full self-center px-4 pb-2 pt-2"
          style={{ maxWidth: 760, paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <HStack className="items-end rounded-3xl p-2">
            <AskGlassBackdrop />
            <TextInput
              multiline
              maxLength={questionLimit}
              value={question}
              onChangeText={setQuestion}
              placeholder={t('askChat.placeholder', { defaultValue: 'Message Ask CyberJudah' })}
              placeholderTextColor={colors.grey}
              accessibilityLabel={t('assistant.cyberjudah.placeholder')}
              editable={!!account}
              style={{
                flex: 1,
                color: colors.default,
                fontSize: 16,
                paddingHorizontal: 12,
                paddingTop: 12,
                paddingBottom: 12,
                minHeight: 46,
                maxHeight: 130,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(busy ? 'assistant.stop' : 'assistant.send')}
              disabled={!busy && (!account || question.trim().length < 2)}
              onPress={() => (busy ? active.current?.abort() : void send())}
              className="h-11 w-11 items-center justify-center rounded-full bg-primary"
              style={{ opacity: busy || (account && question.trim().length >= 2) ? 1 : 0.35 }}
            >
              <FeatherIcon name={busy ? 'square' : 'arrow-up'} size={20} color="white" />
            </Pressable>
          </HStack>
          <HStack className="mt-2 justify-between px-2">
            <Text className="flex-1 text-center text-xs text-grey">
              {t('askChat.checkSources', {
                defaultValue: 'AI can make mistakes. Check the sources.',
              })}
            </Text>
            {question.length > questionLimit - 50 && (
              <Text className="text-xs text-grey">
                {question.length}/{questionLimit}
              </Text>
            )}
          </HStack>
        </Box>
      </KeyboardAvoidingView>
      <Modal
        visible={panel !== null}
        animationType="slide"
        onRequestClose={() => setPanel(null)}
        presentationStyle="pageSheet"
      >
        <Container className="bg-reverse">
          <Header
            title={
              panel === 'history'
                ? t('askChat.history', { defaultValue: 'Chat history' })
                : t('askChat.chooseModel', { defaultValue: 'Choose a model' })
            }
            rightComponent={
              <IconButton name="x" label={t('Fermer')} onPress={() => setPanel(null)} />
            }
          />
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
            {panel === 'history' ? (
              <>
                <Pressable onPress={startNew} className="mb-4 rounded-full bg-light-grey p-4">
                  <Text>{t('assistant.new')}</Text>
                </Pressable>
                {!history.length && (
                  <Text className="text-grey">
                    {t('askChat.noChats', { defaultValue: 'Your saved chats will appear here.' })}
                  </Text>
                )}
                {history.map(item => (
                  <HStack key={item.id} className="items-center border-b border-border py-2">
                    <Pressable
                      onPress={() => {
                        setChat({ ...item, turns: [] })
                        setPanel(null)
                        setError('')
                        setQuestion('')
                        setConsent(null)
                        nearBottom.current = true
                      }}
                      className="flex-1 py-3"
                    >
                      <Text numberOfLines={2}>{item.title}</Text>
                      <Text className="mt-1 text-xs text-grey">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </Text>
                    </Pressable>
                    <IconButton
                      name="trash-2"
                      label={t('askChat.delete', { defaultValue: 'Delete chat' })}
                      onPress={() =>
                        Alert.alert(
                          t('askChat.delete', { defaultValue: 'Delete chat' }),
                          t('askChat.deleteNotice', {
                            defaultValue: 'This removes the chat from your account on all devices.',
                          }),
                          [
                            { text: t('Annuler'), style: 'cancel' },
                            {
                              text: t('Supprimer'),
                              style: 'destructive',
                              onPress: () =>
                                void deleteChat(account, item.id)
                                  .then(() => {
                                    if (chat.id === item.id) startNew()
                                  })
                                  .catch(() => setHistoryError(true)),
                            },
                          ]
                        )
                      }
                    />
                  </HStack>
                ))}
              </>
            ) : (
              <>
                <Text className="mb-4 text-sm text-grey">
                  {t('askChat.modelNotice', {
                    defaultValue:
                      'These models use the free Ask allowance. Availability depends on the shared daily limit.',
                  })}
                </Text>
                {models.length ? (
                  models.map(item => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        setModel(item.id)
                        setPanel(null)
                      }}
                      className="mb-3 rounded-2xl bg-light-grey p-4"
                    >
                      <HStack className="items-center gap-3">
                        <Box className="flex-1">
                          <Text className="font-bold">{item.name}</Text>
                          <Text className="mt-1 text-xs text-grey">{item.provider}</Text>
                          {!!item.what && (
                            <Text className="mt-2 text-sm text-grey">{item.what}</Text>
                          )}
                        </Box>
                        {item.id === model && (
                          <FeatherIcon name="check" size={20} color="primary" />
                        )}
                      </HStack>
                    </Pressable>
                  ))
                ) : (
                  <Text>
                    {t('askChat.defaultOnly', {
                      defaultValue:
                        'The default free model is available. More model choices will appear when the service is updated.',
                    })}
                  </Text>
                )}
                <AskCreditsCard account={account} purchasesEnabled={purchasesEnabled} />
              </>
            )}
          </ScrollView>
        </Container>
      </Modal>
    </Container>
  )
}
