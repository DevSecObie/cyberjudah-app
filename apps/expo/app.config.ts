import { ExpoConfig, ConfigContext } from 'expo/config'

const isCyberJudah = process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah'
// CyberJudah keeps its own TestFlight version; 28.3 is its first on Bible Strong 28 (Expo 58).
const APP_VERSION = isCyberJudah ? '28.3.0' : '28.0.1'
// Patch releases share a runtime and receive the same OTA updates. Any native change must
// ship in a new major or minor version, which creates a new runtime.
const [majorVersion, minorVersion] = APP_VERSION.split('.')
const RUNTIME_VERSION = `${majorVersion}.${minorVersion}`
// The owner's live-editing dev app ("CyberJudah Preview"), installed next to TestFlight builds.
const isCyberJudahPreview = process.env.BUNDLE_IDENTIFIER === 'io.cyberjudah.app.preview'
// CyberJudah's own Expo project (free tier). Over-the-air updates come from updates.cyberjudah.io.
const CYBERJUDAH_EAS_PROJECT_ID = 'ee1c2f69-3a80-46c5-b67d-7f4a75def656'

// Icon fonts built into the Android app. Loaded at run time, a font file an update copied can
// be empty on disk, and every icon of that family stays blank. Each family is named as
// @expo/vector-icons checks it with Font.isLoaded, so the icons never load it again. The plugin
// resolves the path as a module when it is not a file of the project.
const vectorIconFont = (fontFamily: string, file: string) => ({
  fontFamily,
  fontDefinitions: [
    {
      path: `@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/${file}`,
      weight: 400,
    },
  ],
})

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
  name: process.env.APP_NAME ?? 'dev - Bible Strong',
  description: isCyberJudah
    ? 'CyberJudah Bible reading and study'
    : 'Bible strong for french people',
  slug: isCyberJudah ? 'cyberjudah' : 'bible-strong',
  scheme: isCyberJudah ? 'cyberjudah-staging' : 'biblestrong',
  primaryColor: '#ffffff',
  githubUrl: isCyberJudah
    ? 'https://github.com/DevSecObie/cyberjudah-app'
    : 'https://github.com/bulby97/bible-strong',
  platforms: ['ios', 'android', 'web'],
  version: APP_VERSION,
  orientation: 'default',
  icon: './assets/images/icon-2.png',
  userInterfaceStyle: 'automatic',

  android: {
    // The Google Play build sets its own, higher code on every run (cyberjudah-android-store.yml).
    versionCode: isCyberJudah ? Number(process.env.CYBERJUDAH_ANDROID_VERSION_CODE || 516) : 514,
    package: isCyberJudah ? 'io.cyberjudah.app' : 'com.smontlouis.biblestrong',
    googleServicesFile:
      process.env.ANDROID_GOOGLE_SERVICES_FILE ??
      (isCyberJudah
        ? 'firebase/cyberjudah/google-services.json'
        : 'firebase/dev/google-services.json'),
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
          host: isCyberJudah ? 'cyberjudah.io' : 'bible-strong.app',
          pathPrefix,
        })),
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  ios: {
    bundleIdentifier:
      process.env.BUNDLE_IDENTIFIER ??
      (isCyberJudah ? 'io.cyberjudah.app.dev' : 'com.smontlouis.biblestrong.dev'),
    appleTeamId: isCyberJudah ? process.env.CYBERJUDAH_APPLE_TEAM_ID : undefined,
    buildNumber: isCyberJudah ? '311' : '301',
    googleServicesFile:
      process.env.IOS_GOOGLE_SERVICES_FILE ??
      (isCyberJudah
        ? './firebase/cyberjudah/GoogleService-Info.plist'
        : './firebase/dev/GoogleService-Info.plist'),
    userInterfaceStyle: 'automatic',
    supportsTablet: true,
    infoPlist: {
      UIBackgroundModes: ['audio'],
      NSAppTransportSecurity: {
        ...(isCyberJudah
          ? {}
          : {
              NSExceptionDomains: {
                'timeline.biblehistory.com': { NSExceptionAllowsInsecureHTTPLoads: true },
              },
            }),
      },
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
    associatedDomains: [isCyberJudah ? 'applinks:cyberjudah.io' : 'applinks:bible-strong.app'],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/icon-2.png',
  },
  plugins: [
    ...(isCyberJudah ? ['./plugins/withCyberJudahBilling.js'] : []),
    'expo-sharing',
    // The web export splits each screen into its own file: as one file it passes Cloudflare's
    // 25 MB limit, and a phone browser would download every screen before showing the first.
    ['expo-router', { asyncRoutes: { web: true, default: false } }],
    'expo-asset',
    'expo-image',
    'expo-sqlite',
    [
      'expo-audio',
      {
        // App Review asks each permission to say what it is for.
        microphonePermission: isCyberJudah
          ? 'CyberJudah uses the microphone only while you hold the mic in Ask, to write down the question you speak.'
          : 'Allow $(PRODUCT_NAME) to access your microphone',
      },
    ],
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
          // The scheduler lifetime patch must be compiled into RN, not bypassed by its prebuilt core.
          ...(isCyberJudah ? { buildReactNativeFromSource: true } : {}),
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
          usesCleartextTraffic:
            !isCyberJudah || process.env.EAS_BUILD_PROFILE?.startsWith('development') === true,
          extraMavenRepos: ['../../node_modules/@notifee/react-native/android/libs'],
        },
      },
    ],
    [
      'expo-font',
      {
        fonts: ['./src/assets/fonts/LiterataBook-Regular.otf', './src/assets/fonts/Inter-Bold.ttf'],
        android: {
          fonts: [
            vectorIconFont('feather', 'Feather.ttf'),
            vectorIconFont('ionicons', 'Ionicons.ttf'),
          ],
        },
      },
    ],
    [
      'expo-document-picker',
      {
        iCloudContainerEnvironment: 'Production',
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: 'sevn-apps',
        project: 'bible-strong',
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
        imageWidth: 300,
        backgroundColor: '#ffffff',
        dark: {
          image: './assets/images/splash-dark.png',
          imageWidth: 300,
          backgroundColor: '#05070f',
        },
      },
    ],
    ['@react-native-google-signin/google-signin'],
    // Pages run under the navigation bar; the system scrim over its three-button form showed as a
    // band over the canvas. SystemBars styles the buttons with the theme instead.
    ['react-native-edge-to-edge', { android: { enforceNavigationBarContrast: false } }],
  ],
  extra: {
    resourceApiUrl: process.env.EXPO_PUBLIC_RESOURCE_API_URL,
    resourceArtifactBaseUrl: process.env.EXPO_PUBLIC_RESOURCE_ARTIFACT_BASE_URL,
    eas: {
      projectId: isCyberJudah ? CYBERJUDAH_EAS_PROJECT_ID : 'fdf72b90-346b-11e9-ad9a-255491359311',
    },
    ethern: {
      projectId: isCyberJudah ? undefined : 'ccb42b86-1286-4ca0-99bd-929b7ce418c1',
    },
  },
  // CyberJudah's testers get JS-only fixes over the air: downloaded in the background at launch
  // and applied on the next launch. Every update must be signed with the private key that pairs
  // with certs/certificate.pem; that key never enters this repository.
  // The CyberJudah Preview dev app loads unsigned code straight from Metro, so it takes no
  // over-the-air updates; the code-signing check would refuse every Metro bundle.
  updates: isCyberJudahPreview
    ? { enabled: false }
    : isCyberJudah
      ? {
          enabled: true,
          // Our own Open OTA server on Cloudflare, as Bible Strong does (docs/adr/0085): EAS Update's
          // free plan stops serving updates past 1,000 readers a month.
          url: 'https://updates.cyberjudah.io/manifest',
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
          codeSigningCertificate: './certs/certificate.pem',
          codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' },
          requestHeaders: {
            'expo-channel-name': process.env.EAS_BUILD_CHANNEL || 'staging',
          },
        }
      : {
          // Bible Strong's own update server (Open OTA on Cloudflare), see docs/adr/0085.
          url: 'https://updates.bible-strong.app/manifest',
          checkAutomatically: 'NEVER',
          // Only builds with a channel (staging, production) receive updates.
          ...(process.env.EAS_BUILD_CHANNEL && {
            codeSigningCertificate: './certs/certificate.pem',
            codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' },
          }),
          requestHeaders: {
            'expo-channel-name': process.env.EAS_BUILD_CHANNEL,
          },
        },
  experiments: {
    reactCompiler: true,
  },
  runtimeVersion: RUNTIME_VERSION,
})
