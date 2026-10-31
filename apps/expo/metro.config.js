require('./scripts/generate-theme-css.cjs')
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const { withUniwindConfig } = require('uniwind/metro')

const config = getSentryExpoConfig(__dirname)

config.resolver = {
  ...config.resolver,
  assetExts: [
    ...config.resolver.assetExts,
    'db',
    'sqlite',
    'mp3',
    'ttf',
    'otf',
    'png',
    'jpg',
    'jpeg',
    'json',
    'txt',
    'html',
    'lottie',
  ],
}

// On web, tslib's ESM wrapper (tslib/modules) reads tslib.js as a default export, which is
// undefined once screens load as separate chunks ("Cannot destructure property '__extends'").
// Its plain ES module build has the same helpers without the wrapper.
const resolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'tslib')
    return { type: 'sourceFile', filePath: require.resolve('tslib/tslib.es6.js') }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform)
}

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      inlineRequires: true,
    },
  }),
}

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './src/uniwind-types.d.ts',
  extraThemes: ['default', 'sepia', 'nature', 'sunset', 'black', 'mauve', 'night'],
})
