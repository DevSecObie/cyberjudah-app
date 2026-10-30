import { Component, createContext, useContext, useState, type ReactNode } from 'react'
import { createLibrary, defineComponent, Renderer } from '@openuidev/react-lang'
import { z } from 'zod/v4'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import AskSourceCards from './AskSourceCards'
import AskVerseComparison from './AskVerseComparison'
import {
  askStudyCardsData,
  askStudyCardsProgram,
  selectStudyItems,
  type AskStudyCardsData,
} from './askStudyCardsData'
import type { ChatTurn } from './cyberJudahConversations'

const CardsContext = createContext<AskStudyCardsData>({ sources: [], passages: [] })

function Sources({ indices }: { indices: number[] }) {
  const data = useContext(CardsContext)
  return <AskSourceCards sources={selectStudyItems(data.sources, indices, 12)} />
}
function Verses({ indices }: { indices: number[] }) {
  const data = useContext(CardsContext)
  return (
    <AskVerseComparison
      passages={selectStudyItems(data.passages, indices, 4)}
      compareWords={false}
    />
  )
}

const SourceCards = defineComponent({
  name: 'SourceCards',
  description: 'The cited CyberJudah sources, with original thumbnails and source links.',
  props: z.object({ indices: z.array(z.number().int().min(0).max(11)).max(12) }),
  component: ({ props }) => <Sources indices={props.indices} />,
})
const VerseComparison = defineComponent({
  name: 'VerseComparison',
  description: 'Read related passages from Bible resources and open them in Bible Strong’s reader.',
  props: z.object({ indices: z.array(z.number().int().min(0).max(3)).max(4) }),
  component: ({ props }) => <Verses indices={props.indices} />,
})
const StudyAnswer = defineComponent({
  name: 'StudyAnswer',
  description: 'Native study cards below the existing streaming Ask answer.',
  props: z.object({ children: z.array(z.union([SourceCards.ref, VerseComparison.ref])).max(2) }),
  component: ({ props, renderNode }) => (
    <Box>
      {props.children.map((child, i) => (
        <Box key={i}>{renderNode(child)}</Box>
      ))}
    </Box>
  ),
})
export const askStudyLibrary = createLibrary({
  components: [StudyAnswer, SourceCards, VerseComparison],
  root: 'StudyAnswer',
})

class CardsBoundary extends Component<
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

function RenderCards({ data }: { data: AskStudyCardsData }) {
  const [failed, setFailed] = useState(false)
  const fallback = (
    <>
      <AskSourceCards sources={data.sources} />
      <AskVerseComparison passages={data.passages} compareWords={false} />
    </>
  )
  return (
    <CardsContext.Provider value={data}>
      <CardsBoundary fallback={fallback}>
        {failed ? (
          fallback
        ) : (
          <Renderer
            response={askStudyCardsProgram(data)}
            library={askStudyLibrary}
            isStreaming={false}
            publishObservability={false}
            onError={errors => {
              if (errors.length) setFailed(true)
            }}
          />
        )}
      </CardsBoundary>
    </CardsContext.Provider>
  )
}

export default function AskStudyCards({ turn, streaming }: { turn: ChatTurn; streaming: boolean }) {
  const version = useDefaultBibleVersion()
  const { i18n } = useTranslation()
  // Preserve source cards while streaming or interrupted. Parse passages once the answer ends.
  if (streaming || turn.state !== 'complete') return <AskSourceCards sources={turn.sources} />
  const data = askStudyCardsData(
    turn.question,
    turn.answer,
    turn.sources,
    version,
    i18n.language.startsWith('fr') ? 'fr' : 'en'
  )
  return <RenderCards key={`${turn.id}:${version}`} data={data} />
}
