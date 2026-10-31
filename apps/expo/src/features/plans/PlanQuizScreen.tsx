import { useQueries } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Platform, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import { loadPublishedNote } from '~features/passageMediaLibrary/cyberJudahClasses'
import { buildDayQuiz, type QuizVerse } from './planQuiz'

// Each answer tile has its own colour and shape, as in a game, so the four read apart at a glance.
const TILES = [
  { color: '#4F6BF5', icon: 'circle' },
  { color: '#F29D12', icon: 'triangle' },
  { color: '#8B5CF6', icon: 'square' },
  { color: '#0FA597', icon: 'hexagon' },
] as const
// The game is named for Philip's question to the reader of Esaias.
const GAME_TITLE = 'Understandest thou what thou readest?'
const GAME_SOURCE = 'Acts 8:30'
// What each kind of question asks, on its chip.
const KINDS = {
  word: { icon: 'edit-3', label: 'Fill the gap' },
  chapter: { icon: 'book-open', label: 'Name the chapter' },
  taught: { icon: 'message-circle', label: 'Which scripture was this taught on?' },
  precept: { icon: 'link', label: 'Which precept was read with it?' },
  point: { icon: 'edit-3', label: 'Fill the gap in the breakdown' },
} as const
const CHEERS = ['Right!', 'Nice!', 'You got it!', 'Well read!', 'Spot on!']
const CONFETTI = ['#4F6BF5', '#F29D12', '#8B5CF6', '#0FA597', '#E5484D', '#FFD43B']

/** A shower of colour over the finished quiz. */
const Confetti = () => {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, at) => ({
        left: (at * 37) % 100,
        delay: (at * 53) % 600,
        size: 7 + (at % 4) * 2,
        turn: at % 2 ? 1 : -1,
        color: CONFETTI[at % CONFETTI.length],
        fall: new Animated.Value(0),
      })),
    []
  )
  useEffect(() => {
    Animated.parallel(
      pieces.map(piece =>
        Animated.timing(piece.fall, {
          toValue: 1,
          duration: 1800,
          delay: piece.delay,
          useNativeDriver: true,
        })
      )
    ).start()
  }, [pieces])
  return (
    <Box pointerEvents="none" style={StyleSheet.absoluteFill} className="overflow-hidden">
      {pieces.map((piece, at) => (
        <Animated.View
          key={at}
          style={{
            position: 'absolute',
            top: -20,
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 1.6,
            borderRadius: 2,
            backgroundColor: piece.color,
            opacity: piece.fall.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: piece.fall.interpolate({ inputRange: [0, 1], outputRange: [0, 620] }) },
              {
                rotate: piece.fall.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${piece.turn * 540}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </Box>
  )
}

/** The day's chapter names, in reading order, from the loaded chapters. */
const chapterNames = (
  chapters: {
    data?: { bookName: string; chapters: { viewMore: { params: { chapter: unknown } } }[] }
  }[]
) =>
  chapters.flatMap(query =>
    (query.data?.chapters ?? []).map(
      chapter => `${query.data!.bookName} ${chapter.viewMore.params.chapter}`
    )
  )

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
  const insets = useSafeAreaInsets()
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
  // The day's notes: most questions come from their breakdowns.
  const notePaths =
    reading?.slices.flatMap(item =>
      item.type === 'Text' && item.notePath ? [item.notePath] : []
    ) ?? []
  const notes = useQueries({
    queries: notePaths.map(path => ({
      queryKey: ['plan-quiz-note', path],
      queryFn: () => loadPublishedNote(path),
      staleTime: 60 * 60 * 1000,
      retry: 1,
    })),
  })
  // A note that cannot be loaded leaves its questions to the chapters.
  const loaded =
    chapters.every(query => query.data) && notes.every(query => query.data || query.isError)
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
    const bodies = notes.flatMap(query => (query.data ? [query.data.body] : []))
    return buildDayQuiz(bodies, verses, `${planId}/${readingSliceId}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, planId, readingSliceId])

  // Questions still to answer, in turn. A wrong answer sends its question to the back, so the
  // quiz ends only when every question has been answered right.
  const [queue, setQueue] = useState<number[] | null>(null)
  const [chosen, setChosen] = useState<string>()
  const [right, setRight] = useState<Set<number>>(new Set())
  const [missed, setMissed] = useState<Set<number>>(new Set())
  // The game opens on its title card; the questions start when the reader is ready.
  const [started, setStarted] = useState(false)
  // Right answers in a row; a run of them lights up "On a roll".
  const [streak, setStreak] = useState(0)
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
  }, [current, order.length, started, enter])
  // The title card's tiles drop in one after another.
  const intro = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!loaded || started) return
    intro.setValue(0)
    Animated.spring(intro, { toValue: 1, useNativeDriver: true, bounciness: 10 }).start()
  }, [loaded, started, intro])
  const dayChapters = useMemo(
    () => [...new Set(questions.length ? chapterNames(chapters) : [])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions]
  )

  const fill = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(fill, {
      toValue: questions.length ? right.size / questions.length : 0,
      useNativeDriver: false,
      bounciness: 4,
    }).start()
  }, [right.size, questions.length, fill])

  // The answer bar rises from the bottom once a choice is made.
  const rise = useRef(new Animated.Value(0)).current
  useEffect(() => {
    rise.setValue(0)
    if (chosen !== undefined)
      Animated.spring(rise, { toValue: 1, useNativeDriver: true, bounciness: 7 }).start()
  }, [chosen, rise])
  const pop = useRef(new Animated.Value(1)).current
  const onRoll = streak >= 3
  const flame = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(flame, {
      toValue: onRoll ? 1 : 0,
      useNativeDriver: true,
      bounciness: 12,
    }).start()
  }, [onRoll, flame])

  const choose = (choice: string) => {
    if (chosen !== undefined || current === undefined || !question) return
    setChosen(choice)
    pop.setValue(0.92)
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, bounciness: 14 }).start()
    if (choice === question.answer) {
      setRight(set => new Set(set).add(current))
      setStreak(value => value + 1)
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else {
      setStreak(0)
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
    // Marked only as it goes to the back, so "Try again" shows when it comes round again.
    if (!answeredRight) setMissed(set => new Set(set).add(current))
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

  const title = reading?.title || GAME_TITLE
  const titleFont = resolveFontFamily(theme.fontFamily.title)
  const comingBack = current !== undefined && missed.has(current)
  const cheer = CHEERS[(right.size + (current ?? 0)) % CHEERS.length]
  const verdictColor = answeredRight ? theme.colors.success : theme.colors.quart

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
            colors={[theme.colors.lightPrimary, theme.colors.reverse, theme.colors.reverse]}
            style={StyleSheet.absoluteFill}
          />
          <ScrollView
            style={{ backgroundColor: 'transparent' }}
            contentContainerStyle={{
              width: '100%',
              maxWidth: 640,
              alignSelf: 'center',
              padding: 20,
              paddingBottom: 200,
              gap: 20,
            }}
          >
            {/* One step per question, lit as each is answered right: no numbers. */}
            {started && (
              <Box className="flex-row items-center gap-[10px]">
                <Box className="flex-1 flex-row gap-[5px]">
                  {questions.map((_, at) => (
                    <Box
                      key={at}
                      className="flex-1 h-[10px] rounded-full"
                      style={{
                        backgroundColor: right.has(at) ? theme.colors.success : theme.colors.border,
                      }}
                    />
                  ))}
                </Box>
                {onRoll && (
                  <Animated.View
                    style={{
                      opacity: flame,
                      transform: [
                        { scale: flame.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                      ],
                    }}
                  >
                    <Box
                      className="flex-row items-center gap-[4px] rounded-full px-[10px] py-[5px]"
                      style={{ backgroundColor: theme.colors.secondary }}
                    >
                      <FeatherIcon name="zap" size={14} color="white" />
                      <Text className="text-[12px] font-bold" style={{ color: '#fff' }}>
                        On a roll
                      </Text>
                    </Box>
                  </Animated.View>
                )}
              </Box>
            )}

            {!started ? (
              <Animated.View
                style={{
                  opacity: intro,
                  transform: [
                    { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
                  ],
                }}
              >
                <Box className="rounded-[32px] px-[22px] pt-[30px] pb-[24px] gap-[18px] items-center overflow-hidden">
                  <AskGlassBackdrop radius={32} />
                  <Box className="flex-row gap-[10px]">
                    {TILES.map((tile, at) => (
                      <Animated.View
                        key={tile.icon}
                        style={{
                          transform: [
                            {
                              translateY: intro.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-40 - at * 18, 0],
                              }),
                            },
                            { rotate: `${at % 2 ? 7 : -7}deg` },
                          ],
                        }}
                      >
                        <Box
                          className="w-[50px] h-[50px] rounded-[16px] items-center justify-center"
                          style={{
                            backgroundColor: tile.color,
                            borderBottomWidth: 5,
                            borderBottomColor: 'rgba(0,0,0,0.18)',
                          }}
                        >
                          <FeatherIcon name={tile.icon} size={22} color="white" />
                        </Box>
                      </Animated.View>
                    ))}
                  </Box>
                  <VStack className="gap-[6px] items-center">
                    <Text
                      className="text-[30px] leading-[38px] text-center"
                      style={{ fontFamily: titleFont }}
                    >
                      {GAME_TITLE}
                    </Text>
                    <Text className="text-grey text-[15px] font-bold">{GAME_SOURCE}</Text>
                  </VStack>
                  <Box className="flex-row flex-wrap justify-center gap-[8px]">
                    {dayChapters.map(name => (
                      <Box
                        key={name}
                        className="flex-row items-center gap-[5px] rounded-full px-[12px] py-[6px]"
                        style={{ backgroundColor: theme.colors.lightPrimary }}
                      >
                        <FeatherIcon name="book-open" size={13} color="primary" />
                        <Text
                          className="text-[13px] font-bold"
                          style={{ color: theme.colors.primary }}
                        >
                          {name}
                        </Text>
                      </Box>
                    ))}
                  </Box>
                  <VStack className="self-stretch gap-[10px] pt-[4px]">
                    {(
                      [
                        { icon: 'target', text: 'Answer every question right to finish.' },
                        { icon: 'rotate-ccw', text: 'A wrong answer comes back until you get it.' },
                        { icon: 'zap', text: 'Answer three in a row and you are on a roll.' },
                      ] as const
                    ).map(rule => (
                      <Box key={rule.icon} className="flex-row items-center gap-[12px]">
                        <Box
                          className="w-[32px] h-[32px] rounded-full items-center justify-center"
                          style={{ backgroundColor: theme.colors.lightPrimary }}
                        >
                          <FeatherIcon name={rule.icon} size={15} color="primary" />
                        </Box>
                        <Text className="flex-1 text-[15px] leading-[21px]">{rule.text}</Text>
                      </Box>
                    ))}
                  </VStack>
                  <Box className="self-stretch pt-[6px]">
                    <Button success onPress={() => setStarted(true)}>
                      Start
                    </Button>
                  </Box>
                </Box>
              </Animated.View>
            ) : done ? (
              <VStack className="gap-[18px] items-center pt-[40px]">
                <Box
                  className="w-[132px] h-[132px] rounded-full items-center justify-center"
                  style={{
                    backgroundColor: theme.colors.secondary,
                    shadowColor: theme.colors.secondary,
                    shadowOpacity: 0.55,
                    shadowRadius: 30,
                    shadowOffset: { width: 0, height: 10 },
                  }}
                >
                  <FeatherIcon name="award" size={66} color="white" />
                </Box>
                <Text className="text-[32px] text-center" style={{ fontFamily: titleFont }}>
                  Every answer right
                </Text>
                <Text className="text-grey text-[17px] text-center leading-[25px]">
                  You understand what you read in {reading?.title || dayChapters.join(', ')}.
                </Text>
                <Box className="self-stretch pt-[10px]">
                  <Button success onPress={finish}>
                    Done
                  </Button>
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
                        className="flex-row items-center gap-[5px] rounded-full px-[10px] py-[5px]"
                        style={{ backgroundColor: theme.colors.primary }}
                      >
                        <FeatherIcon name={KINDS[question.kind].icon} size={13} color="white" />
                        <Text className="text-[12px] font-bold" style={{ color: '#fff' }}>
                          {KINDS[question.kind].label}
                        </Text>
                      </Box>
                      {comingBack && (
                        <Box
                          className="flex-row items-center gap-[4px] rounded-full px-[10px] py-[5px]"
                          style={{ backgroundColor: theme.colors.border }}
                        >
                          <FeatherIcon name="rotate-ccw" size={12} color="grey" />
                          <Text className="text-grey text-[12px] font-bold">Try again</Text>
                        </Box>
                      )}
                    </Box>
                    <Text className="text-[22px] leading-[32px]" style={{ fontFamily: titleFont }}>
                      {question.prompt}
                    </Text>
                    {/* The verse's place would name the chapter, so it never shows on that question. */}
                    {(question.kind === 'precept' ||
                      (chosen !== undefined &&
                        (question.kind === 'word' || question.kind === 'point'))) && (
                      <Text className="text-grey text-[14px]">{question.reference}</Text>
                    )}
                  </Box>

                  {/* Four big tiles, each with its own colour and shape. */}
                  <Box className="flex-row flex-wrap justify-between" style={{ rowGap: 12 }}>
                    {question.choices.map((choice, at) => {
                      const tile = TILES[at % TILES.length]
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
                            : tile.color
                      return (
                        <Animated.View
                          key={choice}
                          style={{
                            width: '48.5%',
                            opacity: state === 'faded' ? 0.4 : 1,
                            transform: [
                              { scale: picked ? pop : 1 },
                              {
                                translateY: enter.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [24 + at * 12, 0],
                                }),
                              },
                            ],
                          }}
                        >
                          <TouchableBox
                            testID="quiz-choice"
                            accessibilityRole="button"
                            accessibilityState={{
                              disabled: chosen !== undefined,
                              selected: picked,
                            }}
                            disabled={chosen !== undefined}
                            onPress={() => choose(choice)}
                            className="min-h-[104px] rounded-[22px] p-[14px] justify-between overflow-hidden"
                            style={{
                              borderWidth: 3,
                              borderColor:
                                state === 'idle' || state === 'faded' ? 'transparent' : color,
                              // A coloured base under the tile, like a game button you press in.
                              borderBottomWidth: 6,
                              borderBottomColor: color,
                            }}
                          >
                            <AskGlassBackdrop radius={22} />
                            <Box
                              className="w-[32px] h-[32px] rounded-full items-center justify-center"
                              style={{ backgroundColor: color }}
                            >
                              <FeatherIcon
                                name={
                                  state === 'right' ? 'check' : state === 'wrong' ? 'x' : tile.icon
                                }
                                size={16}
                                color="white"
                              />
                            </Box>
                            <Text className="text-[18px] font-bold" numberOfLines={2}>
                              {choice}
                            </Text>
                          </TouchableBox>
                        </Animated.View>
                      )
                    })}
                  </Box>
                </Animated.View>
              )
            )}
          </ScrollView>

          {done && <Confetti />}

          {/* The verdict rises from the bottom, in green or red, with the way on. */}
          {!done && chosen !== undefined && (
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                transform: [
                  { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [220, 0] }) },
                ],
              }}
            >
              <Box
                className="rounded-t-[28px] px-[20px] pt-[18px] gap-[14px]"
                style={{
                  backgroundColor: verdictColor,
                  paddingBottom: Math.max(insets.bottom, 16) + 8,
                }}
              >
                <Box className="w-full max-w-[600px] self-center gap-[14px]">
                  <Box className="flex-row items-center gap-[12px]">
                    <Box className="w-[40px] h-[40px] rounded-full items-center justify-center bg-white">
                      <FeatherIcon
                        name={answeredRight ? 'check' : 'rotate-ccw'}
                        size={22}
                        color={verdictColor}
                      />
                    </Box>
                    <VStack className="flex-1">
                      <Text className="text-[22px] font-bold" style={{ color: '#fff' }}>
                        {answeredRight ? cheer : 'Not quite'}
                      </Text>
                      {!answeredRight && (
                        <Text className="text-[15px]" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          This one will come back.
                        </Text>
                      )}
                    </VStack>
                  </Box>
                  <TouchableBox
                    accessibilityRole="button"
                    onPress={next}
                    className="h-[54px] rounded-[18px] items-center justify-center bg-white"
                  >
                    <Text className="text-[18px] font-bold" style={{ color: verdictColor }}>
                      Continue
                    </Text>
                  </TouchableBox>
                </Box>
              </Box>
            </Animated.View>
          )}
        </Box>
      )}
    </Container>
  )
}

export default PlanQuizScreen
