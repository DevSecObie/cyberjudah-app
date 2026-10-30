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
import { Image } from 'expo-image'
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
import AskInteractiveAnswer from './AskInteractiveAnswer'
import AskCreditsCard from './AskCreditsCard'
import AskProgress from './AskProgress'
import AskGlassBackdrop from './AskGlassBackdrop'
import { useAskPalette } from './askPalette'
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
  color,
}: {
  name: React.ComponentProps<typeof FeatherIcon>['name']
  label: string
  onPress: () => void
  disabled?: boolean
  color?: string
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
      <FeatherIcon name={name} size={21} style={color ? { color } : undefined} />
    </Pressable>
  )
}

/** A response action as on cyberjudah.io/app: an icon and its word, quiet until pressed. */
function ActionPill({
  icon,
  label,
  color,
  onPress,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof FeatherIcon>['name']
  label: string
  color: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className="min-h-9 flex-row items-center gap-[6px] rounded-full px-[10px]"
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <FeatherIcon name={icon} size={16} style={{ color }} />
      <Text style={{ color, fontSize: 13, fontWeight: '500' }}>{label}</Text>
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
  const p = useAskPalette()
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

  const ink = { color: p.text1 }
  const quiet = { color: p.text3 }
  const card = { backgroundColor: p.surface1, borderWidth: 0.5, borderColor: p.edge }
  const modelLine = selected
    ? `${selected.name.replace(/^Claude /, '')}${selected.id.startsWith('@cf/') ? ' · free' : ''}`
    : t('askChat.freeModel', { defaultValue: 'Answers from the teachings' })

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
              label={t('askChat.history', { defaultValue: 'Your chats' })}
              onPress={() => setPanel('history')}
              disabled={busy || !account}
            />
            <IconButton
              name="edit"
              label={t('assistant.new', { defaultValue: 'New chat' })}
              onPress={startNew}
              disabled={busy || !allTurns.length}
            />
          </HStack>
        }
      >
        <Pressable
          onPress={() => setPanel('models')}
          disabled={busy || !account}
          accessibilityRole="button"
          accessibilityLabel={`${t('askChat.chooseModel', { defaultValue: 'Choose a model' })}: ${modelLine}`}
          className="mx-5 mb-3 min-h-11 flex-row items-center gap-2 self-start rounded-full px-3 py-2"
        >
          <AskGlassBackdrop radius={100} />
          <Text className="text-xs">{modelLine}</Text>
          <FeatherIcon name="chevron-down" size={14} color="grey" />
        </Pressable>
      </Header>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            paddingHorizontal: 18,
            paddingTop: 20,
            paddingBottom: 24,
            maxWidth: 760,
            width: '100%',
            alignSelf: 'center',
            flexGrow: 1,
          }}
        >
          {!allTurns.length && (
            // The welcome: the lion, a question, a line, and four ways in.
            <Box className="flex-1 items-center justify-center py-7">
              <Image
                source={require('~assets/images/icon.png')}
                style={{ width: 76, height: 76, borderRadius: 18 }}
                accessible={false}
              />
              <Text
                className="mt-4 text-center"
                style={[
                  ink,
                  { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, lineHeight: 34 },
                ]}
              >
                {t('askChat.welcome', { defaultValue: 'What would you like to learn?' })}
              </Text>
              <Text
                className="mt-3 text-center"
                style={[quiet, { fontSize: 15, lineHeight: 22, maxWidth: 330 }]}
              >
                {t('askChat.intro', {
                  defaultValue:
                    'Ask about anything that was taught. Every answer comes from the classes, the notes, the law and the Scripture, and shows where it came from.',
                })}
              </Text>
              <Box className="mt-5 w-full flex-row flex-wrap" style={{ gap: 10 }}>
                {STARTERS.map(([title, subtitle], i) => (
                  <Pressable
                    key={title}
                    onPress={() => void send(title)}
                    disabled={!account}
                    accessibilityRole="button"
                    className="rounded-2xl px-[14px] py-[13px]"
                    style={({ pressed }) => [
                      card,
                      {
                        width: '48.5%',
                        minHeight: 86,
                        opacity: !account ? 0.4 : pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text style={[ink, { fontSize: 15, fontWeight: '600', lineHeight: 20 }]}>
                      {t(`askChat.starter${i}Title`, { defaultValue: title })}
                    </Text>
                    <Text style={[quiet, { fontSize: 13, lineHeight: 18, marginTop: 4 }]}>
                      {t(`askChat.starter${i}Detail`, { defaultValue: subtitle })}
                    </Text>
                  </Pressable>
                ))}
              </Box>
            </Box>
          )}
          {allTurns.map((turn, i) => (
            <Box key={turn.id} style={{ marginBottom: 28 }}>
              {/* Your question: a quiet bubble on the right. */}
              <Box
                className="mb-5 self-end px-4 py-[11px]"
                style={{
                  maxWidth: '84%',
                  backgroundColor: p.surface2,
                  borderRadius: 20,
                  borderBottomRightRadius: 6,
                }}
              >
                <Text selectable style={[ink, { fontSize: 16, lineHeight: 24 }]}>
                  {turn.question}
                </Text>
              </Box>
              {/* CyberJudah's answer: the lion and the name, then the research and the prose. */}
              <HStack className="mb-2 items-center gap-2">
                <Image
                  source={require('~assets/images/icon.png')}
                  style={{ width: 24, height: 24, borderRadius: 6 }}
                  accessible={false}
                />
                <Text style={[ink, { fontSize: 13, fontWeight: '600' }]}>CyberJudah</Text>
              </HStack>
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
                    <Box
                      className="mt-3 rounded-xl px-[14px] py-3"
                      style={[card, { borderLeftWidth: 3, borderLeftColor: '#e5484d' }]}
                    >
                      <Text style={[ink, { fontSize: 15 }]}>
                        {t(
                          turn.state === 'interrupted'
                            ? 'assistant.interrupted'
                            : 'assistant.unavailable'
                        )}
                      </Text>
                    </Box>
                  )}
                  {!busy && !turn.ui && i === chat.turns.length - 1 && !!turn.followups?.length && (
                    <Box className="mt-3 gap-2">
                      {turn.followups.map(followup => (
                        <Pressable
                          key={followup}
                          onPress={() => void send(followup)}
                          className="min-h-11 flex-row items-center gap-[10px] rounded-xl px-[14px] py-[10px]"
                          style={({ pressed }) => [card, { opacity: pressed ? 0.75 : 1 }]}
                        >
                          <FeatherIcon
                            name="arrow-up-right"
                            size={14}
                            style={{ color: p.accent }}
                          />
                          <Text
                            className="flex-1"
                            style={[ink, { fontSize: 15, fontWeight: '500' }]}
                          >
                            {followup}
                          </Text>
                        </Pressable>
                      ))}
                    </Box>
                  )}
                  {/* Copy, Retry and Report: always there, quiet until used. */}
                  <HStack className="-ml-2 mt-2 flex-wrap items-center gap-1">
                    {!!turn.answer && (
                      <ActionPill
                        icon={copied === turn.id ? 'check' : 'copy'}
                        label={
                          copied === turn.id
                            ? t('askChat.copied', { defaultValue: 'Copied' })
                            : t('askChat.copyShort', { defaultValue: 'Copy' })
                        }
                        color={p.text3}
                        onPress={() => {
                          Clipboard.setString(turn.answer)
                          setCopied(turn.id)
                        }}
                      />
                    )}
                    {i === chat.turns.length - 1 && (
                      <ActionPill
                        icon="rotate-ccw"
                        label={t('askChat.retryShort', { defaultValue: 'Retry' })}
                        color={p.text3}
                        disabled={busy}
                        onPress={() => void send(turn.question, true)}
                      />
                    )}
                    {!!turn.answer && (
                      <ActionPill
                        icon={reported.includes(turn.id) ? 'check' : 'flag'}
                        label={
                          reported.includes(turn.id)
                            ? t('askChat.reported', { defaultValue: 'Reported' })
                            : t('askChat.reportShort', { defaultValue: 'Report' })
                        }
                        color={p.text3}
                        onPress={() => report(turn)}
                        disabled={reported.includes(turn.id)}
                      />
                    )}
                  </HStack>
                </>
              )}
            </Box>
          ))}
          {!!error && (
            <Box
              className="mt-3 rounded-xl px-[14px] py-3"
              style={[card, { borderLeftWidth: 3, borderLeftColor: '#e5484d' }]}
            >
              <Text accessibilityRole="alert" style={[ink, { fontSize: 15 }]}>
                {error}
              </Text>
            </Box>
          )}
          {!!consent && (
            <Box className="mt-3 gap-[14px] rounded-2xl p-4" style={card}>
              <HStack className="items-center gap-3">
                <Box
                  className="h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: p.accentSoft }}
                >
                  <FeatherIcon name="shield" size={20} style={{ color: p.accent }} />
                </Box>
                <Text className="flex-1" style={[ink, { fontSize: 16, fontWeight: '600' }]}>
                  {t('assistant.cyberjudah.consent', { provider: consent.provider })}
                </Text>
              </HStack>
              <Pressable
                onPress={() => {
                  const providers = agreedProviders()
                  storage.set(
                    consentKey(account),
                    JSON.stringify([...new Set([...providers, consent.provider])])
                  )
                  void send(consent.question, consent.retry)
                }}
                className="min-h-12 items-center justify-center rounded-full"
                style={{ backgroundColor: p.accent }}
              >
                <Text style={{ color: p.onAccent, fontWeight: '600' }}>
                  {t('assistant.cyberjudah.agree')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setConsent(null)}
                className="min-h-11 items-center justify-center rounded-full"
                style={{ borderWidth: 1, borderColor: p.edge }}
              >
                <Text style={[ink, { fontWeight: '600' }]}>{t('assistant.cyberjudah.notNow')}</Text>
              </Pressable>
            </Box>
          )}
          {!account && (
            <Box
              className="mt-2 gap-3 rounded-2xl px-4 py-[14px]"
              style={[card, { borderLeftWidth: 3, borderLeftColor: p.accent }]}
            >
              <Text style={[quiet, { fontSize: 15 }]}>
                {t('askChat.signInNote', {
                  defaultValue:
                    'Sign in to your CyberJudah account to use Ask and keep your chats.',
                })}
              </Text>
              <Pressable
                onPress={() => router.push('/profile')}
                className="self-start rounded-full px-5 py-3"
                style={{ backgroundColor: p.accent }}
              >
                <Text style={{ color: p.onAccent, fontWeight: '600' }}>
                  {t('assistant.signIn')}
                </Text>
              </Pressable>
            </Box>
          )}
        </ScrollView>
        {(historyError || unsaved) && (
          <Pressable
            disabled={!unsaved}
            onPress={() => unsaved && void save(unsaved.chat, unsaved.turn)}
            className="px-5 py-2"
          >
            <Text style={[quiet, { fontSize: 12 }]} accessibilityRole="alert">
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
        {/* The composer: a solid capsule, the send button round in the accent. */}
        <Box
          className="w-full self-center px-3 pt-2"
          style={{ maxWidth: 744, paddingBottom: Math.max(insets.bottom, 8) }}
        >
          <HStack className="items-end rounded-3xl p-2">
            <AskGlassBackdrop />
            <TextInput
              multiline
              maxLength={questionLimit}
              value={question}
              onChangeText={setQuestion}
              placeholder={
                !account
                  ? t('askChat.signInToAsk', { defaultValue: 'Sign in to ask' })
                  : allTurns.length
                    ? t('askChat.followUp', { defaultValue: 'Ask a follow-up' })
                    : 'Ask CyberJudah'
              }
              placeholderTextColor={p.text4}
              accessibilityLabel={t('assistant.cyberjudah.placeholder')}
              editable={!!account}
              style={{
                flex: 1,
                color: p.text1,
                fontSize: 17,
                paddingHorizontal: 8,
                paddingTop: 9,
                paddingBottom: 9,
                minHeight: 40,
                maxHeight: 160,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(busy ? 'assistant.stop' : 'assistant.send')}
              disabled={!busy && (!account || question.trim().length < 2)}
              onPress={() => (busy ? active.current?.abort() : void send())}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: busy
                  ? p.text1
                  : account && question.trim().length >= 2
                    ? p.accent
                    : p.surface2,
              }}
            >
              {busy ? (
                <Box
                  style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: p.canvas }}
                />
              ) : (
                <FeatherIcon
                  name="arrow-up"
                  size={20}
                  style={{ color: account && question.trim().length >= 2 ? p.onAccent : p.text4 }}
                />
              )}
            </Pressable>
          </HStack>
          <HStack className="mt-[6px] justify-center px-2">
            <Text className="text-center" style={[quiet, { fontSize: 11.5 }]}>
              {t('askChat.checkSources', {
                defaultValue: 'Answers can be wrong. Check them against the sources.',
              })}
            </Text>
            {question.length > questionLimit - 50 && (
              <Text style={[quiet, { fontSize: 11.5 }]}>
                {'  '}
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
                ? t('askChat.yourChats', { defaultValue: 'Your chats' })
                : t('askChat.model', { defaultValue: 'Model' })
            }
            rightComponent={
              <IconButton name="x" label={t('Fermer')} onPress={() => setPanel(null)} />
            }
          />
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
            {panel === 'history' ? (
              <>
                <Pressable
                  onPress={startNew}
                  className="mb-4 flex-row items-center gap-2 rounded-full p-4"
                  style={{ backgroundColor: p.surface2 }}
                >
                  <FeatherIcon name="edit" size={18} style={{ color: p.text1 }} />
                  <Text style={{ color: p.text1, fontWeight: '600' }}>{t('assistant.new')}</Text>
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
                      <Text numberOfLines={2} style={{ color: p.text1, fontWeight: '500' }}>
                        {item.title}
                      </Text>
                      <Text className="mt-1 text-xs" style={{ color: p.text3 }}>
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
                <Text className="mb-2 text-sm" style={{ color: p.text3 }}>
                  {t('askChat.modelNotice', {
                    defaultValue:
                      'These models use the free Ask allowance. Availability depends on the shared daily limit.',
                  })}
                </Text>
                {models.length ? (
                  // As on cyberjudah.io/app: the free models first, then each provider's.
                  [
                    ['Free, Always', models.filter(m => m.id.startsWith('@cf/'))] as const,
                    ...[
                      ...new Set(models.filter(m => !m.id.startsWith('@cf/')).map(m => m.provider)),
                    ].map(
                      g =>
                        [
                          g,
                          models.filter(m => !m.id.startsWith('@cf/') && m.provider === g),
                        ] as const
                    ),
                  ]
                    .filter(([, list]) => list.length)
                    .map(([group, list]) => (
                      <Box key={group} className="mb-2 gap-2">
                        <Text
                          style={{ color: p.text3, fontSize: 13, fontWeight: '600', marginTop: 8 }}
                        >
                          {group}
                        </Text>
                        {list.map(item => (
                          <Pressable
                            key={item.id}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: item.id === model }}
                            onPress={() => {
                              setModel(item.id)
                              setPanel(null)
                            }}
                            className="min-h-14 flex-row items-center gap-3 rounded-[14px] p-3"
                            style={{
                              backgroundColor: p.surface2,
                              borderWidth: item.id === model ? 2 : 0,
                              borderColor: p.accent,
                            }}
                          >
                            <Box className="flex-1">
                              <Text style={{ color: p.text1, fontWeight: '600' }}>{item.name}</Text>
                              {!!item.what && (
                                <Text style={{ color: p.text3, fontSize: 13, marginTop: 2 }}>
                                  {item.what}
                                </Text>
                              )}
                            </Box>
                            {item.id.startsWith('@cf/') && (
                              <Text style={{ color: p.accent, fontSize: 13, fontWeight: '600' }}>
                                Free
                              </Text>
                            )}
                            {item.id === model && (
                              <FeatherIcon name="check" size={18} style={{ color: p.accent }} />
                            )}
                          </Pressable>
                        ))}
                      </Box>
                    ))
                ) : (
                  <Text style={{ color: p.text3 }}>
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
