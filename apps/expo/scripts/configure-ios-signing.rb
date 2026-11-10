require 'json'
require 'xcodeproj'

signing = JSON.parse(File.read(ARGV.fetch(0)))
project_path = Dir.glob('apps/expo/ios/*.xcodeproj').fetch(0)
project = Xcodeproj::Project.open(project_path)
apps = project.targets.select { |target| target.product_type == 'com.apple.product-type.application' }
raise 'Expected exactly one staging app target' unless apps.length == 1
apps.first.build_configurations.each do |config|
  raise 'Unexpected bundle identifier' unless config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] == signing.fetch('bundle')
  config.build_settings['DEVELOPMENT_TEAM'] = signing.fetch('team')
  config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  config.build_settings['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = signing.fetch('uuid')
end
project.save
puts 'Configured the staging application target for manual distribution signing.'
