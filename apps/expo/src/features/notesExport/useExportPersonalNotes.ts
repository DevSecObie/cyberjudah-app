import * as Sentry from '@sentry/react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '~helpers/toast'
import type { PersonalNotePdfEntry } from './notePdf'
import { useTheme } from '~themes/ThemeProvider'
import { printScreenPdf } from './printScreenPdf'

/** Exports the reader's notes as one PDF and opens the share sheet; `busy` while it is made. */
export function useExportPersonalNotes() {
  const { t } = useTranslation()
  const theme = useTheme()
  const [busy, setBusy] = useState(false)

  const exportPdf = async (entries: PersonalNotePdfEntry[]) => {
    if (busy || !entries.length) return
    setBusy(true)
    try {
      const heading = t('notesExport.myNotes')
      // Loaded on demand: the PDF library is large and only this action needs it.
      const { personalNotesPdfName } = await import('./notePdf')
      const { personalScreenPdfHtml } = await import('./screenPdfHtml')
      const html = personalScreenPdfHtml(entries, heading, theme)
      const single = entries.length === 1 ? entries[0] : null
      const name = personalNotesPdfName(single ? single.title || single.reference : heading)
      await printScreenPdf(html, name, t('notesExport.savePdf'))
    } catch (e) {
      toast.error(t('notesExport.pdfError'))
      console.log('[NotesExport] Personal notes PDF failed:', e)
      Sentry.captureException(e)
    } finally {
      setBusy(false)
    }
  }

  return { busy, exportPdf }
}
