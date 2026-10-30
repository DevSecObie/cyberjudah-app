import { Component, createContext, useContext, type ReactNode } from 'react'
import {
  createLibrary,
  createParser,
  defineComponent,
  Renderer,
  type ElementNode,
} from '@openuidev/react-lang'
import { z } from 'zod/v4'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { Pressable } from 'react-native'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import AssistantMarkdown from './AssistantMarkdown'
import AskSourceCards from './AskSourceCards'
import AskStudyCards from './AskStudyCards'
import AskVerseComparison from './AskVerseComparison'
import { askStudyCardsData } from './askStudyCardsData'
import { linkedAnswer, type ChatTurn } from './cyberJudahConversations'
import { sourceLink, type CyberJudahSource } from './cyberJudahAsk'
import { STUDY_DESTINATIONS, studyDestinations, type StudyDestination } from './askStudyNavigation'
import { useOpenStudySource } from './useOpenStudySource'

type StudyContext = {
  sources: CyberJudahSource[]
  streaming: boolean
  ask?: (question: string) => void
  open: (source: CyberJudahSource) => void
}
const StudyContext = createContext<StudyContext>({ sources: [], streaming: false, open: () => {} })
const refs = z.array(z.number().int().min(1).max(24)).min(1).max(8)

function Explanation({
  text,
  citations,
  kind,
}: {
  text: string
  citations: number[]
  kind: 'teaching' | 'reference'
}) {
  const context = useContext(StudyContext)
  const { t } = useTranslation()
  const sources = context.sources.filter(s => citations.includes(s.n))
  return (
    <Box className="mb-4 gap-2">
      <Text className="text-[13px] text-grey">
        {t(kind === 'teaching' ? 'askStudy.teaching' : 'askStudy.context')}
      </Text>
      <AssistantMarkdown
        text={linkedAnswer(text, sources, sourceLink)}
        streaming={context.streaming}
        onLinkPress={url => {
          const source = sources.find(s => sourceLink(s) === url)
          if (!source) return false
          context.open(source)
          return true
        }}
      />
    </Box>
  )
}
function ResourceSources({ numbers }: { numbers: number[] }) {
  const context = useContext(StudyContext)
  return (
    <AskSourceCards
      sources={context.sources.filter(s => numbers.includes(s.n))}
      onOpenSource={context.open}
    />
  )
}
function Scriptures({ references }: { references: string[] }) {
  const { i18n } = useTranslation()
  const data = askStudyCardsData(
    references.join('; '),
    '',
    [],
    'KJV',
    i18n.language.startsWith('fr') ? 'fr' : 'en'
  )
  return <AskVerseComparison passages={data.passages} compareWords={false} />
}
function ExploreResource({ resource }: { resource: StudyDestination }) {
  const router = useRouter()
  const { t } = useTranslation()
  const destination = studyDestinations[resource]
  // People are opened from actual person source IDs; there is no separate directory route.
  if (!destination) return null
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(destination.route)}
      className="mt-3 flex-row items-center gap-3 rounded-xl bg-light-grey p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <FeatherIcon name="book-open" size={16} color="grey" />
      <Text className="flex-1 text-sm">
        {t(`askStudy.open.${resource}`, { defaultValue: destination.label })}
      </Text>
      <FeatherIcon name="chevron-right" size={16} color="grey" />
    </Pressable>
  )
}
function NextQuestion({ question }: { question: string }) {
  const { ask, streaming } = useContext(StudyContext)
  if (!ask || streaming) return null
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => ask(question)}
      className="mt-3 flex-row items-center gap-3 rounded-xl bg-light-grey p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <Text className="flex-1 text-sm">{question}</Text>
      <FeatherIcon name="arrow-up-right" size={16} color="grey" />
    </Pressable>
  )
}
const Teaching = defineComponent({
  name: 'Teaching',
  description: 'Source-backed explanation of the recorded teaching.',
  props: z.object({ text: z.string().min(1).max(6000), citations: refs }),
  component: ({ props }) => <Explanation {...props} kind="teaching" />,
})
const Context = defineComponent({
  name: 'Context',
  description: 'Supporting reference context.',
  props: z.object({ text: z.string().min(1).max(4000), citations: refs }),
  component: ({ props }) => <Explanation {...props} kind="reference" />,
})
const Sources = defineComponent({
  name: 'Sources',
  description: 'Retrieved native source previews.',
  props: z.object({ numbers: z.array(z.number().int().min(1).max(24)).min(1).max(12) }),
  component: ({ props }) => <ResourceSources {...props} />,
})
const RelatedScriptures = defineComponent({
  name: 'RelatedScriptures',
  description: 'Related KJV scriptures.',
  props: z.object({ references: z.array(z.string().min(3).max(80)).min(1).max(4) }),
  component: ({ props }) => <Scriptures {...props} />,
})
const Explore = defineComponent({
  name: 'Explore',
  description: 'Open an existing app study resource.',
  props: z.object({ resource: z.enum(STUDY_DESTINATIONS) }),
  component: ({ props }) => <ExploreResource {...props} />,
})
const FollowUp = defineComponent({
  name: 'FollowUp',
  description: 'A reader-selected next question.',
  props: z.object({ question: z.string().min(4).max(300) }),
  component: ({ props }) => <NextQuestion {...props} />,
})
const StudyAnswer = defineComponent({
  name: 'StudyAnswer',
  description: 'Native interactive study answer.',
  props: z.object({
    children: z
      .array(
        z.union([
          Teaching.ref,
          Context.ref,
          Sources.ref,
          RelatedScriptures.ref,
          Explore.ref,
          FollowUp.ref,
        ])
      )
      .max(16),
  }),
  component: ({ props, renderNode }) => (
    <Box>
      {props.children.map((child, i) => (
        <Box key={i}>{renderNode(child)}</Box>
      ))}
    </Box>
  ),
})
export const interactiveStudyLibrary = createLibrary({
  components: [StudyAnswer, Teaching, Context, Sources, RelatedScriptures, Explore, FollowUp],
  root: 'StudyAnswer',
})

/** Validate again on history replay, including source provenance. No executable actions,
 * queries, mutations, dynamic props or unknown components can enter the native renderer. */
export function isInteractiveStudySafe(program: string, sources: CyberJudahSource[]) {
  if (program.length > 60000) return false
  try {
    const result = createParser(
      interactiveStudyLibrary.toJSONSchema(),
      interactiveStudyLibrary.root
    ).parse(program)
    if (
      !result.root ||
      result.root.typeName !== 'StudyAnswer' ||
      result.rootExpression ||
      result.meta.incomplete ||
      result.meta.errors.length ||
      result.meta.unresolved.length ||
      result.meta.orphaned.length ||
      result.queryStatements.length ||
      result.mutationStatements.length ||
      Object.keys(result.stateDeclarations).length
    )
      return false
    const children = result.root.props.children
    if (!Array.isArray(children) || children.length > 16) return false
    return children.every((child: ElementNode | null) => {
      if (!child || child.partial || child.hasDynamicProps === true) return false
      const p = child.props
      if (
        child.typeName === 'Teaching' ||
        child.typeName === 'Context' ||
        child.typeName === 'Sources'
      ) {
        const numbers = child.typeName === 'Sources' ? p.numbers : p.citations
        return (
          Array.isArray(numbers) &&
          numbers.length > 0 &&
          numbers.every(n =>
            sources.some(
              s => s.n === n && (child.typeName !== 'Teaching' || s.evidence === 'teaching')
            )
          )
        )
      }
      return ['RelatedScriptures', 'Explore', 'FollowUp'].includes(child.typeName)
    })
  } catch {
    return false
  }
}

class StudyBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
export default function AskInteractiveAnswer({
  turn,
  streaming,
  onAsk,
}: {
  turn: ChatTurn
  streaming: boolean
  onAsk?: (question: string) => void
}) {
  const open = useOpenStudySource()
  const { t } = useTranslation()
  const fallback = (
    <>
      {!!turn.answer && (
        <AssistantMarkdown
          text={linkedAnswer(turn.answer, turn.sources, sourceLink)}
          streaming={streaming}
        />
      )}
      <AskStudyCards turn={turn} streaming={streaming} />
    </>
  )
  if (!turn.ui || !isInteractiveStudySafe(turn.ui, turn.sources)) return fallback
  return (
    <StudyContext.Provider
      value={{
        sources: turn.sources,
        streaming,
        ask: onAsk,
        open: source => {
          void open(source)
        },
      }}
    >
      <StudyBoundary key={turn.id} fallback={fallback}>
        {!streaming && !turn.teachingFound && (
          <Text className="mb-4 text-sm leading-6 text-grey">{t('askStudy.noTeaching')}</Text>
        )}
        <Renderer
          response={turn.ui}
          library={interactiveStudyLibrary}
          isStreaming={false}
          publishObservability={false}
        />
      </StudyBoundary>
    </StudyContext.Provider>
  )
}
