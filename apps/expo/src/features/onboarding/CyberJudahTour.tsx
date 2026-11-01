import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { useState } from 'react'
import { Image, Pressable, ScrollView } from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'

// CyberJudah's first-run tour: one verse, Deuteronomy 28:68, opened the way the app opens every
// verse. The scripture is the KJV word for word, and every breakdown and precept is quoted from the
// classes as published for that verse (data.cyberjudah.io/api/concordance/deuteronomy/28.json).
const VERSE = {
  reference: 'Deuteronomy 28:68',
  text: 'And the Lord shall bring thee into Egypt again with ships, by the way whereof I spake unto thee, Thou shalt see it no more again: and there ye shall be sold unto your enemies for bondmen and bondwomen, and no man shall buy you.',
}
const CLASS = {
  title: 'I Have Loved Strangers and After Them Will I Go',
  date: 'Oct 26, 2026',
  at: '32:28',
}
const BREAKDOWN = [
  {
    words: 'And the Lord shall bring thee into Egypt again with ships',
    point: 'God will bring us into slavery again, with cargo slave ships.',
  },
  {
    words: 'And no man shall buy you',
    point: 'No man shall redeem you.',
  },
]
const PRECEPTS = [
  {
    reference: 'Deuteronomy 28:29',
    text: 'And thou shalt be only oppressed and spoiled evermore, and no man shall save thee.',
    point:
      "Saying the exact same thing. No man shall save you or redeem you. No one can buy anybody out of this captivity, because you'll all be in it together.",
    source: `${CLASS.title} · ${CLASS.at}`,
  },
  {
    reference: 'Exodus 20:2',
    text: 'I am the Lord thy God, which have brought thee out of the land of Egypt, out of the house of bondage.',
    point:
      'Out of the house of bondage: the word Egypt is synonymous with captivity, with bondage.',
    source: 'Message to the Black Man · 17:10',
  },
]
const TAGS = [
  { label: 'Slave Trade', kind: 'precept' },
  { label: 'Buy Redeem Save', kind: 'precept' },
  { label: 'Our Enemies', kind: 'precept' },
  { label: 'Law 2F.20', kind: 'law' },
] as const
const NATIONS = [
  {
    name: 'Israel',
    today: 'The 12 tribes',
    image: require('~assets/images/entity-avatars/group-israel-5.webp'),
  },
  {
    name: 'Edom',
    today: 'The white man',
    image: require('~assets/images/entity-avatars/group-edom.jpg'),
  },
  {
    name: 'Ishmael',
    today: 'The Arabs',
    image: require('~assets/images/entity-avatars/group-ishmael.jpg'),
  },
]
const LIBRARY = [
  { icon: 'play-circle', label: 'Every class, with its notes' },
  { icon: 'layers', label: 'The precepts and the Handbook of the Law' },
  { icon: 'users', label: 'The people and the nations' },
  { icon: 'clock', label: 'The history of the 12 tribes' },
] as const

const SCENES = [
  'The King James Bible, as printed in 1611.',
  'Tap the p to see the precepts.',
  'Read what the classes taught.',
  'Follow a verse to every precept and law.',
  'Know who is who in scripture.',
  'Learn who you are from scripture.',
]

const VerseText = ({ withP }: { withP?: boolean }) => {
  const theme = useTheme()
  return (
    <Text
      className="text-[19px] leading-[30px] text-default"
      style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
    >
      {withP && (
        <Text
          className="text-[19px] text-primary"
          style={{ fontStyle: 'italic', fontWeight: '400', color: theme.colors.primary }}
        >
          p{' '}
        </Text>
      )}
      <Text className="text-[13px] text-tertiary">68 </Text>
      {VERSE.text}
    </Text>
  )
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <VStack className="rounded-[18px] bg-light-grey p-[16px] gap-[8px]">{children}</VStack>
)

const Scene = ({ index }: { index: number }) => {
  const theme = useTheme()
  if (index === 0)
    return (
      <VStack className="gap-[14px]">
        <Text className="text-[13px] font-semibold uppercase text-tertiary">{VERSE.reference}</Text>
        <VerseText />
      </VStack>
    )
  if (index === 1)
    return (
      <VStack className="gap-[12px]">
        <VerseText withP />
        {PRECEPTS.map(precept => (
          <Card key={precept.reference}>
            <Text className="text-[14px] font-semibold text-primary">{precept.reference}</Text>
            <Text className="text-[15px] leading-[22px] text-default">{precept.text}</Text>
            <Text className="text-[14px] leading-[20px] text-grey">{precept.point}</Text>
            <Text className="text-[12px] text-tertiary">{precept.source}</Text>
          </Card>
        ))}
      </VStack>
    )
  if (index === 2)
    return (
      <VStack className="gap-[12px]">
        <Card>
          <HStack className="items-center gap-[8px]">
            <Feather name="play-circle" size={18} color={theme.colors.primary} />
            <Text className="flex-[1] text-[14px] font-semibold text-default">{CLASS.title}</Text>
            <Box className="rounded-full bg-primary px-[10px] py-[3px]">
              <Text className="text-[12px] text-reverse">{CLASS.at}</Text>
            </Box>
          </HStack>
          <Text className="text-[12px] text-tertiary">{CLASS.date}</Text>
        </Card>
        {BREAKDOWN.map(item => (
          <VStack key={item.words} className="gap-[4px] border-l-[3px] border-primary pl-[12px]">
            <Text className="text-[15px] italic text-default">{item.words}:</Text>
            <Text className="text-[15px] leading-[22px] text-grey">{item.point}</Text>
          </VStack>
        ))}
      </VStack>
    )
  if (index === 3)
    return (
      <VStack className="gap-[14px]">
        <VerseText />
        <HStack className="flex-wrap gap-[8px]">
          {TAGS.map(tag => (
            <HStack
              key={tag.label}
              className="items-center gap-[6px] rounded-full bg-light-grey px-[12px] py-[6px]"
            >
              {tag.kind === 'law' ? (
                <MaterialCommunityIcons name="scale-balance" size={14} color="#c0392b" />
              ) : (
                <Feather name="layers" size={14} color={theme.colors.primary} />
              )}
              <Text className="text-[13px] text-default">{tag.label}</Text>
            </HStack>
          ))}
        </HStack>
      </VStack>
    )
  if (index === 4)
    return (
      <HStack className="justify-between gap-[10px]">
        {NATIONS.map(nation => (
          <VStack key={nation.name} className="flex-[1] items-center gap-[8px]">
            <Image
              source={nation.image}
              accessibilityIgnoresInvertColors
              style={{ width: 92, height: 92, borderRadius: 46 }}
            />
            <Text className="text-[15px] font-semibold text-default">{nation.name}</Text>
            <Text className="text-[12px] text-center text-tertiary">{nation.today}</Text>
          </VStack>
        ))}
      </HStack>
    )
  return (
    <VStack className="gap-[12px]">
      {LIBRARY.map(item => (
        <HStack key={item.label} className="items-center gap-[12px]">
          <Feather name={item.icon} size={20} color={theme.colors.primary} />
          <Text className="flex-[1] text-[16px] text-default">{item.label}</Text>
        </HStack>
      ))}
    </VStack>
  )
}

/** The first-run tour, in place of Bible Strong's: the same stage, a CyberJudah verse. */
const CyberJudahTour = ({ onComplete }: { onComplete: () => void }) => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const confirm = useConfirmDialog()
  const [index, setIndex] = useState(0)
  const last = index === SCENES.length - 1

  const confirmSkip = async () => {
    const skip = await confirm({
      title: 'Skip the tour?',
      message: "You'll go straight to setting up your Bible.",
      confirmLabel: 'Skip',
      cancelLabel: 'Keep going',
    })
    if (skip) onComplete()
  }

  return (
    <Box className="flex-[1] bg-reverse" style={{ paddingTop: insets.top }}>
      <HStack className="h-[54px] items-center justify-between px-[12px]">
        {index > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => setIndex(index - 1)}
            hitSlop={12}
            style={{ padding: 8 }}
          >
            <Feather name="arrow-left" size={21} color={theme.colors.primary} />
          </Pressable>
        ) : (
          <Box />
        )}
        {!last && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip the tour"
            onPress={confirmSkip}
            hitSlop={12}
            style={{ padding: 8 }}
          >
            <Text className="text-tertiary text-[13px]">Skip</Text>
          </Pressable>
        )}
      </HStack>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 }}>
        <Animated.View
          key={index}
          entering={reducedMotion ? undefined : FadeInDown.springify().damping(18)}
          exiting={reducedMotion ? undefined : FadeOut.duration(120)}
          style={{ flexGrow: 1, justifyContent: 'center', gap: 28 }}
        >
          <Animated.View entering={reducedMotion ? undefined : FadeIn.delay(250)}>
            <Text
              accessibilityRole="header"
              className="text-[26px] leading-[32px] text-default"
              style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
            >
              {SCENES[index]}
            </Text>
          </Animated.View>
          <Scene index={index} />
        </Animated.View>
      </ScrollView>
      <VStack className="gap-[16px] px-[24px]" style={{ paddingBottom: insets.bottom + 16 }}>
        <HStack
          className="justify-center gap-[6px]"
          accessibilityLabel={`Step ${index + 1} of ${SCENES.length}`}
        >
          {SCENES.map((_, dot) => (
            <Box
              key={dot}
              className={`h-[6px] rounded-full ${dot === index ? 'w-[18px] bg-primary' : 'w-[6px] bg-border'}`}
            />
          ))}
        </HStack>
        <Pressable
          accessibilityRole="button"
          onPress={() => (last ? onComplete() : setIndex(index + 1))}
          style={{
            minHeight: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primary,
          }}
        >
          <Text className="text-[16px] font-semibold text-reverse">
            {last ? 'Set up my Bible' : 'Next'}
          </Text>
        </Pressable>
      </VStack>
    </Box>
  )
}

export default CyberJudahTour
