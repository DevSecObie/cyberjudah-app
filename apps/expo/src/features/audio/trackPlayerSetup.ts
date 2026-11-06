import TrackPlayer from 'react-native-track-player'
import { createTrackPlayerSetupGuard } from './trackPlayerSetupGuard'

export { createTrackPlayerSetupGuard }

export const ensureTrackPlayerSetup = createTrackPlayerSetupGuard(TrackPlayer)
