// Release assertion for the exact stable provider selected by RCTReactNativeFactory.
// Compile against the installed (patched) React Native headers, not a test double.
#include <react/featureflags/ReactNativeFeatureFlagsOverridesOSSStable.h>
#include <cstdio>

int main() {
  facebook::react::ReactNativeFeatureFlagsOverridesOSSStable flags;
  if (!flags.enableSchedulerDelegateInvalidation()) {
    std::fputs("Missing native scheduler delegate lifetime guard\n", stderr);
    return 1;
  }
  std::puts("Stable React Native scheduler delegate lifetime guard is enabled");
  return 0;
}
