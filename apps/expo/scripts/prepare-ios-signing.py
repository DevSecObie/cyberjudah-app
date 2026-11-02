"""Validate the downloaded staging or production profile and prepare local-only Xcode export settings."""
import datetime
import os
import json
from pathlib import Path
import plistlib
import sys

TEAM = "M8DUMWBXLH"
# Only these two applications are ever signed: the beta (staging servers) and the store app.
APPS = {"staging": "io.cyberjudah.app.dev", "production": "io.cyberjudah.app"}
BUNDLE = APPS["staging"]


def validate(profile, now=None, bundle=BUNDLE):
    now = now or datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    entitlements = profile.get("Entitlements", {})
    if profile.get("TeamIdentifier") != [TEAM]:
        raise ValueError("Profile belongs to a different Apple team")
    if bundle not in APPS.values():
        raise ValueError("Unknown CyberJudah application")
    if entitlements.get("application-identifier") != f"{TEAM}.{bundle}":
        raise ValueError(f"Profile is not for {bundle}")
    if profile.get("ExpirationDate", now) <= now:
        raise ValueError("Provisioning profile expired")
    if entitlements.get("get-task-allow") is not False or "ProvisionedDevices" in profile or profile.get("ProvisionsAllDevices"):
        raise ValueError("Expected an App Store distribution profile")
    if "Default" not in entitlements.get("com.apple.developer.applesignin", []):
        raise ValueError("Profile is missing Sign in with Apple")
    if not entitlements.get("com.apple.developer.associated-domains"):
        raise ValueError("Profile is missing Associated Domains")
    attest = entitlements.get("com.apple.developer.devicecheck.appattest-environment")
    # Apple profiles may authorize multiple environments; the app requests production.
    if attest != "production" and not (isinstance(attest, list) and "production" in attest):
        raise ValueError("Profile is missing production App Attest")
    if not profile.get("UUID") or not profile.get("DeveloperCertificates"):
        raise ValueError("Profile has no signing certificate or identity")
    return {"uuid": profile["UUID"], "team": TEAM, "bundle": bundle}


if __name__ == "__main__":
    target = os.environ.get("CYBERJUDAH_IOS_TARGET", "staging")
    if target not in APPS:
        raise SystemExit("CYBERJUDAH_IOS_TARGET must be staging or production")
    profile = plistlib.loads(Path(sys.argv[1]).read_bytes())
    validated = validate(profile, bundle=APPS[target])
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    (output / "signing.json").write_text(json.dumps(validated))
    (output / "ExportOptions.plist").write_bytes(plistlib.dumps({
        "method": "app-store-connect", "destination": "export",
        "teamID": TEAM, "signingStyle": "manual",
        "signingCertificate": "Apple Distribution",
        "provisioningProfiles": {validated["bundle"]: validated["uuid"]},
        "manageAppVersionAndBuildNumber": False, "uploadSymbols": False,
    }))
    print(f"Validated CyberJudah {target} distribution profile; export will not upload.")
