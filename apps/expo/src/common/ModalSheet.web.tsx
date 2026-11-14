import { useImperativeHandle, useRef, useState } from 'react'
import { Modal } from '@heroui/react/modal'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import { webThemeVariables } from '~themes/webThemeVariables'
import { webFontFamily, webTitleFontStyle } from '~helpers/webFontFamily'
import { FeatherIcon } from './ui/Icon'
import type { ModalSheetProps } from './ModalSheet'
import './modal-sheet.css'
import { readSheetHeader } from './readSheetHeader'
import { WithoutWorkspaceHeaderInset } from '~features/app-switcher/workspaceHeaderInset'
import { IS_TELEGRAM_PHONE, LOOK_OS } from '~helpers/lookPlatform.web'
import { colorWithOpacity } from '~themes/colorValues'

// Inside Telegram on a phone the sheet rises from the bottom like the phone app's own sheets:
// frosted glass on iPhone, solid with larger corners on Android (modal-sheet.css).
const phoneClass = IS_TELEGRAM_PHONE ? ` bs-modal-phone bs-modal-${LOOK_OS}` : ''

export default function ModalSheet({
  ref,
  children,
  header,
  footer: Footer,
  modalTitle,
  accessibilityLabel,
  maxWidth = 550,
  dismissible = true,
  snapPoints,
  onPresent,
  onDismissStart,
  onDismiss,
  onClose,
  onOpenChange,
}: ModalSheetProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const opened = useRef(false)
  const close = () => {
    if (!opened.current) return
    opened.current = false
    onDismissStart?.()
    setOpen(false)
    onOpenChange?.(false)
    onClose?.()
    onDismiss?.()
  }
  useImperativeHandle(ref, () => {
    const present = () => {
      if (opened.current) return
      opened.current = true
      setOpen(true)
      onOpenChange?.(true)
      onPresent?.()
    }
    return {
      present,
      presentAt: present,
      resizeTo: () => {},
      dismiss: close,
      dismissThen: action => {
        close()
        action()
      },
      close,
      forceClose: close,
    }
  })
  const heading = readSheetHeader(header)
  const title = modalTitle ?? heading?.title ?? accessibilityLabel ?? t('Options')
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={value => {
        if (!value) close()
      }}
      isDismissable={dismissible}
      isKeyboardDismissDisabled={!dismissible}
      className={`bs-modal-backdrop${phoneClass}`}
    >
      <div style={{ width: '100%', maxWidth }}>
        <Modal.Container placement="center" className="bs-modal-container">
          <Modal.Dialog
            className="bs-modal-dialog"
            style={{
              ...webThemeVariables(theme.colors),
              background:
                LOOK_OS === 'ios' && IS_TELEGRAM_PHONE
                  ? colorWithOpacity(theme.colors.reverse, 0.78)
                  : theme.colors.reverse,
              color: theme.colors.default,
              borderColor: theme.colors.border,
              fontFamily: webFontFamily(theme.fontFamily.text),
              ...(snapPoints?.includes(1) ? { height: 'min(720px, calc(100dvh - 48px))' } : {}),
            }}
          >
            <Modal.Header className="bs-modal-header">
              {heading?.hasBackButton && (
                <button
                  className="bs-modal-close"
                  aria-label={t('Retour')}
                  onClick={heading.onBackPress}
                >
                  <FeatherIcon name="arrow-left" size={18} />
                </button>
              )}
              {heading?.leftComponent}
              <Modal.Heading style={webTitleFontStyle(theme)}>{title}</Modal.Heading>
              {heading?.rightComponent}
              {dismissible && (
                <button className="bs-modal-close" aria-label={t('Fermer')} onClick={close}>
                  <FeatherIcon name="x" size={18} />
                </button>
              )}
            </Modal.Header>
            {heading?.subTitle && <div className="bs-modal-subtitle">{heading.subTitle}</div>}
            {heading?.children}
            <Modal.Body className="bs-modal-body">
              <WithoutWorkspaceHeaderInset>{children}</WithoutWorkspaceHeaderInset>
            </Modal.Body>
            {Footer && (
              <Modal.Footer className="bs-modal-footer">
                <Footer />
              </Modal.Footer>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </div>
    </Modal.Backdrop>
  )
}
