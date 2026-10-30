import * as Sentry from '@sentry/react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import Link from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import { loadPublishedNote } from '~features/passageMediaLibrary/cyberJudahClasses'
import { toast } from '~helpers/toast'
import { classNotePdf, pdfName } from './notePdf'
import { sharePdf } from './sharePdf'

/** The header's "Save as PDF" for a class's notes, like the Telegram app's export. */
export default function ClassNotesPdfButton({ notesPath }: { notesPath: string }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  const exportPdf = async () => {
    if (busy) return
    setBusy(true)
    try {
      const note = await loadPublishedNote(notesPath)
      const base64 = await classNotePdf({ ...note, url: note.url ?? notesPath })
      await sharePdf(base64, pdfName(note), t('notesExport.savePdf'))
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
