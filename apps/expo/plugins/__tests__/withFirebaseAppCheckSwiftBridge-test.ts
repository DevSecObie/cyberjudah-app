const { normalizeFirebaseInitialization } = require('../withFirebaseAppCheckSwiftBridge')

const legacy = `class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?
  func application() {
    reactNativeFactory = factory
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    RNFBAppCheckModule.sharedInstance()
    FirebaseApp.configure()
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)
#endif
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`

describe('Expo scene startup with Firebase App Check', () => {
  it('lets the installed Expo scene delegate start React Native and preserves App Check initialization order', () => {
    const result = normalizeFirebaseInitialization(legacy)
    expect(result).toContain('ExpoAppDelegate, ExpoReactNativeFactoryProvider')
    expect(result).not.toContain('window = UIWindow(')
    expect(result).not.toContain('factory.startReactNative(')
    expect(result.indexOf('reactNativeFactory = factory')).toBeLessThan(
      result.indexOf('RNFBAppCheckModule.sharedInstance()')
    )
    expect(result.indexOf('RNFBAppCheckModule.sharedInstance()')).toBeLessThan(
      result.indexOf('FirebaseApp.configure()')
    )
    expect(result.indexOf('FirebaseApp.configure()')).toBeLessThan(
      result.indexOf('return super.application')
    )
    expect(normalizeFirebaseInitialization(result)).toBe(result)
  })
  it('fails when the Expo factory startup anchor is missing', () => {
    expect(() => normalizeFirebaseInitialization('class AppDelegate {}')).toThrow(
      'FIREBASE_APP_CHECK_SWIFT_INITIALIZATION_POINT_MISSING'
    )
  })
})
