import TrackPlayer from 'react-native-track-player'
import { createTrackPlayerSetupGuard } from './trackPlayerSetupGuard'

export { createTrackPlayerSetupGuard }

// On the web the player is Shaka (about 300 KB), fetched when the player is set up. The Bible
// footer sets it up as soon as a chapter opens, so wait until the first screen is idle: the
// chapter's text and its requests come first.
let idle: Promise<void> | undefined
const afterFirstScreen = () =>
  (idle ??= new Promise<void>(resolve => {
    if (typeof requestIdleCallback === 'function')
      requestIdleCallback(() => resolve(), { timeout: 3000 })
    else setTimeout(resolve, 1500)
  }))

const setup = createTrackPlayerSetupGuard(TrackPlayer)

export const ensureTrackPlayerSetup = () => afterFirstScreen().then(setup)
