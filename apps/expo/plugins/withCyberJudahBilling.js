const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins')

// A store verification app may temporarily background CyberJudah during checkout.
module.exports = config =>
  withAndroidManifest(config, result => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(result.modResults)
    activity.$['android:launchMode'] = 'singleTop'
    return result
  })
