import { ExpoConfig, ConfigContext } from 'expo/config'

const APP_VERSION = '1.0.0'
// Patch releases share a runtime and receive the same OTA updates. Any native change must
// ship in a new major or minor version, which creates a new runtime.
const [majorVersion, minorVersion] = APP_VERSION.split('.')
const RUNTIME_VERSION = `${majorVersion}.${minorVersion}`

// The families of public pages a link opens in the application.
const PUBLIC_RESOURCE_PATHS = [
  '/bible/',
  '/strong/',
  '/dictionary/',
  '/nave/',
  '/commentary/',
  '/timeline/',
]

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.APP_NAME ?? 'CyberJudah',
  description: 'CyberJudah Bible reading and study',
  slug: 'cyberjudah',
  scheme: 'cyberjudah-staging',
  primaryColor: '#ffffff',
  githubUrl: 'https://github.com/DevSecObie/cyberjudah-app',
  platforms: ['ios', 'android', 'web'],
  version: APP_VERSION,
  orientation: 'default',
  icon: './assets/images/icon-2.png',
  userInterfaceStyle: 'automatic',

  android: {
    versionCode: 516,
    package: 'io.cyberjudah.app',
    googleServicesFile:
      process.env.ANDROID_GOOGLE_SERVICES_FILE ?? 'firebase/cyberjudah/google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/images/foreground-image.png',
      backgroundImage: './assets/images/background-image.png',
      monochromeImage: './assets/images/icon_notification.png',
    },
    // Deep linking: Android App Links. Only the resources the application shows (ADR-0082):
    // the home of the site, its legal pages and shared studies stay in the browser.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: PUBLIC_RESOURCE_PATHS.map(pathPrefix => ({
          scheme: 'https',
          host: 'cyberjudah.io',
          pathPrefix,
        })),
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  ios: {
    bundleIdentifier: process.env.BUNDLE_IDENTIFIER ?? 'io.cyberjudah.app',
    appleTeamId: process.env.CYBERJUDAH_APPLE_TEAM_ID ?? 'M8DUMWBXLH',
    buildNumber: '316',
    googleServicesFile:
      process.env.IOS_GOOGLE_SERVICES_FILE ??
      './firebase/cyberjudah-production/GoogleService-Info.plist',
    userInterfaceStyle: 'automatic',
    supportsTablet: true,
    infoPlist: {
      UIBackgroundModes: ['audio'],
      ITSAppUsesNonExemptEncryption: false,
      CFBundleAllowMixedLocalizations: true,
      CFBundleLocalizations: ['en', 'fr'],
      CFBundleDevelopmentRegion: 'en',
    },

    entitlements: {
      'com.apple.developer.applesignin': ['Default'],
      'com.apple.developer.devicecheck.appattest-environment': 'production',
    },
    // Deep linking: iOS Universal Links
    associatedDomains: ['applinks:cyberjudah.io'],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/icon-2.png',
  },
  plugins: [
    'expo-sharing',
    'expo-router',
    'expo-asset',
    'expo-image',
    'expo-sqlite',
    'expo-audio',
    // CocoaPods, not SPM: RNFirebase 26 rejects SPM with our static frameworks linkage.
    ['@react-native-firebase/app', { ios: { disableSPM: true } }],
    './plugins/withFirebaseAppCheckSwiftBridge.js',
    // Offline-copy keys come from BIBLE_STRONG_ARCHIVE_KEYS in the build environment (ADR-0065).
    './plugins/withBibleStrongArchiveKeys.js',
    '@react-native-firebase/app-check',
    '@react-native-firebase/auth',
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '16.4',
          useFrameworks: 'static',
          forceStaticLinking: [
            'RNFBApp',
            'RNFBAppCheck',
            'RNFBAuth',
            'RNFBFirestore',
            'RNFBConfig',
            'RNFBStorage',
          ],
        },
        android: {
          targetSdkVersion: 36,
          usesCleartextTraffic: true,
          extraMavenRepos: ['../../node_modules/@notifee/react-native/android/libs'],
        },
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          './src/assets/fonts/LiterataBook-Regular.otf',
          './src/assets/fonts/eina-03-bold.otf',
        ],
      },
    ],
    [
      'expo-document-picker',
      {
        iCloudContainerEnvironment: 'Production',
      },
    ],
    ['./plugins/gradleProperties.js'],
    [
      './plugins/withAndroidUsesFeature.js',
      {
        name: 'android.hardware.microphone',
        attributes: {
          required: 'false',
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash.png',
        imageWidth: 200,
        backgroundColor: '#ffffff',
        dark: {
          image: './assets/images/splash-dark.png',
          imageWidth: 200,
          backgroundColor: '#0F2132',
        },
      },
    ],
    ['@react-native-google-signin/google-signin'],
    ['react-native-edge-to-edge'],
  ],
  extra: {
    resourceApiUrl: process.env.EXPO_PUBLIC_RESOURCE_API_URL ?? 'https://api.cyberjudah.io',
    resourceArtifactBaseUrl:
      process.env.EXPO_PUBLIC_RESOURCE_ARTIFACT_BASE_URL ??
      'https://api.cyberjudah.io/v1/offline-artifacts/',
    eas: {
      projectId: 'ee1c2f69-3a80-46c5-b67d-7f4a75def656',
    },
  },
  updates: {
    enabled: false,
    checkAutomatically: 'NEVER',
    requestHeaders: {
      'expo-channel-name': process.env.EAS_BUILD_CHANNEL,
    },
  },
  experiments: {
    reactCompiler: true,
  },
  runtimeVersion: RUNTIME_VERSION,
})
