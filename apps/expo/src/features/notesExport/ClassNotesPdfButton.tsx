import * as Sentry from '@sentry/react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import Link from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import {
  type NoteBlock,
  classNotesToBlocks,
  loadPublishedNote,
} from '~features/passageMediaLibrary/cyberJudahClasses'
import { toast } from '~helpers/toast'
import { useTheme } from '~themes/ThemeProvider'
import { printScreenPdf } from './printScreenPdf'

/** The header's "Save as PDF" for a class's notes, like the Telegram app's export. */
export default function ClassNotesPdfButton({
  notesPath,
  blocks,
  videoId = '',
}: {
  notesPath: string
  blocks?: NoteBlock[]
  videoId?: string
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [busy, setBusy] = useState(false)

  const exportPdf = async () => {
    if (busy) return
    setBusy(true)
    try {
      const note = await loadPublishedNote(notesPath)
      // Loaded on tap: the PDF library is large and only this action needs it.
      const { pdfName } = await import('./notePdf')
      const { classScreenPdfHtml } = await import('./screenPdfHtml')
      const html = classScreenPdfHtml(
        note,
        blocks ?? classNotesToBlocks(note.body ?? '', videoId),
        theme
      )
      await printScreenPdf(html, pdfName(note), t('notesExport.savePdf'))
    } catch (e) {
      toast.error(t('notesExport.pdfError'))
      console.log('[NotesExport] Class notes PDF failed:', e)
      Sentry.captureException(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Link accessibilityLabel={t('notesExport.savePdf')} onPress={exportPdf} padding>
      {busy ? <ActivityIndicator /> : <FeatherIcon size={20} name="share" color="primary" />}
    </Link>
  )
}
