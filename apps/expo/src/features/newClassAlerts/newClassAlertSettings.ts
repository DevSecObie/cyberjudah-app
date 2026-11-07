/** Alerts for new classes arrive on phones only; the web app has none (newClassAlertSettings.native.ts). */
export type NewClassAlertsResult = 'on' | 'off' | 'denied' | 'unavailable' | 'error'
export const newClassAlertsAvailable = () => false
export const readNewClassAlertsChoice = () => false
export const enableNewClassAlerts = async (): Promise<NewClassAlertsResult> => 'unavailable'
export const disableNewClassAlerts = async (): Promise<NewClassAlertsResult> => 'off'
