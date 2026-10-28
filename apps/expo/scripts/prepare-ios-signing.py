"""Validate the downloaded staging profile and prepare local-only Xcode export settings."""
import datetime
import json
from pathlib import Path
import plistlib
import sys

TEAM = "M8DUMWBXLH"
BUNDLE = "io.cyberjudah.app.dev"


def validate(profile, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    entitlements = profile.get("Entitlements", {})
    if profile.get("TeamIdentifier") != [TEAM]:
        raise ValueError("Profile belongs to a different Apple team")
    if entitlements.get("application-identifier") != f"{TEAM}.{BUNDLE}":
        raise ValueError("Profile is not for the CyberJudah staging app")
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
    return {"uuid": profile["UUID"], "team": TEAM, "bundle": BUNDLE}


if __name__ == "__main__":
    profile = plistlib.loads(Path(sys.argv[1]).read_bytes())
    validated = validate(profile)
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    (output / "signing.json").write_text(json.dumps(validated))
    (output / "ExportOptions.plist").write_bytes(plistlib.dumps({
        "method": "app-store-connect", "destination": "export",
        "teamID": TEAM, "signingStyle": "manual",
        "signingCertificate": "Apple Distribution",
        "provisioningProfiles": {BUNDLE: validated["uuid"]},
        "manageAppVersionAndBuildNumber": False, "uploadSymbols": False,
    }))
    print("Validated CyberJudah staging distribution profile; export will not upload.")
