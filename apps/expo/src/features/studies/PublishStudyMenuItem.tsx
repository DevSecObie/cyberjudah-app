import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Platform, Share, StyleSheet } from 'react-native'
import { openInApp } from '~common/inAppBrowser'
import PanelAction from '~common/ContextualPanel/PanelAction'
import { useDispatch, useSelector } from 'react-redux'
import { LinkBox } from '~common/Link'
import { toast } from '~helpers/toast'
import { Status } from '~common/types'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import useConnection from '~helpers/useConnection'
import { publishStudy, Study } from '~redux/modules/user'
import type { AppDispatch, RootState } from '~redux/store'
import Clipboard from '@react-native-clipboard/clipboard'
import { remoteQueryOptions } from '~helpers/queryOptions'
import { printScreenPdf } from '~features/notesExport/printScreenPdf'
import { useTheme } from '~themes/ThemeProvider'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import {
  deletePublishedStudy,
  publishedStudyStatus,
  publishedStudyUrl,
  putPublishedStudy,
} from './publishedStudies'
interface Props {
  study: Study
  onClosed: () => void
}

// Published studies live on CyberJudah's own server (publishedStudies.ts), never on Bible Strong's.
const useStudyStatus = (study: Study) => {
  const url = publishedStudyUrl(study.id)
  const query = useQuery({
    queryKey: ['published-study-status', study.id],
    queryFn: () => publishedStudyStatus(study.id),
    enabled: study.published,
    ...remoteQueryOptions,
  })
  const status: Status = !study.published
    ? 'Idle'
    : query.fetchStatus === 'paused'
      ? 'Rejected'
      : query.isPending
        ? 'Pending'
        : query.isError
          ? 'Rejected'
          : 'Resolved'

  return { url, status, data: query.data }
}

const PublishStudyMenuItem = ({ study, onClosed }: Props) => {
  const { status, data, url } = useStudyStatus(study)
  const [pdfStatus, setPDFStatus] = useState<Status>('Idle')
  const isConnected = useConnection()
  const dispatch = useDispatch<AppDispatch>()
  const { t } = useTranslation()
  const theme = useTheme()
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const { colorScheme } = useCurrentThemeSelector()

  const queryClient = useQueryClient()
  const [publishing, setPublishing] = useState(false)
  const refreshStatus = () =>
    queryClient.invalidateQueries({ queryKey: ['published-study-status', study.id] })

  const onPublishStudy = async () => {
    if (!isConnected || publishing) return
    setPublishing(true)
    try {
      await putPublishedStudy(study)
      if (!study.published) await dispatch(publishStudy(study.id))
      await refreshStatus()
      toast(t('studies.publishedCopyUpdated'))
    } catch (e) {
      console.log('[Studies] Could not publish the study:', e)
      toast.error(t('studies.publishFailed'))
    } finally {
      setPublishing(false)
    }
  }

  const onUnpublishStudy = async () => {
    if (publishing) return
    setPublishing(true)
    try {
      await deletePublishedStudy(study.id)
      await dispatch(publishStudy(study.id, false))
      await refreshStatus()
    } catch (e) {
      console.log('[Studies] Could not unpublish the study:', e)
      toast.error(t('studies.publishFailed'))
    } finally {
      setPublishing(false)
    }
  }

  const copyToClipboard = async (url: string) => {
    Clipboard.setString(url)
    toast(t('Copié dans le presse-papiers.'))
  }

  const shareVerse = async (title: string, userName: string, url: string) => {
    const result = await Share.share({
      message: `${title}, ${t('créé par')} ${userName}
    ${url}`,
    })
    return result
  }

  // Print the rich study locally, then hand its PDF to the existing share sheet.
  const exportPDF = async () => {
    try {
      setPDFStatus('Pending')
      const { pdfName } = await import('~features/notesExport/notePdf')
      const { studyScreenPdfHtml } = await import('~features/notesExport/studyScreenPdfHtml')
      const html = studyScreenPdfHtml(study, theme, colorScheme === 'dark', fontFamily)
      setPDFStatus('Resolved')
      onClosed()
      await printScreenPdf(html, pdfName({ title: study.title }), study.title)
    } catch (e) {
      console.log('[Studies] Error generating PDF:', e)
      setPDFStatus('Rejected')
    }
  }

  if (Platform.OS === 'web') {
    return (
      <Box
        className="pb-1 mb-1 border-separator"
        style={{ borderBottomWidth: StyleSheet.hairlineWidth }}
      >
        {!study.published ? (
          <PanelAction
            icon="upload-cloud"
            label={t("Publier l'étude")}
            disabled={!isConnected || publishing}
            onPress={() => void onPublishStudy()}
          />
        ) : (
          <>
            {status === 'Resolved' && data === 200 ? (
              <PanelAction
                icon="link-2"
                label={t("Dépublier l'étude")}
                onPress={() => void onUnpublishStudy()}
              />
            ) : (
              <Box className="flex-row items-center gap-3 p-3">
                {status === 'Pending' ? (
                  <ActivityIndicator size={17} />
                ) : (
                  <FeatherIcon
                    name="link-2"
                    size={17}
                    color={status === 'Rejected' ? 'quart' : 'tertiary'}
                  />
                )}
                <Text className="flex-1 text-[14px] text-tertiary">
                  {t(
                    status === 'Pending'
                      ? 'Chargement'
                      : status === 'Rejected'
                        ? 'Impossible de vérifier le lien'
                        : 'Publication en cours...'
                  )}
                </Text>
              </Box>
            )}
            <PanelAction
              icon="refresh-cw"
              label={t('studies.updatePublishedCopy')}
              disabled={!isConnected || publishing}
              onPress={() => void onPublishStudy()}
            />
            <PanelAction
              icon="external-link"
              label={t('Ouvrir le lien')}
              onPress={() => {
                openInApp(url)
              }}
            />
            <PanelAction
              icon="copy"
              label={t('Copier le lien')}
              onPress={() => {
                void copyToClipboard(url)
                onClosed()
              }}
            />
            <PanelAction
              icon="share-2"
              label={t('Partager')}
              onPress={async () => {
                const result = await shareVerse(study.title, study.user.displayName, url)
                if (result.action === Share.sharedAction) onClosed()
              }}
            />
          </>
        )}
      </Box>
    )
  }

  return (
    <>
      {study.published ? (
        <>
          <Box className="overflow-hidden border-continuous p-[20px]">
            {status === 'Pending' && (
              <Box className="overflow-hidden border-continuous flex-row items-center py-[10px]">
                <ActivityIndicator size={20} />
                <Text className="ml-[20px]">{t('Chargement')}</Text>
              </Box>
            )}
            {status === 'Resolved' && (
              <>
                {data === 200 ? (
                  <LinkBox
                    className="py-[10px] items-center flex-row"
                    onPress={() => void onUnpublishStudy()}
                  >
                    <FeatherIcon name="link-2" color="success" size={20} />
                    <Text className="ml-[20px]">{t("Dépublier l'étude")}</Text>
                  </LinkBox>
                ) : (
                  <Box className="overflow-hidden border-continuous flex-row items-center py-[10px]">
                    <FeatherIcon name="link-2" color="secondary" size={20} />
                    <Text className="text-grey ml-[20px]">{t('Publication en cours...')}</Text>
                  </Box>
                )}
              </>
            )}
            {status === 'Rejected' && (
              <Box className="overflow-hidden border-continuous flex-row items-center py-[10px]">
                <FeatherIcon name="link-2" color="quart" size={20} />
                <Text className="ml-[20px]">{t('Impossible de vérifier le lien')}</Text>
              </Box>
            )}

            <LinkBox
              className="py-[10px] items-center flex-row"
              disabled={!isConnected || publishing}
              style={{ opacity: !isConnected || publishing ? 0.6 : 1 }}
              onPress={() => void onPublishStudy()}
            >
              {publishing ? (
                <ActivityIndicator size={20} />
              ) : (
                <FeatherIcon name="refresh-cw" size={20} />
              )}
              <Text className="ml-[20px]">{t('studies.updatePublishedCopy')}</Text>
            </LinkBox>
            <LinkBox className="py-[10px] items-center flex-row" href={url}>
              <FeatherIcon name="external-link" size={20} />
              <Text className="ml-[20px]">{t('Ouvrir le lien')}</Text>
            </LinkBox>
            <LinkBox
              className="py-[10px] items-center flex-row"
              onPress={() => {
                copyToClipboard(url)
                onClosed()
              }}
            >
              <FeatherIcon name="copy" size={20} />
              <Text className="ml-[20px]">{t('Copier le lien')}</Text>
            </LinkBox>
            <LinkBox
              className="py-[10px] items-center flex-row"
              onPress={async () => {
                const result = await shareVerse(study.title, study.user.displayName, url)
                if (result.action === Share.sharedAction) {
                  onClosed()
                }
              }}
            >
              <FeatherIcon name="share-2" size={20} />
              <Text className="ml-[20px]">{t('Partager')}</Text>
            </LinkBox>
            {(pdfStatus === 'Idle' || pdfStatus === 'Rejected') && (
              <LinkBox className="py-[10px] items-center flex-row" onPress={() => exportPDF()}>
                <MaterialIcon name="picture-as-pdf" size={20} />
                {pdfStatus === 'Idle' ? (
                  <Text className="ml-[20px]">{t('Exporter en pdf')}</Text>
                ) : (
                  <Text className="text-quart ml-[20px]">
                    {t("Une erreur s'est produite. Réessayer ?")}
                  </Text>
                )}
              </LinkBox>
            )}
            {pdfStatus === 'Pending' && (
              <Box
                className="overflow-hidden border-continuous flex-row items-center py-[10px]"
                style={{ opacity: 0.6 }}
              >
                <ActivityIndicator size={20} />
                <Text className="ml-[20px]">{t('Génération du pdf...')}</Text>
              </Box>
            )}
            {pdfStatus === 'Resolved' && (
              <Box className="overflow-hidden border-continuous flex-row items-center py-[10px]">
                <MaterialIcon name="picture-as-pdf" size={20} />
                <Text className="ml-[20px]">{t('Ouverture du fichier...')}</Text>
              </Box>
            )}
          </Box>
          <Border />
        </>
      ) : (
        <>
          <Box className="overflow-hidden border-continuous p-[20px]">
            <LinkBox
              className="items-center flex-row"
              onPress={() => void onPublishStudy()}
              disabled={!isConnected || publishing}
              style={{ opacity: !isConnected || publishing ? 0.6 : 1 }}
            >
              {publishing && <ActivityIndicator size={16} style={{ marginRight: 10 }} />}
              <Text>{t("Publier l'étude")}</Text>
            </LinkBox>
            {pdfStatus !== 'Pending' && (
              <LinkBox className="pt-[20px] items-center flex-row" onPress={() => exportPDF()}>
                <MaterialIcon name="picture-as-pdf" size={20} />
                <Text className={pdfStatus === 'Rejected' ? 'text-quart ml-[20px]' : 'ml-[20px]'}>
                  {t(
                    pdfStatus === 'Rejected'
                      ? "Une erreur s'est produite. Réessayer ?"
                      : 'Exporter en pdf'
                  )}
                </Text>
              </LinkBox>
            )}
            {pdfStatus === 'Pending' && (
              <Box className="pt-[20px] flex-row items-center" style={{ opacity: 0.6 }}>
                <ActivityIndicator size={20} />
                <Text className="ml-[20px]">{t('Génération du pdf...')}</Text>
              </Box>
            )}
          </Box>
          <Border />
        </>
      )}
    </>
  )
}

export default PublishStudyMenuItem
