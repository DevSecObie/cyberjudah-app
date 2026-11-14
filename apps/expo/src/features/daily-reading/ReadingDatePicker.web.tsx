import { DatePicker } from '@heroui/react/date-picker'
import { DateField } from '@heroui/react/date-field'
import { Calendar } from '@heroui/react/calendar'
import { parseDate } from '@internationalized/date'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { I18nProvider } from 'react-aria-components'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import ModalSheet from '~common/ModalSheet'
import type { SheetRef } from '~common/sheet'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { IS_TELEGRAM_PHONE, LOOK_OS } from '~helpers/lookPlatform.web'
import { webFontFamily } from '~helpers/webFontFamily'
import { isCivilDate } from '~features/plans/readingCalendar'
import themes from '~themes'
import { useTheme } from '~themes/ThemeProvider'
import './reading-datepicker.generated.web.css'
import type { ReadingDatePickerProps } from './ReadingDatePicker'

const useDatePickerTheme = () => {
  const theme = useTheme()
  const dark = ['black', 'dark', 'mauve', 'night'].some(
    name => themes[name].colors === theme.colors
  )
  return {
    theme,
    fontFamily: webFontFamily(theme.fontFamily.text),
    themeClass: `reading-datepicker-theme${dark ? ' dark' : ''}`,
  }
}

const ReadingDatePicker = (props: ReadingDatePickerProps) =>
  IS_TELEGRAM_PHONE ? <PhoneReadingDatePicker {...props} /> : <WebReadingDatePicker {...props} />

/**
 * Inside Telegram on a phone, the date is picked as the phone app picks it (ReadingDatePicker.tsx):
 * the date as a link, then a calendar in a sheet on iPhone, or Android's date dialog.
 */
const PhoneReadingDatePicker = ({
  value,
  label,
  onChange,
  minimum,
  maximum,
  variant = 'default',
}: ReadingDatePickerProps) => {
  const { theme, fontFamily, themeClass } = useDatePickerTheme()
  const { t, i18n } = useTranslation()
  const sheet = useRef<SheetRef>(null)
  const [androidOpen, setAndroidOpen] = useState(false)
  const date = new Date(`${value}T12:00:00`)
  const shownDate = date.toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const calendar = (
    <I18nProvider locale={i18n.language}>
      <Calendar
        className={themeClass}
        style={{ fontFamily, width: '100%' }}
        aria-label={label}
        value={isCivilDate(value) ? parseDate(value) : null}
        minValue={minimum && isCivilDate(minimum) ? parseDate(minimum) : undefined}
        maxValue={maximum && isCivilDate(maximum) ? parseDate(maximum) : undefined}
        onChange={next => {
          onChange(next.toString())
          setAndroidOpen(false)
          sheet.current?.dismiss()
        }}
      >
        <Calendar.Header>
          <Calendar.YearPickerTrigger>
            <Calendar.YearPickerTriggerHeading />
            <Calendar.YearPickerTriggerIndicator />
          </Calendar.YearPickerTrigger>
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>
            {day => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
          </Calendar.GridHeader>
          <Calendar.GridBody>{day => <Calendar.Cell date={day} />}</Calendar.GridBody>
        </Calendar.Grid>
        <Calendar.YearPickerGrid>
          <Calendar.YearPickerGridBody>
            {({ year }) => <Calendar.YearPickerCell year={year} />}
          </Calendar.YearPickerGridBody>
        </Calendar.YearPickerGrid>
      </Calendar>
    </I18nProvider>
  )
  return (
    <>
      <Link
        accessibilityLabel={label}
        onPress={() => (LOOK_OS === 'ios' ? sheet.current?.present() : setAndroidOpen(true))}
        className={
          variant === 'pill'
            ? 'min-h-[36px] flex-row items-center justify-center bg-light-primary rounded-full px-[14px] py-[7px]'
            : 'min-h-[44px] flex-row items-center justify-center gap-[8px] px-[12px] py-[10px]'
        }
      >
        <Text
          className={
            variant === 'pill'
              ? 'text-link font-bold text-center shrink'
              : 'text-link text-[14px] font-bold text-center shrink'
          }
        >
          {shownDate}
        </Text>
        {variant !== 'pill' && <FeatherIcon name="chevron-down" size={16} color="primary" />}
      </Link>
      {LOOK_OS === 'ios' ? (
        <ModalSheet ref={sheet} modalTitle={label}>
          <div style={{ padding: '4px 20px 32px' }}>{calendar}</div>
        </ModalSheet>
      ) : (
        androidOpen &&
        // Above every page layer, as Android's own dialog is.
        createPortal(
          <div
            role="presentation"
            onClick={() => setAndroidOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1600,
              background: '#0006',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              role="dialog"
              aria-label={label}
              onClick={event => event.stopPropagation()}
              style={{
                width: 'min(360px, calc(100% - 48px))',
                boxSizing: 'border-box',
                padding: '20px 16px 8px',
                borderRadius: 24,
                background: theme.colors.reverse,
                color: theme.colors.default,
                fontFamily,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ padding: '0 8px', fontSize: 13, color: theme.colors.grey }}>
                {label}
              </div>
              <div style={{ padding: '0 8px', fontSize: 28, lineHeight: '36px' }}>{shownDate}</div>
              {calendar}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setAndroidOpen(false)}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: '10px 12px',
                    color: theme.colors.primary,
                    font: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('Annuler')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}
    </>
  )
}

const WebReadingDatePicker = ({
  value,
  label,
  onChange,
  minimum,
  maximum,
}: ReadingDatePickerProps) => {
  const { fontFamily, themeClass } = useDatePickerTheme()
  const { i18n } = useTranslation()
  return (
    <I18nProvider locale={i18n.language}>
      <DatePicker
        className={themeClass}
        aria-label={label}
        value={isCivilDate(value) ? parseDate(value) : null}
        minValue={minimum && isCivilDate(minimum) ? parseDate(minimum) : undefined}
        maxValue={maximum && isCivilDate(maximum) ? parseDate(maximum) : undefined}
        onChange={date => {
          if (date) onChange(date.toString())
        }}
        granularity="day"
        shouldForceLeadingZeros
        style={{ fontFamily }}
      >
        <DateField.Group>
          <DateField.Input>{segment => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger aria-label={label}>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover className={themeClass} style={{ fontFamily }}>
          <Calendar aria-label={label}>
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {day => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>{date => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => <Calendar.YearPickerCell year={year} />}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </I18nProvider>
  )
}
export default ReadingDatePicker
