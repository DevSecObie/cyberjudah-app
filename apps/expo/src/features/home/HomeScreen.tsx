<<<<<<< CYBERJUDAH
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
=======
>>>>>>> BIBLESTRONG-28
import { goBackOrHome } from '~navigation/goBackOrHome'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { useTheme } from '~themes/ThemeProvider'
import Color from 'color'
import React from 'react'
import Box, { RightInsetCleared, TouchableBox, useRightInsetToClear } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HomeScrollView } from '~common/ui/ScrollView'
<<<<<<< CYBERJUDAH
import Text from '~common/ui/Text'
import DonationWidget from './DonationWidget'
import NaveOfTheDay from './NaveOfTheDay'
import PlanHome from './PlanHome'
import MeditationsHome from './MeditationsHome'
import StrongOfTheDay from './StrongOfTheDay'
import TheBibleProject from './TheBibleProjectPlan'
import TimelineWidget, { TIMELINE_ART_OVERFLOW } from './TimelineWidget'
import UserWidget, { LoginPrompt } from './UserWidget'
import WordOfTheDay from './WordOfTheDay'
=======
import { floatingShadow } from '~common/ui/surfaces'
import { LoginPrompt } from './UserWidget'
>>>>>>> BIBLESTRONG-28
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Events } from './Events'
import HomeDiscovery from './HomeDiscovery'
import HomeExploreGrid from './HomeExploreGrid'
import HomeFooter from './HomeFooter'
import HomeGoFurther from './HomeGoFurther'
import HomeHeader from './HomeHeader'
import HomeOpenSection, { NewTabLink } from './HomeOpenSection'
import HomeResumeSection from './HomeResumeSection'
import HomeSectionTitle from './HomeSectionTitle'
import HomeSubsectionTitle from './HomeSubsectionTitle'
import HomeToday from './HomeToday'
import SessionExpiredNotice from './SessionExpiredNotice'
import { HomeLayout } from './homeLayout'
import './homeStyles'
import ProfileStats from '~features/profile/components/ProfileStats'
<<<<<<< CYBERJUDAH
import PassageMediaLibraryWidget from './PassageMediaLibraryWidget'
import CaseStudiesWidget from './CaseStudiesWidget'
=======

>>>>>>> BIBLESTRONG-28
// local react props
type HomeProps = {
  closeHome: () => void
  inWorkspace?: boolean
}

/**
 * One home for every size: the sections a phone stacks are the ones a wide window shows, in the
 * same order, each laying out its rows from the measured column width (see homeLayout.tsx).
 * Four groups with large titles: what today brings, what is mine (counters, then my work in
 * progress as small parts), what the app offers, and partners. Parts inside a group get small
 * titles so they read as belonging to it.
 */
export const Home = ({ closeHome, inWorkspace = false }: HomeProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
<<<<<<< CYBERJUDAH
  const isWide = useResponsiveWorkspace()
  const appleIsReviewing = getAppleReviewing()
  const cyberJudah = usesCyberJudahEditorial()

  if (Platform.OS === 'web' && isWide) return <DesktopHome />

  return (
    <Box className="overflow-hidden border-continuous bg-light-grey flex-[1]">
      <HomeScrollView showsVerticalScrollIndicator={false}>
        {!cyberJudah && <Events />}
        <UserWidget />
        <ProfileStats />
        <LoginPrompt />
        <Box className="overflow-hidden border-continuous pt-[40px] px-[20px]">
          <Text
            className="text-[23px] flex-[1]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('Apprendre')}
          </Text>
          <PassageMediaLibraryWidget />
          {/* No clipping here: the Timeline lion rises above its card into the space left by the margin. */}
          <HStack
            className="border-continuous h-[174px] gap-[12px] items-stretch overflow-visible"
            style={{ marginTop: 12 + TIMELINE_ART_OVERFLOW }}
          >
            {!cyberJudah && <TheBibleProject />}
            <TimelineWidget />
            {cyberJudah && <CaseStudiesWidget />}
          </HStack>
        </Box>
        <Box className="overflow-hidden border-continuous bg-light-grey pt-[40px] px-[20px]">
          <Text
            className="text-[23px] flex-[1]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('Étudier')}
          </Text>
        </Box>
        <Box className="overflow-hidden border-continuous bg-light-grey pt-[20px]">
          <HorizontalControlScrollView
            horizontal
            style={{ overflow: 'visible' }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: 'row',
              paddingHorizontal: 20,
              overflow: 'visible',
            }}
          >
            <StrongOfTheDay type="grec" />
            <StrongOfTheDay type="hebreu" color1="rgba(248,131,121,1)" color2="rgba(255,77,93,1)" />
            <NaveOfTheDay />
            <WordOfTheDay color1="#ffd255" color2="#ffbc00" />
          </HorizontalControlScrollView>
        </Box>
        <Box className="overflow-hidden border-continuous bg-light-grey pt-[40px] px-[20px]">
          <Text
            className="text-[23px] flex-[1]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('Méditer')}
          </Text>
        </Box>
        <VStack className="overflow-hidden border-continuous gap-[10px]">
          <Box className="px-[20px] pt-[20px]">{!cyberJudah && <MeditationsHome />}</Box>
          <PlanHome />
          {!cyberJudah && <TryAudibibleWidget />}
        </VStack>

        <Box className="overflow-hidden border-continuous bg-light-grey px-[20px]">
          <Text
            className="text-[23px] flex-[1]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('Aller plus loin')}
          </Text>
        </Box>
        {!cyberJudah && !appleIsReviewing && <DonationWidget />}
        <Box className="overflow-hidden border-continuous bg-light-grey">
=======
  const rightInset = useRightInsetToClear()

  return (
    <Box
      className="overflow-hidden border-continuous bg-canvas flex-[1]"
      // Clear a landscape iPhone's camera, as SafeAreaBox does for other pages.
      style={{ paddingRight: rightInset }}
    >
      <RightInsetCleared>
        <HomeScrollView showsVerticalScrollIndicator={false}>
          <HomeLayout>
            <HomeHeader />
            <SessionExpiredNotice className="mt-[16px]" />
            <Box className="pt-[16px]">
              <Events />
            </Box>
            <HomeSectionTitle title={t('home.today')} />
            <HomeToday />
            <HomeSectionTitle title={t('home.myLibrary')} />
            <ProfileStats home />
            <LoginPrompt className="mt-[12px]" />
            <HomeResumeSection />
            <HomeSectionTitle title={t('home.explore')} action={<NewTabLink />} />
            <HomeOpenSection />
            <Box className="h-[16px]" />
            <HomeExploreGrid />
            <HomeSubsectionTitle title={t('home.randomWord')} className="pt-[16px] pb-[4px]" />
            <HomeDiscovery />
            <HomeSectionTitle title={t('Aller plus loin')} />
            <HomeGoFurther />
            <HomeFooter />
          </HomeLayout>
        </HomeScrollView>
        {!inWorkspace && (
>>>>>>> BIBLESTRONG-28
          <Box
            className="overflow-hidden border-continuous absolute left-[0px] right-[0px] bottom-[0px] h-[100px] items-center justify-center"
            style={{ paddingBottom: insets.bottom }}
          >
<<<<<<< CYBERJUDAH
            <Box className="overflow-hidden border-continuous flex-[1]">
              <Button
                color="#3b5998"
                onPress={() =>
                  Linking.openURL(
                    cyberJudah
                      ? 'https://cyberjudah.io'
                      : 'https://www.facebook.com/fr.bible.strong'
                  )
                }
                leftIcon={
                  <FeatherIcon
                    name="facebook"
                    size={20}
                    color="white"
                    style={{ marginRight: 10 }}
                  />
                }
              >
                {t('Suivre')}
              </Button>
=======
            <Box className="overflow-hidden border-continuous absolute top-[0px] bottom-[0px] left-[0px] right-[0px]">
              <LinearGradient
                start={[0.5, 0]}
                end={[0.5, 0.9]}
                style={{ height: 100 }}
                colors={[
                  `${Color(theme.colors.canvas).alpha(0).string()}`,
                  `${theme.colors.canvas}`,
                ]}
              />
>>>>>>> BIBLESTRONG-28
            </Box>
            <TouchableBox
              className="overflow-hidden border-continuous items-center justify-center w-[50px] h-[50px] rounded-full bg-surface-raised"
              accessibilityLabel={t('Fermer')}
              accessibilityRole="button"
              activeOpacity={0.8}
              onPress={closeHome}
              // The close button floats above the page, so it is the one home element with a shadow.
              style={{ ...floatingShadow, overflow: 'visible' }}
            >
              <FeatherIcon name="x" size={24} color="grey" />
            </TouchableBox>
          </Box>
        )}
      </RightInsetCleared>
    </Box>
  )
}

const HomeScreen = () => {
  const router = useRouter()
  const closeHome = () => goBackOrHome(router)

  const isWide = useResponsiveWorkspace()
  return <Home closeHome={closeHome} inWorkspace={isWide} />
}
export default HomeScreen
