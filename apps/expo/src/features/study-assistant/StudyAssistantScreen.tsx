import { useEffect, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native'
import { useSelector } from 'react-redux'
import { selectUserLoginInfo } from '~redux/selectors/user'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams } from 'expo-router'
import Box, { HStack } from '~common/ui/Box'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import { useTheme } from '~themes/ThemeProvider'
import AssistantMarkdown from './AssistantMarkdown'
import CyberJudahChatScreen from './CyberJudahChatScreen'
import { askAssistant } from './client'
import { assistantAccessible, assistantAvailable } from './assistantConfig'
import {
  askCyberJudah,
  CyberJudahAskError,
  isCyberJudahAssistant,
  sourceLink,
  timestamp,
  type CyberJudahSource,
} from './cyberJudahAsk'
import { storage } from '~helpers/storage'
import type { HistoryMessage } from '@bible-strong/ai-contract/contract'

type Turn = { question: string; answer: string; sources?: CyberJudahSource[] }

// The AI providers this reader agreed may receive their questions (Ask CyberJudah only).
const CONSENT_KEY = 'cyberjudah.ask.consent'
const readConsent = (): string[] => {
  try {
    const value = JSON.parse(storage.getString(CONSENT_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
// Ask CyberJudah's own wording where it differs from Bible Strong's assistant.
const CJ_KEYS: Record<string, string> = {
  'assistant.title': 'assistant.cyberjudah.title',
  'assistant.notice': 'assistant.cyberjudah.notice',
  'assistant.heading': 'assistant.cyberjudah.heading',
  'assistant.intro': 'assistant.cyberjudah.intro',
  'assistant.searching': 'assistant.cyberjudah.searching',
  'assistant.placeholder': 'assistant.cyberjudah.placeholder',
}
const keyOf = (key: string) => (isCyberJudahAssistant && CJ_KEYS[key]) || key

/** The class sources an answer cited, each a tap to the moment it was said or to its page. */
function Sources({ sources }: { sources: CyberJudahSource[] }) {
  const { t } = useTranslation()
  if (!sources.length) return null
  return (
    <Box className="mt-3 gap-2">
      <Text className="text-xs font-bold uppercase text-grey">
        {t('assistant.cyberjudah.sources')}
      </Text>
      {sources.map(source => {
        const link = sourceLink(source)
        const detail = [
          source.sub,
          source.date,
          source.video && source.t !== undefined ? timestamp(source.t) : undefined,
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <Pressable
            key={source.n}
            disabled={!link}
            accessibilityRole="link"
            accessibilityLabel={`${source.n}. ${source.title}${detail ? `, ${detail}` : ''}`}
            onPress={() => link && void Linking.openURL(link)}
            className="flex-row gap-3 rounded-xl bg-light-grey p-3"
          >
            <Text className="font-bold text-primary">{source.n}</Text>
            <Box className="flex-1">
              <Text className="font-bold" numberOfLines={2}>
                {source.title}
              </Text>
              {!!detail && (
                <Text className="text-xs text-grey" numberOfLines={1}>
                  {detail}
                </Text>
              )}
            </Box>
          </Pressable>
        )
      })}
    </Box>
  )
}
function BibleStrongAssistantScreen() {
  const { t } = useTranslation()
  const { id: userId } = useSelector(selectUserLoginInfo)
  const { colors } = useTheme()
  const params = useLocalSearchParams<{ context?: string }>()
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [answer, setAnswer] = useState('')
  const [activeQuestion, setActiveQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  // Ask CyberJudah: the provider awaiting the reader's agreement, and the question it holds.
  const [consentFor, setConsentFor] = useState<{ provider: string; question: string } | null>(null)
  const active = useRef<AbortController | null>(null)
  const assistantAccess = assistantAccessible(userId)
  useEffect(
    () => () => {
      active.current?.abort()
      active.current = null
    },
    []
  )
  useEffect(() => {
    active.current?.abort()
    active.current = null
    setBusy(false)
    setProgress('')
    setQuestion('')
    setTurns([])
    setAnswer('')
    setActiveQuestion('')
    setError('')
    setConsentFor(null)
  }, [userId])
  const stop = () => {
    active.current?.abort()
  }
  const send = async (asked?: string) => {
    const current = (asked ?? question).trim()
    if (active.current || !current) return
    const controller = new AbortController()
    active.current = controller
    const deadline = setTimeout(() => controller.abort(), 130000)
    setBusy(true)
    setError('')
    setConsentFor(null)
    setAnswer('')
    setActiveQuestion(current)
    setQuestion('')
    setProgress(t('assistant.preparing'))
    let generated = '',
      completed = false,
      failure = ''
    const history: HistoryMessage[] = turns.slice(-3).flatMap(turn => [
      { role: 'user' as const, content: turn.question },
      { role: 'assistant' as const, content: turn.answer },
    ])
    while (history.reduce((size, m) => size + m.content.length, 0) > 32000) history.splice(0, 2)
    try {
      if (isCyberJudahAssistant) {
        setProgress(t(keyOf('assistant.searching')))
        const reply = await askCyberJudah(
          { question: current, history, consent: readConsent() },
          controller.signal
        )
        if (active.current !== controller) return
        if (controller.signal.aborted) throw new Error('INTERRUPTED')
        setTurns(previous => [
          ...previous,
          { question: current, answer: reply.answer, sources: reply.sources },
        ])
        setActiveQuestion('')
        return
      }
      await askAssistant(
        {
          question: current,
          history,
          readingContext: typeof params.context === 'string' ? params.context.slice(0, 500) : '',
        },
        controller.signal,
        event => {
          if (controller.signal.aborted || active.current !== controller) return
          if (event.type === 'status') setProgress(t('assistant.searching'))
          if (event.type === 'reset') {
            generated = ''
            setAnswer('')
          }
          if (event.type === 'delta') {
            generated += event.text
            setAnswer(generated)
            setProgress(t('assistant.writing'))
          }
          if (event.type === 'error') {
            failure = event.code
            throw new Error(event.code)
          }
          if (event.type === 'done') completed = true
        }
      )
      if (active.current !== controller) return
      if (controller.signal.aborted) throw new Error('INTERRUPTED')
      if (!completed) throw new Error('INCOMPLETE_STREAM')
      setTurns(previous => [...previous, { question: current, answer: generated }])
      setAnswer('')
      setActiveQuestion('')
    } catch (cause) {
      if (active.current !== controller) return
      if (cause instanceof CyberJudahAskError && cause.code === 'CONSENT') {
        setConsentFor({ provider: cause.provider || '', question: current })
        return
      }
      const code = controller.signal.aborted
        ? 'INTERRUPTED'
        : failure || (cause instanceof Error ? cause.message : 'AI_UNAVAILABLE')
      const keys: Record<string, string> = {
        SIGN_IN_REQUIRED: 'assistant.signIn',
        BETA_ACCESS_REQUIRED: 'assistant.betaOnly',
        DAILY_LIMIT: 'assistant.limit',
        INTERRUPTED: 'assistant.interrupted',
        PAUSED: 'assistant.cyberjudah.paused',
      }
      setError(t(keys[code] || 'assistant.unavailable'))
    } finally {
      clearTimeout(deadline)
      if (active.current === controller) {
        active.current = null
        setBusy(false)
        setProgress('')
      }
    }
  }
  const agree = () => {
    if (!consentFor) return
    const agreed = readConsent()
    if (consentFor.provider && !agreed.includes(consentFor.provider)) {
      storage.set(CONSENT_KEY, JSON.stringify([...agreed, consentFor.provider]))
    }
    void send(consentFor.question)
  }
  return (
    <Container>
      <Header
        title={t(keyOf('assistant.title'))}
        hasBackButton
        rightComponent={
          <Pressable
            disabled={busy}
            onPress={() => {
              setTurns([])
              setAnswer('')
              setActiveQuestion('')
              setError('')
              setConsentFor(null)
            }}
          >
            <Text className="text-primary">{t('assistant.new')}</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 32,
            maxWidth: 860,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Text className="mb-5 text-sm text-grey">{t(keyOf('assistant.notice'))}</Text>
          {!turns.length && !activeQuestion && (
            <Box className="py-8">
              <Text className="mb-3 text-2xl font-bold">{t(keyOf('assistant.heading'))}</Text>
              <Text className="text-grey">{t(keyOf('assistant.intro'))}</Text>
            </Box>
          )}
          {turns.map((turn, index) => (
            <Box key={index} className="mb-8">
              <Box className="mb-4 self-end rounded-2xl bg-light-grey p-4">
                <Text>{turn.question}</Text>
              </Box>
              <AssistantMarkdown text={turn.answer} streaming={false} />
              {!!turn.sources && <Sources sources={turn.sources} />}
            </Box>
          ))}
          {!!activeQuestion && (
            <Box className="mb-4 self-end rounded-2xl bg-light-grey p-4">
              <Text>{activeQuestion}</Text>
            </Box>
          )}
          {!!answer && <AssistantMarkdown text={answer} streaming={busy} />}
          {!!consentFor && (
            <Box className="mt-4 rounded-2xl bg-light-grey p-4">
              <Text className="mb-3">
                {t('assistant.cyberjudah.consent', {
                  provider: consentFor.provider || t('assistant.cyberjudah.consentProvider'),
                })}
              </Text>
              <HStack className="gap-3">
                <Pressable
                  accessibilityRole="button"
                  onPress={agree}
                  className="rounded-xl bg-primary px-4 py-3"
                >
                  <Text className="font-bold text-white">{t('assistant.cyberjudah.agree')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setConsentFor(null)
                    setActiveQuestion('')
                  }}
                  className="px-4 py-3"
                >
                  <Text className="text-primary">{t('assistant.cyberjudah.notNow')}</Text>
                </Pressable>
              </HStack>
            </Box>
          )}
          {!!progress && (
            <Text className="mt-3 text-sm text-grey" accessibilityLiveRegion="polite">
              {progress}
            </Text>
          )}
          {!!error && (
            <Text className="mt-4 text-grey" accessibilityRole="alert">
              {error}
            </Text>
          )}
          {!assistantAvailable ? (
            <Text className="mt-4 text-grey">{t('assistant.unavailable')}</Text>
          ) : !userId ? (
            <Text className="mt-4 text-grey">{t('assistant.signIn')}</Text>
          ) : !assistantAccess ? (
            <Text className="mt-4 text-grey">{t('assistant.betaOnly')}</Text>
          ) : null}
        </ScrollView>
        <HStack className="items-end gap-3 border-t border-border p-4">
          <TextInput
            multiline
            maxLength={4000}
            value={question}
            onChangeText={setQuestion}
            placeholder={t(keyOf('assistant.placeholder'))}
            placeholderTextColor={colors.grey}
            accessibilityLabel={t(keyOf('assistant.placeholder'))}
            editable={assistantAccess}
            style={{
              flex: 1,
              color: colors.default,
              backgroundColor: colors.lightGrey,
              borderRadius: 16,
              padding: 14,
              minHeight: 48,
              maxHeight: 160,
            }}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!busy && (!assistantAccess || !question.trim())}
            onPress={
              busy
                ? stop
                : () => {
                    void send()
                  }
            }
            className="rounded-xl bg-primary px-4 py-3"
          >
            <Text className="font-bold text-white">
              {t(busy ? 'assistant.stop' : 'assistant.send')}
            </Text>
          </Pressable>
        </HStack>
      </KeyboardAvoidingView>
    </Container>
  )
}

export default function StudyAssistantScreen() {
  return isCyberJudahAssistant ? <CyberJudahChatScreen /> : <BibleStrongAssistantScreen />
}
