import { useQueries } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { TouchableBox, VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import AskGlassBackdrop from '~features/study-assistant/AskGlassBackdrop'
import { goBackOrHome } from '~navigation/goBackOrHome'
import { markEntitySliceAsRead } from '~redux/modules/plan'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { entityReadingKey, finishReading } from './finishedReading'
import { getChaptersForPlan, useComputedPlan } from './plan.hooks'
import { getEntitySliceKey } from './planProgress'
import { buildPlanQuiz, type QuizVerse } from './planQuiz'

const ASKED = {
  word: 'Which word completes the verse?',
  chapter: 'Which chapter is this verse from?',
}

/** The day's ten questions, one at a time, on the app's own glass. */
const PlanQuizScreen = () => {
  const {
    planId = '',
    readingSliceId = '',
    entitySliceId = '',
  } = useLocalSearchParams<{ planId?: string; readingSliceId?: string; entitySliceId?: string }>()
  const router = useRouter()
  const dispatch = useDispatch()
  const theme = useTheme()
  const version = useDefaultBibleVersion()
  const plan = useComputedPlan(planId)
  const reading = plan?.sections
    .flatMap(section => section.data)
    .find(item => item.id === readingSliceId)
  const slice = reading?.slices.find(
    (item, index) => getEntitySliceKey(reading.id, item, index) === entitySliceId
  )
  const passages = slice?.type === 'Quiz' ? slice.chapters : []

  // The day's chapters, as the reader shows them.
  const chapters = useQueries({
    queries: passages.map(chapters => ({
      queryKey: ['plan-chapters', version, chapters],
      queryFn: () => getChaptersForPlan(chapters, version),
      staleTime: Infinity,
    })),
  })
  const loaded = chapters.every(query => query.data)
  const questions = useMemo(() => {
    if (!loaded) return []
    const verses: QuizVerse[] = chapters.flatMap(query =>
      query.data!.chapters.flatMap(chapter => {
        const chapterName = `${query.data!.bookName} ${chapter.viewMore.params.chapter}`
        return chapter.verses.map(verse => ({
          chapterName,
          reference: `${chapterName}:${verse.Verset}`,
          text: verse.Texte,
        }))
      })
    )
    return buildPlanQuiz(verses, `${planId}/${readingSliceId}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, planId, readingSliceId])

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const question = questions[index]
  const chosen = answers[index]
  const done = questions.length > 0 && index >= questions.length

  const goBack = () => goBackOrHome(router)
  const finish = () => {
    // Every question answered: the quiz is done, whatever the answers.
    dispatch(markEntitySliceAsRead({ planId, readingSliceId, entitySliceId }))
    finishReading(entityReadingKey(planId, readingSliceId, entitySliceId))
    goBack()
  }

  const title = slice?.type === 'Quiz' ? slice.title : 'Quiz'
  const titleFont = resolveFontFamily(theme.fontFamily.title)

  return (
    <Container>
      <Header hasBackButton title={title} onCustomBackPress={goBack} />
      {!slice || chapters.some(query => query.isError) ? (
        <Empty message="This quiz could not be opened." />
      ) : !loaded ? (
        <Loading />
      ) : !questions.length ? (
        <Empty message="These chapters are too short for a quiz." />
      ) : (
        <ScrollView
          contentContainerStyle={{
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
            padding: 20,
            paddingBottom: 48,
            gap: 20,
          }}
        >
          {/* How far along, without numbers. */}
          <Box className="flex-row gap-[4px]">
            {questions.map((item, at) => (
              <Box
                key={item.reference}
                className="flex-1 h-[4px] rounded-full"
                style={{
                  backgroundColor:
                    answers[at] === undefined
                      ? theme.colors.border
                      : answers[at] === item.answer
                        ? theme.colors.success
                        : theme.colors.quart,
                }}
              />
            ))}
          </Box>

          {done ? (
            <VStack className="gap-[16px] items-center pt-[24px]">
              <FeatherIcon name="check-circle" size={44} color="success" />
              <Text className="text-[26px] text-center" style={{ fontFamily: titleFont }}>
                Well done
              </Text>
              <Text className="text-grey text-[16px] text-center leading-[24px]">
                Each bar above is one question: green where your answer was right, red where it was
                not.
              </Text>
              <Box className="self-stretch pt-[8px]">
                <Button onPress={finish}>Done</Button>
              </Box>
            </VStack>
          ) : (
            question && (
              <>
                <Box className="rounded-[24px] p-[20px] gap-[12px]">
                  <AskGlassBackdrop radius={24} />
                  <Text className="text-grey text-[13px] font-bold uppercase">
                    {ASKED[question.kind]}
                  </Text>
                  <Text className="text-[19px] leading-[29px]" style={{ fontFamily: titleFont }}>
                    {question.prompt}
                  </Text>
                  {/* The verse's place would name the chapter, so it never shows on that question. */}
                  {chosen !== undefined && question.kind === 'word' && (
                    <Text className="text-grey text-[14px]">{question.reference}</Text>
                  )}
                </Box>

                <VStack className="gap-[10px]">
                  {question.choices.map(choice => {
                    const right = choice === question.answer
                    const picked = choice === chosen
                    const shown = chosen !== undefined && (right || picked)
                    const color = right ? theme.colors.success : theme.colors.quart
                    return (
                      <TouchableBox
                        key={choice}
                        testID="quiz-choice"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: chosen !== undefined, selected: picked }}
                        disabled={chosen !== undefined}
                        onPress={() =>
                          setAnswers(list => {
                            const next = [...list]
                            next[index] = choice
                            return next
                          })
                        }
                        className="min-h-[54px] flex-row items-center gap-[12px] rounded-[18px] px-[18px] py-[14px]"
                        style={shown ? { borderWidth: 2, borderColor: color } : undefined}
                      >
                        <AskGlassBackdrop radius={18} />
                        <Text className="flex-1 text-[17px]">{choice}</Text>
                        {shown && (
                          <FeatherIcon name={right ? 'check' : 'x'} size={20} color={color} />
                        )}
                      </TouchableBox>
                    )
                  })}
                </VStack>

                {chosen !== undefined && (
                  <Button onPress={() => setIndex(at => at + 1)}>
                    {index === questions.length - 1 ? 'See how you did' : 'Next question'}
                  </Button>
                )}
              </>
            )
          )}
        </ScrollView>
      )}
    </Container>
  )
}

export default PlanQuizScreen
