import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  type StyleProp,
  type TextStyle,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { selectUserLoginInfo } from '~redux/selectors/user'
import { storage } from '~helpers/storage'
import Box, { HStack } from '~common/ui/Box'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import AskInteractiveAnswer from './AskInteractiveAnswer'
import AskCreditsCard from './AskCreditsCard'
import AskProgress from './AskProgress'
import AskGlassBackdrop from './AskGlassBackdrop'
import Sheet from '~common/ModalSheet'
import { SheetHeader, SheetView, type SheetRef } from '~common/sheet'
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

/** The same colour at zero opacity, so the scroll-edge fade does not pass through grey. */
function clear(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}00` : 'transparent'
}

/** A long question folds after a few lines, as in the Claude app. */
function QuestionText({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const long = text.length > 280
  return (
    <>
      <Text selectable numberOfLines={long && !open ? 6 : undefined} style={style}>
        {text}
      </Text>
      {long && (
        <Pressable onPress={() => setOpen(!open)} hitSlop={8} accessibilityRole="button">
          <Text className="mt-1 text-grey" style={{ fontSize: 14 }}>
            {open
              ? t('askChat.showLess', { defaultValue: 'Show less' })
              : t('askChat.showMore', { defaultValue: 'Show more' })}
          </Text>
        </Pressable>
      )}
    </>
  )
}

/** What a reader sees for a model: CyberJudah's own names, never a provider's model id. */
export function modelLabel(model: CyberJudahModel | undefined) {
  if (!model) return 'Standard'
  if (/anthropic|claude/i.test(`${model.provider} ${model.id}`))
    return /haiku/i.test(model.id) ? 'Pro Fast' : /opus/i.test(model.id) ? 'Pro Max' : 'Pro'
  if (/deepseek/i.test(model.id)) return 'Deep'
  return 'Standard'
}

/** A model's name as a reader would say it: "gemma-4-26b-a4b-it" reads "Gemma 4 26B". */
export function modelName(model: CyberJudahModel | undefined) {
  if (!model) return 'Standard'
  const name = model.name || model.id.split('/').pop() || model.id
  if (/\s/.test(name)) return name
  return name
    .replace(/-(\d{4}|it|instruct|a\d+b|fp8|awq)(?=-|$)/gi, '')
    .split('-')
    .map(word =>
      /^\d+b$/i.test(word)
        ? word.toUpperCase()
        : /^deepseek$/i.test(word)
          ? 'DeepSeek'
          : /^v\d/i.test(word)
            ? word.toUpperCase()
            : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ')
}

const MODEL_NOTES: Record<string, string> = {
  Standard: 'Quick answers from the classes and the library',
  Deep: 'Thinks longer for harder questions',
  Pro: 'Careful reasoning for study',
  'Pro Fast': 'Quick answers on Pro',
  'Pro Max': 'The strongest reasoning',
}

const STARTER_ICONS: React.ComponentProps<typeof FeatherIcon>['name'][] = [
  'sunrise',
  'users',
  'book-open',
  'calendar',
]

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

/** A round Liquid Glass button for the bar, as in the Claude and ChatGPT apps. */
function GlassCircle({
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
      className="h-11 w-11 items-center justify-center rounded-full"
      style={({ pressed }) => ({ opacity: disabled ? 0.55 : pressed ? 0.7 : 1 })}
    >
      <AskGlassBackdrop radius={22} />
      <FeatherIcon name={name} size={19} />
    </Pressable>
  )
}

/** A gold dot that breathes while CyberJudah is thinking or writing. */
function ThinkingDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0.35)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])
  return (
    <Animated.View
      style={{
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: color,
        opacity: pulse,
        transform: [
          { scale: pulse.interpolate({ inputRange: [0.35, 1], outputRange: [0.8, 1.15] }) },
        ],
        shadowColor: color,
        shadowOpacity: 0.9,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  )
}

/** A response action under an answer: a quiet icon, as in the Claude and ChatGPT apps. */
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
      hitSlop={4}
      className="h-9 w-9 items-center justify-center rounded-full"
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.5 : 1 })}
    >
      <FeatherIcon name={icon} size={17} style={{ color }} />
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
  const [panel, setPanel] = useState<'history' | null>(null)
  const modelSheet = useRef<SheetRef>(null)
  const [models, setModels] = useState<CyberJudahModel[]>([])
  const [model, setModel] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [focused, setFocused] = useState(false)
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
  // The question just sent: once laid out, it is scrolled to the top and the answer grows below it.
  const anchor = useRef('')
  const [viewport, setViewport] = useState(0)
  const input = useRef<TextInput>(null)
  const nearBottom = useRef(true)
  const [awayFromEnd, setAwayFromEnd] = useState(false)
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
        setDefaultModel(result.default)
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
    nearBottom.current = false
    anchor.current = turn.id
    setAwayFromEnd(false)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
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
  const modelLine = modelName(selected)
  // Deep research: the stronger reasoning model, one tap on and off, when the account has it.
  const deepModel = models.find(m => modelLabel(m) === 'Deep')
  const deepOn = !!deepModel && model === deepModel.id
  const canSend = !!account && question.trim().length >= 2

  return (
    <Container className="bg-reverse">
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
            if (awayFromEnd === nearBottom.current) setAwayFromEnd(!nearBottom.current)
          }}
          onLayout={e => setViewport(e.nativeEvent.layout.height)}
          onContentSizeChange={() => {
            // Opening a saved chat lands on its end; a streaming answer is never chased downward.
            if (nearBottom.current && !busy) scroll.current?.scrollToEnd({ animated: false })
          }}
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: insets.top + 72,
            paddingBottom: 24,
            maxWidth: 760,
            width: '100%',
            alignSelf: 'center',
            flexGrow: 1,
          }}
        >
          {!allTurns.length && (
            // The welcome: the lion in a warm gold glow, a serif headline and four suggested prompts.
            <Box className="flex-1 justify-center pb-4">
              <Box className="items-center">
                <Box
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 112,
                    height: 112,
                    backgroundColor: p.accentAt(0.08),
                    borderWidth: 1,
                    borderColor: p.accentAt(0.2),
                    shadowColor: p.accent,
                    shadowOpacity: 0.55,
                    shadowRadius: 48,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                >
                  <Image
                    source={require('~assets/images/icon.png')}
                    style={{ width: 72, height: 72, borderRadius: 18 }}
                    accessible={false}
                  />
                </Box>
                <Text
                  className="mt-8 text-center"
                  style={[
                    ink,
                    {
                      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      fontSize: 30,
                      lineHeight: 37,
                      letterSpacing: -0.4,
                      maxWidth: 340,
                    },
                  ]}
                >
                  {t('askChat.explore', { defaultValue: 'What would you like to explore today?' })}
                </Text>
                <Text
                  className="mt-3 text-center"
                  style={[quiet, { fontSize: 15, lineHeight: 22, maxWidth: 320 }]}
                >
                  {t('askChat.introShort', {
                    defaultValue:
                      'Answers from the classes, the notes and the Scripture, with sources you can check.',
                  })}
                </Text>
              </Box>
              {account ? (
                <Box className="mt-8 flex-row flex-wrap justify-between" style={{ rowGap: 10 }}>
                  {STARTERS.map(([title, subtitle], i) => (
                    <Pressable
                      key={title}
                      onPress={() => void send(title)}
                      accessibilityRole="button"
                      className="rounded-2xl p-[14px]"
                      style={({ pressed }) => ({
                        width: '48.6%',
                        minHeight: 104,
                        backgroundColor: pressed ? p.surface2 : p.surface1,
                        borderWidth: 1,
                        borderColor: pressed ? p.accentAt(0.4) : p.edge,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      })}
                    >
                      <FeatherIcon
                        name={STARTER_ICONS[i] ?? 'search'}
                        size={17}
                        style={{ color: p.accent }}
                      />
                      <Text
                        style={[
                          ink,
                          { fontSize: 15, fontWeight: '600', lineHeight: 20, marginTop: 10 },
                        ]}
                      >
                        {t(`askChat.starter${i}Title`, { defaultValue: title })}
                      </Text>
                      <Text style={[quiet, { fontSize: 13, lineHeight: 18, marginTop: 3 }]}>
                        {t(`askChat.starter${i}Detail`, { defaultValue: subtitle })}
                      </Text>
                    </Pressable>
                  ))}
                </Box>
              ) : (
                <Pressable
                  onPress={() => router.push('/profile')}
                  accessibilityRole="button"
                  className="mt-10 min-h-[52px] w-full items-center justify-center self-center rounded-full"
                  style={({ pressed }) => ({
                    maxWidth: 340,
                    backgroundColor: p.accent,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: p.onAccent, fontSize: 17, fontWeight: '600' }}>
                    {t('assistant.signIn')}
                  </Text>
                </Pressable>
              )}
            </Box>
          )}
          {allTurns.map((turn, i) => (
            <Box
              key={turn.id}
              onLayout={e => {
                if (anchor.current !== turn.id) return
                anchor.current = ''
                const y = e.nativeEvent.layout.y - (insets.top + 64)
                scroll.current?.scrollTo({ y: Math.max(0, y), animated: true })
              }}
              style={{
                marginBottom: 28,
                // The latest exchange can always rise to the top of the screen.
                minHeight:
                  i === allTurns.length - 1 && viewport
                    ? Math.max(0, viewport - (insets.top + 72) - 24)
                    : undefined,
              }}
            >
              {/* Your question: a subtle filled pill on the right. Content stays off the glass layer. */}
              <Box
                className="mb-6 self-end rounded-[22px] px-4 py-[10px]"
                style={{
                  maxWidth: '82%',
                  backgroundColor: p.surface2,
                  borderWidth: 1,
                  borderColor: p.edgeStrong,
                  borderBottomRightRadius: 8,
                }}
              >
                <QuestionText
                  text={turn.question}
                  style={[ink, { fontSize: 16, lineHeight: 24 }]}
                />
              </Box>
              {/* CyberJudah's answer: full width, no bubble. */}
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
                    <Box className="mt-4">
                      {turn.followups.map(followup => (
                        <Pressable
                          key={followup}
                          onPress={() => void send(followup)}
                          className="min-h-11 flex-row items-center gap-[10px] py-[10px]"
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.6 : 1,
                            borderTopWidth: 0.5,
                            borderTopColor: p.edge,
                          })}
                        >
                          <FeatherIcon
                            name="corner-down-right"
                            size={15}
                            style={{ color: p.accent }}
                          />
                          <Text className="flex-1" style={[ink, { fontSize: 15 }]}>
                            {followup}
                          </Text>
                        </Pressable>
                      ))}
                    </Box>
                  )}
                  {/* Copy, Retry and Report: quiet icons under the answer. */}
                  <HStack className="-ml-2 mt-1 items-center">
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
                          void Haptics.selectionAsync().catch(() => {})
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
        {(busy || awayFromEnd) && (
          <HStack pointerEvents="box-none" className="items-center justify-center gap-2 pb-1">
            {busy && (
              <HStack
                className="min-h-9 items-center gap-2 rounded-full px-4"
                accessibilityLiveRegion="polite"
              >
                <AskGlassBackdrop radius={18} />

                <ThinkingDot color={p.accent} />
                <Text
                  numberOfLines={1}
                  style={[ink, { fontSize: 14, fontWeight: '500', maxWidth: 240 }]}
                >
                  {status || t('askChat.writing', { defaultValue: 'Writing the answer' })}
                </Text>
              </HStack>
            )}
            {awayFromEnd && (
              <GlassCircle
                name="arrow-down"
                label={t('askChat.toLatest', { defaultValue: 'Go to the latest' })}
                onPress={() => {
                  nearBottom.current = true
                  setAwayFromEnd(false)
                  scroll.current?.scrollToEnd({ animated: true })
                }}
              />
            )}
          </HStack>
        )}
        {/* The composer: one Liquid Glass card with the question on top and its controls below, as in
            the Claude and ChatGPT apps. Ways in sit above it while the chat is empty. */}
        <Box
          className="w-full self-center px-3 pt-2"
          style={{ maxWidth: 744, paddingBottom: Math.max(insets.bottom, 8) }}
        >
          <Box
            className="rounded-[26px] px-2 pb-2 pt-1"
            style={{
              backgroundColor: p.surface1,
              borderWidth: 1,
              borderColor: busy ? p.accentAt(0.6) : focused ? p.accentAt(0.4) : p.edgeStrong,
              shadowColor: p.accent,
              shadowOpacity: busy ? 0.35 : focused ? 0.18 : 0,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <TextInput
              ref={input}
              multiline
              maxLength={questionLimit}
              value={question}
              onChangeText={setQuestion}
              placeholder={
                !account
                  ? t('askChat.signInToAsk', { defaultValue: 'Sign in to ask' })
                  : allTurns.length
                    ? t('askChat.followUp', { defaultValue: 'Ask a follow-up' })
                    : t('askChat.askAnything', { defaultValue: 'Ask anything about the teachings' })
              }
              placeholderTextColor={p.text3}
              accessibilityLabel={t('assistant.cyberjudah.placeholder')}
              editable={!!account}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              selectionColor={p.accent}
              style={{
                color: p.text1,
                fontSize: 17,
                paddingHorizontal: 10,
                paddingTop: 10,
                paddingBottom: 8,
                minHeight: 44,
                maxHeight: 160,
              }}
            />
            <HStack className="items-center gap-1">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('askChat.options', { defaultValue: 'Models and credits' })}
                onPress={() => modelSheet.current?.present()}
                disabled={!account}
                className="h-9 w-9 items-center justify-center rounded-full"
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: p.edgeStrong,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <FeatherIcon name="plus" size={19} style={{ color: p.text1 }} />
              </Pressable>
              {!!deepModel && (
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: deepOn }}
                  accessibilityLabel={t('askChat.deep', { defaultValue: 'Deep research' })}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => {})
                    setModel(deepOn ? defaultModel : deepModel.id)
                  }}
                  className="h-9 flex-row items-center gap-[6px] rounded-full px-3"
                  style={({ pressed }) => ({
                    backgroundColor: deepOn ? p.accentSoft : 'transparent',
                    borderWidth: 1,
                    borderColor: deepOn ? p.accentAt(0.5) : p.edgeStrong,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <FeatherIcon
                    name="zap"
                    size={14}
                    style={{ color: deepOn ? p.accent : p.text1 }}
                  />
                  <Text
                    style={{ color: deepOn ? p.accent : p.text1, fontSize: 14, fontWeight: '500' }}
                  >
                    {t('askChat.deepShort', { defaultValue: 'Deep' })}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => modelSheet.current?.present()}
                disabled={!account}
                accessibilityRole="button"
                accessibilityLabel={`${t('askChat.chooseModel', { defaultValue: 'Choose a model' })}: ${modelLine}`}
                className="h-9 flex-row items-center gap-1 rounded-full px-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={[ink, { fontSize: 14, fontWeight: '500' }]}>{modelLine}</Text>
                <FeatherIcon name="chevron-down" size={13} style={{ color: p.text1 }} />
              </Pressable>
              <Box className="flex-1" />
              {/* The mic opens the keyboard on the question, where iOS dictation is one tap away. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('askChat.dictate', { defaultValue: 'Speak your question' })}
                onPress={() => input.current?.focus()}
                disabled={!account}
                className="h-9 w-9 items-center justify-center rounded-full"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <FeatherIcon name="mic" size={18} style={{ color: p.text1 }} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(busy ? 'assistant.stop' : 'assistant.send')}
                disabled={!busy && !canSend}
                onPress={() => (busy ? active.current?.abort() : void send())}
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: busy || canSend ? p.accent : p.accentAt(0.25),
                }}
              >
                {busy ? (
                  <Box
                    style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: p.onAccent }}
                  />
                ) : (
                  <FeatherIcon
                    name="arrow-up"
                    size={19}
                    style={{ color: canSend ? p.onAccent : p.accent }}
                  />
                )}
              </Pressable>
            </HStack>
          </Box>
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
      {/* The bar floats: the thread scrolls under round Liquid Glass controls and a soft edge fade,
          as in the Claude, ChatGPT and Perplexity apps (Apple HIG: glass is the control layer). */}
      <Box
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[p.canvas, p.canvas, clear(p.canvas)]}
          locations={[0, 0.55, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 76 }}
        />
        <HStack
          pointerEvents="box-none"
          className="items-center gap-2 px-4"
          style={{ paddingTop: insets.top + 6, paddingBottom: 6 }}
        >
          {router.canGoBack() && (
            <GlassCircle
              name="chevron-left"
              label={t('Retour', { defaultValue: 'Back' })}
              onPress={() => router.back()}
            />
          )}
          <GlassCircle
            name="menu"
            label={t('askChat.history', { defaultValue: 'Your chats' })}
            onPress={() => setPanel('history')}
            disabled={busy || !account}
          />
          <Box className="flex-1 items-center">
            {!!allTurns.length && (
              <Pressable
                onPress={() => setPanel('history')}
                disabled={busy || !account}
                accessibilityRole="button"
                className="min-h-11 max-w-full justify-center rounded-full px-5 py-[5px]"
              >
                <AskGlassBackdrop radius={22} />
                <Text
                  numberOfLines={1}
                  className="text-center"
                  style={[ink, { fontSize: 15, fontWeight: '600' }]}
                >
                  {chat.title || allTurns[0].question}
                </Text>
                <Text numberOfLines={1} className="text-center" style={[quiet, { fontSize: 12 }]}>
                  Ask CyberJudah · {modelLine}
                </Text>
              </Pressable>
            )}
          </Box>
          <GlassCircle
            name="edit"
            label={t('assistant.new', { defaultValue: 'New chat' })}
            onPress={startNew}
            disabled={busy || !allTurns.length}
          />
        </HStack>
      </Box>
      <Modal
        visible={panel === 'history'}
        animationType="slide"
        onRequestClose={() => setPanel(null)}
        presentationStyle="pageSheet"
      >
        <Container className="bg-reverse">
          {/* A sheet header as in the Claude app: a round close button and a centred title. */}
          <HStack className="items-center px-5 pb-2 pt-5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Fermer')}
              onPress={() => setPanel(null)}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={({ pressed }) => ({
                backgroundColor: p.surface1,
                borderWidth: 1,
                borderColor: p.edge,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <FeatherIcon name="x" size={20} style={{ color: p.text1 }} />
            </Pressable>
            <Text
              className="flex-1 text-center"
              style={[ink, { fontSize: 18, fontWeight: '700', marginRight: 44 }]}
            >
              {t('askChat.yourChats', { defaultValue: 'Your chats' })}
            </Text>
          </HStack>
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
            ) : null}
          </ScrollView>
        </Container>
      </Modal>
      {/* The model picker is Bible Strong's own drawer, like the app's other choosers. */}
      <Sheet
        ref={modelSheet}
        snapPoints={['auto']}
        header={
          <SheetHeader
            centerTitle
            title={t('askChat.selectModel', { defaultValue: 'Select model' })}
          />
        }
      >
        <SheetView className="px-5 pb-4 pt-5">
          {models.length ? (
            // One rounded group per tier: each row the model's name and what it is for, a tick on
            // the chosen one, as in the Claude app's model sheet.
            [
              ['', models.filter(m => m.id.startsWith('@cf/'))] as const,
              ['Pro', models.filter(m => !m.id.startsWith('@cf/'))] as const,
            ]
              .filter(([, list]) => list.length)
              .map(([group, list]) => (
                <Box key={group || 'included'} className="mb-5">
                  {!!group && (
                    <Text
                      style={[
                        quiet,
                        { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
                      ]}
                    >
                      {group}
                    </Text>
                  )}
                  <Box
                    className="overflow-hidden rounded-3xl"
                    style={{ backgroundColor: p.surface1 }}
                  >
                    {list.map((item, row) => (
                      <Pressable
                        key={item.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: item.id === model }}
                        onPress={() => {
                          void Haptics.selectionAsync().catch(() => {})
                          setModel(item.id)
                          modelSheet.current?.dismiss()
                        }}
                        className="flex-row items-center px-5"
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                      >
                        <Box
                          className="flex-1 flex-row items-center py-[18px]"
                          style={{
                            borderTopWidth: row ? 1 : 0,
                            borderTopColor: p.edge,
                          }}
                        >
                          <Box className="flex-1">
                            <Text style={[ink, { fontSize: 18, fontWeight: '500' }]}>
                              {modelName(item)}
                            </Text>
                            <Text style={[quiet, { fontSize: 15, marginTop: 4 }]}>
                              {MODEL_NOTES[modelLabel(item)]}
                            </Text>
                          </Box>
                          {item.id === model && (
                            <FeatherIcon name="check" size={22} style={{ color: p.accent }} />
                          )}
                        </Box>
                      </Pressable>
                    ))}
                  </Box>
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
          <Text className="mb-4 px-1 text-sm" style={{ color: p.text3 }}>
            {t('askChat.modelNotice', {
              defaultValue:
                'These models use the free Ask allowance. Availability depends on the shared daily limit.',
            })}
          </Text>
          <AskCreditsCard account={account} purchasesEnabled={purchasesEnabled} />
        </SheetView>
      </Sheet>
    </Container>
  )
}
