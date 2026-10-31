import { useQueries } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Platform, StyleSheet } from 'react-native'
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

/**
 * The day's ten questions, one at a time, on the app's own glass. A question answered wrong comes
 * back at the end; the quiz is done only when every one has been answered right.
 */
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

  // Questions still to answer, in turn. A wrong answer sends its question to the back, so the
  // quiz ends only when every question has been answered right.
  const [queue, setQueue] = useState<number[] | null>(null)
  const [chosen, setChosen] = useState<string>()
  const [right, setRight] = useState<Set<number>>(new Set())
  const [missed, setMissed] = useState<Set<number>>(new Set())
  const order = queue ?? questions.map((_, at) => at)
  const current = order[0]
  const question = current === undefined ? undefined : questions[current]
  const done = questions.length > 0 && order.length === 0
  const answeredRight = chosen !== undefined && chosen === question?.answer

  // The card comes in from the side; a wrong choice shakes.
  const enter = useRef(new Animated.Value(0)).current
  const shake = useRef(new Animated.Value(0)).current
  useEffect(() => {
    enter.setValue(0)
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, bounciness: 6 }).start()
  }, [current, order.length, enter])

  const fill = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(fill, {
      toValue: questions.length ? right.size / questions.length : 0,
      useNativeDriver: false,
      bounciness: 4,
    }).start()
  }, [right.size, questions.length, fill])

  const choose = (choice: string) => {
    if (chosen !== undefined || current === undefined || !question) return
    setChosen(choice)
    if (choice === question.answer) {
      setRight(set => new Set(set).add(current))
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else {
      setMissed(set => new Set(set).add(current))
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Animated.sequence(
        [10, -10, 7, -7, 0].map(toValue =>
          Animated.timing(shake, { toValue, duration: 60, useNativeDriver: true })
        )
      ).start()
    }
  }
  const next = () => {
    if (current === undefined) return
    const rest = order.slice(1)
    setQueue(answeredRight ? rest : [...rest, current])
    setChosen(undefined)
  }

  const goBack = () => goBackOrHome(router)
  const finish = () => {
    // Every question answered right: the quiz is done.
    dispatch(markEntitySliceAsRead({ planId, readingSliceId, entitySliceId }))
    finishReading(entityReadingKey(planId, readingSliceId, entitySliceId))
    goBack()
  }

  const title = slice?.type === 'Quiz' ? slice.title : 'Quiz'
  const titleFont = resolveFontFamily(theme.fontFamily.title)
  const comingBack = current !== undefined && missed.has(current)

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
        <Box className="flex-1">
          <LinearGradient
            colors={[theme.colors.lightPrimary, theme.colors.reverse]}
            style={StyleSheet.absoluteFill}
          />
          <ScrollView
            style={{ backgroundColor: 'transparent' }}
            contentContainerStyle={{
              width: '100%',
              maxWidth: 640,
              alignSelf: 'center',
              padding: 20,
              paddingBottom: 48,
              gap: 22,
            }}
          >
            {/* How much has been answered right, without numbers. */}
            <Box
              className="h-[12px] rounded-full overflow-hidden"
              style={{ backgroundColor: theme.colors.border }}
            >
              <Animated.View
                style={{
                  height: '100%',
                  borderRadius: 999,
                  backgroundColor: theme.colors.success,
                  width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }}
              />
            </Box>

            {done ? (
              <VStack className="gap-[18px] items-center pt-[28px]">
                <Box
                  className="w-[112px] h-[112px] rounded-full items-center justify-center"
                  style={{
                    backgroundColor: theme.colors.success,
                    shadowColor: theme.colors.success,
                    shadowOpacity: 0.45,
                    shadowRadius: 24,
                    shadowOffset: { width: 0, height: 8 },
                  }}
                >
                  <FeatherIcon name="check" size={56} color="white" />
                </Box>
                <Text className="text-[30px] text-center" style={{ fontFamily: titleFont }}>
                  Every answer right
                </Text>
                <Text className="text-grey text-[17px] text-center leading-[25px]">
                  You know these chapters. The day&apos;s quiz is done.
                </Text>
                <Box className="self-stretch pt-[10px]">
                  <Button onPress={finish}>Done</Button>
                </Box>
              </VStack>
            ) : (
              question && (
                <Animated.View
                  style={{
                    gap: 18,
                    opacity: enter,
                    transform: [
                      {
                        translateX: Animated.add(
                          enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }),
                          shake
                        ),
                      },
                    ],
                  }}
                >
                  <Box className="rounded-[28px] p-[22px] gap-[14px] overflow-hidden">
                    <AskGlassBackdrop radius={28} />
                    <Box className="flex-row items-center gap-[8px]">
                      <Box
                        className="rounded-full px-[10px] py-[4px]"
                        style={{ backgroundColor: theme.colors.primary }}
                      >
                        <Text className="text-[12px] font-bold" style={{ color: '#fff' }}>
                          {question.kind === 'word' ? 'Fill the gap' : 'Name the chapter'}
                        </Text>
                      </Box>
                      {comingBack && (
                        <Box className="flex-row items-center gap-[4px]">
                          <FeatherIcon name="rotate-ccw" size={13} color="grey" />
                          <Text className="text-grey text-[12px] font-bold">Try again</Text>
                        </Box>
                      )}
                    </Box>
                    <Text className="text-[21px] leading-[31px]" style={{ fontFamily: titleFont }}>
                      {question.prompt}
                    </Text>
                    {/* The verse's place would name the chapter, so it never shows on that question. */}
                    {chosen !== undefined && question.kind === 'word' && (
                      <Text className="text-grey text-[14px]">{question.reference}</Text>
                    )}
                  </Box>

                  <VStack className="gap-[12px]">
                    {question.choices.map((choice, at) => {
                      const isAnswer = choice === question.answer
                      const picked = choice === chosen
                      // A wrong choice shows itself wrong; the right one is not given away, as
                      // the question comes back.
                      const state =
                        chosen === undefined
                          ? 'idle'
                          : picked && isAnswer
                            ? 'right'
                            : picked
                              ? 'wrong'
                              : 'faded'
                      const color =
                        state === 'right'
                          ? theme.colors.success
                          : state === 'wrong'
                            ? theme.colors.quart
                            : theme.colors.primary
                      return (
                        <TouchableBox
                          key={choice}
                          testID="quiz-choice"
                          accessibilityRole="button"
                          accessibilityState={{ disabled: chosen !== undefined, selected: picked }}
                          disabled={chosen !== undefined}
                          onPress={() => choose(choice)}
                          className="min-h-[60px] flex-row items-center gap-[14px] rounded-[20px] px-[14px] py-[12px] overflow-hidden"
                          style={{
                            opacity: state === 'faded' ? 0.45 : 1,
                            borderWidth: state === 'right' || state === 'wrong' ? 2 : 0,
                            borderColor: color,
                          }}
                        >
                          <AskGlassBackdrop radius={20} />
                          <Box
                            className="w-[34px] h-[34px] rounded-full items-center justify-center"
                            style={{
                              backgroundColor:
                                state === 'right' || state === 'wrong'
                                  ? color
                                  : theme.colors.reverse,
                            }}
                          >
                            {state === 'right' || state === 'wrong' ? (
                              <FeatherIcon
                                name={state === 'right' ? 'check' : 'x'}
                                size={18}
                                color="white"
                              />
                            ) : (
                              <Text className="text-[15px] font-bold text-primary">
                                {'ABCD'[at]}
                              </Text>
                            )}
                          </Box>
                          <Text className="flex-1 text-[18px]">{choice}</Text>
                        </TouchableBox>
                      )
                    })}
                  </VStack>

                  {chosen !== undefined && (
                    <VStack className="gap-[12px]">
                      <Text
                        className="text-[16px] font-bold text-center"
                        style={{ color: answeredRight ? theme.colors.success : theme.colors.quart }}
                      >
                        {answeredRight ? 'Right!' : 'Not quite. This one will come back.'}
                      </Text>
                      <Button onPress={next}>Continue</Button>
                    </VStack>
                  )}
                </Animated.View>
              )
            )}
          </ScrollView>
        </Box>
      )}
    </Container>
  )
}

export default PlanQuizScreen
