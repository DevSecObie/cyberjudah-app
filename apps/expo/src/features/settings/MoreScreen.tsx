import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import ContactDeveloperSheet from './ContactDeveloperSheet'
import { goBackOrHome } from '~navigation/goBackOrHome'
import { resolveUniverseColors } from '~themes/universeColors'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { getAppleReviewing } from '~helpers/getAppleReviewing'
import { Image } from 'expo-image'
import * as Updates from 'expo-updates'
import { useSetAtom } from 'jotai/react'
import { memo, useRef, useState, type ComponentPropsWithRef as UIComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Platform } from 'react-native'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import { twMerge } from '~common/ui/classNames'

import DictionnaryIcon from '~common/DictionnaryIcon'
import Header from '~common/Header'
import LexiqueIcon from '~common/LexiqueIcon'
import Link, { LinkProps } from '~common/Link'
import NaveIcon from '~common/NaveIcon'
import { type SheetRef } from '~common/sheet'
<<<<<<< CYBERJUDAH
import Box, { SafeAreaBox } from '~common/ui/Box'
import CardLinkItem from '~common/ui/CardLinkItem'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
=======
import Box, { SafeAreaBox, usePageBottomInset } from '~common/ui/Box'
>>>>>>> BIBLESTRONG-28
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import ListSection, { ListRow } from '~common/ui/ListSection'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import UserAvatar from '~common/ui/UserAvatar'
import DeleteAccountModal from '~features/profile/components/DeleteAccountModal'
import { useAvailableUpdatesIndicator } from '~features/resources/useAvailableUpdates'
import extractFirstName from '~helpers/extractFirstName'
import { nukeApp } from '~helpers/nukeApp'
import { toast } from '~helpers/toast'
import useLanguage from '~helpers/useLanguage'
import useLogin from '~helpers/useLogin'
import { changelogModalAtom } from '~state/app'
import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'
import app from '../../../package.json'

import { useRouter } from 'expo-router'
import { MainStackProps } from '~navigation/type'

export const LinkItem = (
  componentProps: Omit<
    UIComponentProps<typeof Link>,
    keyof LinkProps<keyof MainStackProps> | 'theme'
  > &
    Omit<LinkProps<keyof MainStackProps>, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('flex-row items-center px-[20px] py-[15px]', className)
  return (
    <Link
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Link>['style']}
    />
  )
}

const isCyberJudah = process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah'
const cyberJudahWebUrl = process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL ?? 'https://cyberjudah.io'
const shareMessage = () => {
  if (isCyberJudah) return `CyberJudah ${cyberJudahWebUrl}/home`
  const appUrl =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8'
      : 'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'
  return `Bible Strong App ${appUrl}`
}

const Infos = memo(() => {
  return (
    <Box className="overflow-hidden border-continuous flex-row justify-end px-[16px] py-[8px]">
      <Text className="text-grey text-[9px]">
        Version: {app.version} {Platform.Version}
      </Text>
    </Box>
  )
})

type MoreProps = {
  closeMenu: () => void
  inWorkspace?: boolean
}

export const More = ({ closeMenu, inWorkspace = false }: MoreProps) => {
  const router = useRouter()
  const { isLogged, user, logout } = useLogin()
  const theme = useTheme()
  const bottomInset = usePageBottomInset()
  const deleteAccountModalRef = useRef<SheetRef>(null)
  const contactDeveloperRef = useRef<SheetRef>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const openChangelogModal = useSetAtom(changelogModalAtom)
  const { hasUpdates } = useAvailableUpdatesIndicator()

  const lang = useLanguage()
  const { t } = useTranslation()
  const confirm = useConfirmDialog()

  const promptLogout = async () => {
    const confirmed = await confirm({
      title: t('Attention'),
      message: t('Voulez-vous vraiment vous déconnecter ?'),
      cancelLabel: t('Non'),
      confirmLabel: t('Se déconnecter'),
      destructive: true,
    })
    if (confirmed) await logout()
  }

  const checkForUpdate = async () => {
    if (isCheckingUpdate) return
    setIsCheckingUpdate(true)
    try {
      const result = await Updates.checkForUpdateAsync()
      // A rollback to the embedded JavaScript is not "available", yet it still has to be fetched.
      if (result.isAvailable || result.isRollBackToEmbedded) {
        toast.info(t('app.updateAvailable'))
        await Updates.fetchUpdateAsync()
        toast.success(t('app.updateReady'))
      } else {
        toast.info(t('app.noUpdateAvailable'))
      }
    } catch (error) {
      console.log(error)
      toast.error(t('app.updateError'))
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const appleIsReviewing = getAppleReviewing()

  const promptNuke = async () => {
    const confirmed = await confirm({
      title: '☢️ Nuke app',
      message: 'Reset TOTAL : MMKV, Firebase auth, databases, fichiers… puis reload. Continuer ?',
      cancelLabel: 'Annuler',
      confirmLabel: 'Nuke',
      destructive: true,
    })
    if (confirmed) await nukeApp()
  }

  const universeBg = (universe: Parameters<typeof resolveUniverseColors>[1]) =>
    resolveUniverseColors(theme.colors, universe).background

  return (
    <SafeAreaBox className="border-continuous overflow-hidden bg-canvas">
      <Header
        title={t(inWorkspace ? 'settings.settings' : 'Plus')}
        onCustomBackPress={closeMenu}
        hasBackButton={!inWorkspace}
      />
      <ScrollView
        backgroundColor="canvas"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 20 + bottomInset,
          backgroundColor: theme.colors.canvas,
        }}
      >
        <ListSection>
          {isLogged ? (
            <Link route="Profile" className="flex-row items-center gap-[12px] px-[14px] py-[12px]">
              <UserAvatar
                size={48}
                photoURL={user.photoURL}
                displayName={user.displayName}
                email={user.email}
              />
              <Box className="flex-[1]">
                <Text className="text-[17px] font-bold" numberOfLines={1}>
                  {extractFirstName(user.displayName)}
                </Text>
                <Text className="text-[13px] text-grey mt-[2px]">{t('settings.viewProfile')}</Text>
              </Box>
              <FeatherIcon name="chevron-right" size={18} color="grey" />
            </Link>
          ) : (
            <ListRow
              route="Login"
              icon={<FeatherIcon name="log-in" size={18} color="primary" />}
              iconTint="primary"
              label={t('Se connecter')}
              labelClassName="text-link"
            />
          )}
        </ListSection>

<<<<<<< CYBERJUDAH
        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="book" size={16} color="grey" />
            <Text className="ml-[8px] text-[12px] text-grey" style={{ textTransform: 'uppercase' }}>
              {t('settings.resources')}
            </Text>
          </SectionCardHeader>
          {assistantAccessible(user?.id) && (
            <CardLinkItem
              onPress={() => {
                closeMenu()
                router.push('/study-assistant')
              }}
            >
              <IconCircle bg="rgba(89, 131, 240, 0.1)">
                <FeatherIcon name="message-circle" size={20} color="primary" />
              </IconCircle>
              <Text className="flex-[1] text-[15px]">
                {t(isCyberJudah ? 'assistant.cyberjudah.title' : 'assistant.title')}
              </Text>
              <FeatherIcon name="chevron-right" size={20} color="grey" />
            </CardLinkItem>
          )}
          <CardLinkItem route="History">
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <FeatherIcon name="clock" size={20} color="grey" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('history.title')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Lexique">
            <IconCircle bg={resolveUniverseColors(theme.colors, 'strong').background}>
              <LexiqueIcon size={20} />
            </IconCircle>
            <Text
              className="flex-[1] text-[15px]"
              style={{ color: resolveUniverseColors(theme.colors, 'strong').foreground }}
            >
              {t('Lexique')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Dictionnaire">
            <IconCircle bg={resolveUniverseColors(theme.colors, 'dictionary').background}>
              <DictionnaryIcon size={20} />
            </IconCircle>
            <Text
              className="flex-[1] text-[15px]"
              style={{ color: resolveUniverseColors(theme.colors, 'dictionary').foreground }}
            >
              {t('Dictionnaire')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Nave">
            <IconCircle bg={resolveUniverseColors(theme.colors, 'nave').background}>
              <NaveIcon size={20} />
            </IconCircle>
            <Text
              className="flex-[1] text-[15px]"
              style={{ color: resolveUniverseColors(theme.colors, 'nave').foreground }}
            >
              {t('Bible Thématique Nave')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="CommentaryLibrary">
            <IconCircle bg={resolveUniverseColors(theme.colors, 'commentary').background}>
=======
        <ListSection title={t('settings.resources')}>
          <ListRow
            route="History"
            icon={<FeatherIcon name="clock" size={18} color="grey" />}
            label={t('history.title')}
          />
          <ListRow
            route="Lexique"
            icon={<LexiqueIcon size={18} />}
            iconBg={universeBg('strong')}
            label={t('Lexique')}
          />
          <ListRow
            route="Dictionnaire"
            icon={<DictionnaryIcon size={18} />}
            iconBg={universeBg('dictionary')}
            label={t('Dictionnaire')}
          />
          <ListRow
            route="Nave"
            icon={<NaveIcon size={18} />}
            iconBg={universeBg('nave')}
            label={t('Bible Thématique Nave')}
          />
          <ListRow
            route="CommentaryLibrary"
            icon={
>>>>>>> BIBLESTRONG-28
              <Image
                source={require('~assets/images/tab-icons/comment.svg')}
                style={{ width: 18, height: 18 }}
                tintColor={resolveUniverseColors(theme.colors, 'commentary').foreground}
                contentFit="contain"
              />
<<<<<<< CYBERJUDAH
            </IconCircle>
            <Text
              className="flex-[1] text-[15px]"
              style={{ color: resolveUniverseColors(theme.colors, 'commentary').foreground }}
            >
              {t('Commentaires')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          {usesCyberJudahEditorial() && (
            <>
              <CardLinkItem onPress={() => router.push('/(library)/precepts')}>
                <IconCircle bg={resolveUniverseColors(theme.colors, 'nave').background}>
                  <FeatherIcon name="layers" size={20} color="grey" />
                </IconCircle>
                <Text className="flex-[1] text-[15px]">Precepts</Text>
                <FeatherIcon name="chevron-right" size={20} color="grey" />
              </CardLinkItem>
              <CardLinkItem onPress={() => router.push('/(library)/law')}>
                <IconCircle bg={resolveUniverseColors(theme.colors, 'nave').background}>
                  <MaterialCommunityIcons name="scale-balance" size={20} color="grey" />
                </IconCircle>
                <Text className="flex-[1] text-[15px]">Handbook of the Law</Text>
                <FeatherIcon name="chevron-right" size={20} color="grey" />
              </CardLinkItem>
              <CardLinkItem onPress={() => router.push('/(library)/study-notes')}>
                <IconCircle bg={resolveUniverseColors(theme.colors, 'nave').background}>
                  <FeatherIcon name="file-text" size={20} color="grey" />
                </IconCircle>
                <Text className="flex-[1] text-[15px]">4 Chapters a Day</Text>
                <FeatherIcon name="chevron-right" size={20} color="grey" />
              </CardLinkItem>
              <CardLinkItem onPress={() => router.push('/(library)/encyclopedia')}>
                <IconCircle bg={resolveUniverseColors(theme.colors, 'nave').background}>
                  <FeatherIcon name="book" size={20} color="grey" />
                </IconCircle>
                <Text className="flex-[1] text-[15px]">Encyclopedia</Text>
                <FeatherIcon name="chevron-right" size={20} color="grey" />
              </CardLinkItem>
              <CardLinkItem onPress={() => router.push('/(library)/topics')}>
                <IconCircle bg={resolveUniverseColors(theme.colors, 'nave').background}>
                  <FeatherIcon name="tag" size={20} color="grey" />
                </IconCircle>
                <Text className="flex-[1] text-[15px]">Topics</Text>
                <FeatherIcon name="chevron-right" size={20} color="grey" />
              </CardLinkItem>
              <CardLinkItem onPress={() => router.push('/(library)/false-doctrines')}>
                <IconCircle bg={resolveUniverseColors(theme.colors, 'nave').background}>
                  <FeatherIcon name="alert-triangle" size={20} color="grey" />
                </IconCircle>
                <Text className="flex-[1] text-[15px]">False Doctrines</Text>
                <FeatherIcon name="chevron-right" size={20} color="grey" />
              </CardLinkItem>
              <CardLinkItem onPress={() => router.push('/(library)/glossary')}>
                <IconCircle bg={resolveUniverseColors(theme.colors, 'nave').background}>
                  <FeatherIcon name="list" size={20} color="grey" />
                </IconCircle>
                <Text className="flex-[1] text-[15px]">Glossary</Text>
                <FeatherIcon name="chevron-right" size={20} color="grey" />
              </CardLinkItem>
            </>
          )}
          <CardLinkItem route="Plans" isLast>
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <MaterialIcon name="playlist-add-check" size={20} color="grey" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('Plans')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        </SectionCard>
=======
            }
            iconBg={universeBg('commentary')}
            label={t('Commentaires')}
          />
          <ListRow
            route="Plans"
            icon={<MaterialIcon name="playlist-add-check" size={18} color="grey" />}
            label={t('Plans')}
          />
        </ListSection>
>>>>>>> BIBLESTRONG-28

        <ListSection title={t('settings.settings')}>
          <ListRow
            route="ResourceLanguage"
            icon={<MaterialIcon name="language" size={18} color="grey" />}
            label={t('Changer la langue')}
          />
          <ListRow
            route="Theme"
            icon={<FeatherIcon name="sun" size={18} color="grey" />}
            label={t('settings.theme')}
          />
          <ListRow
            route="BibleDefaults"
            icon={<FeatherIcon name="book-open" size={18} color="grey" />}
            label={t('bibleDefaults.title')}
          />
          {Platform.OS === 'web' && (
            <ListRow
              route="KeyboardShortcuts"
              icon={<FeatherIcon name="command" size={18} color="grey" />}
              label={t('settings.keyboardShortcuts')}
            />
          )}
          {Platform.OS !== 'web' && (
            <ListRow
              route="Downloads"
              accessibilityLabel={hasUpdates ? t('accessibility.downloadsWithUpdates') : undefined}
              icon={<FeatherIcon name="download" size={18} color="grey" />}
              badge={hasUpdates}
              label={t('Gestion des téléchargements')}
            />
          )}
          {Platform.OS !== 'web' && (
            <ListRow
              onPress={checkForUpdate}
              icon={
                isCheckingUpdate ? (
                  <ActivityIndicator size="small" color={theme.colors.grey} />
                ) : (
                  <FeatherIcon name="refresh-cw" size={18} color="grey" />
                )
              }
              label={t('app.checkForUpdates')}
              hasChevron={false}
            />
          )}
        </ListSection>

<<<<<<< CYBERJUDAH
        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="help-circle" size={16} color="grey" />
            <Text
              className="ml-[8px] text-[12px] text-grey font-bold"
              style={{ textTransform: 'uppercase' }}
            >
              {t('settings.help')}
            </Text>
          </SectionCardHeader>
          <CardLinkItem onPress={() => openChangelogModal(true)}>
            <IconCircle bg="rgba(147, 51, 234, 0.1)">
              <FeatherIcon name="terminal" size={20} color="quint" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('Changelog')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="FAQ">
            <IconCircle bg="rgba(147, 51, 234, 0.1)">
              <FeatherIcon name="help-circle" size={20} color="quint" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('Foire aux questions')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem
            href={isCyberJudah ? 'https://github.com/DevSecObie/cyberjudah-app/issues' : undefined}
            onPress={isCyberJudah ? undefined : () => contactDeveloperRef.current?.present()}
            isLast
          >
            <IconCircle bg="rgba(147, 51, 234, 0.1)">
              <FeatherIcon name="send" size={20} color="quint" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('Contacter le développeur')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        </SectionCard>

        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="globe" size={16} color="grey" />
            <Text
              className="ml-[8px] text-[12px] text-grey font-bold"
              style={{ textTransform: 'uppercase' }}
            >
              {t('settings.community')}
            </Text>
          </SectionCardHeader>
          {!isCyberJudah && (
            <CardLinkItem href="https://www.facebook.com/fr.bible.strong">
              <IconCircle bg="rgba(59, 89, 152, 0.1)">
                <FeatherIcon name="facebook" size={20} color="primary" />
              </IconCircle>
              <Text className="flex-[1] text-[15px]">{t('Nous suivre sur facebook')}</Text>
              <FeatherIcon name="chevron-right" size={20} color="grey" />
            </CardLinkItem>
          )}
          {!isCyberJudah && (
            <CardLinkItem
              href={
                Platform.OS === 'ios'
                  ? 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8'
                  : 'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'
              }
            >
              <IconCircle bg="rgba(251, 191, 36, 0.1)">
                <FeatherIcon name="star" size={20} color="secondary" />
              </IconCircle>
              <Text className="flex-[1] text-[15px]">{t("Noter l'application")}</Text>
              <FeatherIcon name="chevron-right" size={20} color="grey" />
            </CardLinkItem>
          )}
          <CardLinkItem share={shareMessage()}>
            <IconCircle bg="rgba(16, 185, 129, 0.1)">
              <FeatherIcon name="share-2" size={20} color="success" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t("Partager l'application")}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          {!isCyberJudah && !appleIsReviewing && (
            <CardLinkItem
=======
        <ListSection title={t('settings.help')}>
          <ListRow
            onPress={() => openChangelogModal(true)}
            icon={<FeatherIcon name="terminal" size={18} color="quint" />}
            iconTint="quint"
            label={t('Changelog')}
          />
          <ListRow
            route="FAQ"
            icon={<FeatherIcon name="help-circle" size={18} color="quint" />}
            iconTint="quint"
            label={t('Foire aux questions')}
          />
          <ListRow
            onPress={() => contactDeveloperRef.current?.present()}
            icon={<FeatherIcon name="send" size={18} color="quint" />}
            iconTint="quint"
            label={t('Contacter le développeur')}
          />
        </ListSection>

        <ListSection title={t('settings.community')}>
          <ListRow
            href="https://www.facebook.com/fr.bible.strong"
            icon={<FeatherIcon name="facebook" size={18} color="primary" />}
            iconTint="primary"
            label={t('Nous suivre sur facebook')}
          />
          <ListRow
            href={
              Platform.OS === 'ios'
                ? 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8'
                : 'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'
            }
            icon={<FeatherIcon name="star" size={18} color="secondary" />}
            iconTint="secondary"
            label={t("Noter l'application")}
          />
          <ListRow
            share={shareMessage()}
            icon={<FeatherIcon name="share-2" size={18} color="success" />}
            iconTint="success"
            label={t("Partager l'application")}
          />
          {!appleIsReviewing && (
            <ListRow
>>>>>>> BIBLESTRONG-28
              href={
                lang === 'fr' ? 'https://bible-strong.app/fr/give' : 'https://bible-strong.app/give'
              }
              icon={<FeatherIcon name="heart" size={18} color="color2" />}
              iconTint="color2"
              label={t('Contribuer')}
            />
          )}
<<<<<<< CYBERJUDAH
          <CardLinkItem
            href={
              isCyberJudah
                ? 'https://github.com/DevSecObie/cyberjudah-app'
                : 'https://github.com/smontlouis/bible-strong'
            }
            isLast
          >
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <FeatherIcon name="github" size={20} color="grey" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">Github</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        </SectionCard>
=======
          <ListRow
            href="https://github.com/smontlouis/bible-strong"
            icon={<FeatherIcon name="github" size={18} color="grey" />}
            label="Github"
          />
        </ListSection>
>>>>>>> BIBLESTRONG-28

        {isLogged && (
          <ListSection>
            <ListRow
              onPress={promptLogout}
              icon={<FeatherIcon name="log-out" size={18} color="quart" />}
              iconTint="quart"
              label={t('Se déconnecter')}
              destructive
              hasChevron={false}
            />
          </ListSection>
        )}

        <Box className="overflow-hidden border-continuous px-[24px] mb-[22px]">
          <LinkItem
            style={{ paddingVertical: 8, paddingHorizontal: 0 }}
            href={
              isCyberJudah
                ? 'https://cyberjudah.io/app/privacy'
                : lang === 'fr'
                  ? 'https://bible-strong.app/politique-de-confidentialite'
                  : 'https://bible-strong.app/privacy-policy'
            }
          >
            <Text className="text-[13px] text-grey">{t('Politique de confidentialité')}</Text>
          </LinkItem>
          <LinkItem
            style={{ paddingVertical: 8, paddingHorizontal: 0 }}
            href={
              isCyberJudah
                ? 'https://cyberjudah.io/app/terms'
                : lang === 'fr'
                  ? 'https://bible-strong.app/eula'
                  : 'https://bible-strong.app/eula-en'
            }
          >
            <Text className="text-[13px] text-grey">{t("Conditions d'utilisation")}</Text>
          </LinkItem>
          {isLogged && (
            <LinkItem
              style={{ paddingVertical: 8, paddingHorizontal: 0 }}
              onPress={() => deleteAccountModalRef.current?.present()}
            >
              <Text className="text-[13px] text-grey">{t('app.deleteAccount')}</Text>
            </LinkItem>
          )}
        </Box>

        {__DEV__ && Platform.OS !== 'web' && (
          <ListSection title="Dev">
            <ListRow
              onPress={() =>
                router.push({ pathname: '/playground', params: { playground: 'avatar' } })
              }
              icon={<FeatherIcon name="smile" size={18} color="primary" />}
              iconTint="primary"
              label="Playground · Avatar"
            />
            <ListRow
              onPress={promptNuke}
              icon={<FeatherIcon name="trash-2" size={18} color="quart" />}
              iconTint="quart"
              label="Nuke app (reset total)"
              destructive
              hasChevron={false}
            />
          </ListSection>
        )}

        <Infos />
      </ScrollView>
      <ContactDeveloperSheet modalRef={contactDeveloperRef} />
      {isLogged && <DeleteAccountModal modalRef={deleteAccountModalRef} />}
    </SafeAreaBox>
  )
}

const MoreScreen = () => {
  const router = useRouter()
  const closeMenu = () => goBackOrHome(router)

  const isWide = useResponsiveWorkspace()
  return <More closeMenu={closeMenu} inWorkspace={isWide} />
}

export default memo(MoreScreen)
