"""Reject unsafe or mismatched provisioning profiles before importing credentials."""
import copy
import datetime
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("signing", Path(__file__).with_name("prepare-ios-signing.py"))
signing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signing)


class ProfileValidationTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.datetime(2026, 10, 28)
        self.profile = {
            "TeamIdentifier": [signing.TEAM], "UUID": "staging-profile",
            "ExpirationDate": self.now + datetime.timedelta(days=30),
            "DeveloperCertificates": [b"certificate"],
            "Entitlements": {
                "application-identifier": f"{signing.TEAM}.{signing.BUNDLE}",
                "get-task-allow": False,
                "com.apple.developer.applesignin": ["Default"],
                "com.apple.developer.associated-domains": "*",
                "com.apple.developer.devicecheck.appattest-environment": ["development", "production"],
            },
        }

    def test_accepts_apple_profile_capability_allowlist(self):
        self.assertEqual(signing.validate(self.profile, self.now)["bundle"], signing.BUNDLE)

    def test_accepts_production_only_attestation(self):
        self.profile["Entitlements"]["com.apple.developer.devicecheck.appattest-environment"] = "production"
        signing.validate(self.profile, self.now)

    def test_rejects_unapproved_or_unusable_profiles(self):
        mutations = [
            ("TeamIdentifier", ["OTHERTEAM"]),
            ("ExpirationDate", self.now),
            ("ProvisionedDevices", ["test-device"]),
            ("ProvisionsAllDevices", True),
            ("DeveloperCertificates", []),
            ("UUID", ""),
        ]
        for key, value in mutations:
            with self.subTest(key=key):
                changed = copy.deepcopy(self.profile)
                changed[key] = value
                with self.assertRaises(ValueError):
                    signing.validate(changed, self.now)

    def test_rejects_wrong_bundle_or_missing_required_capabilities(self):
        mutations = [
            ("application-identifier", f"{signing.TEAM}.io.cyberjudah.app"),
            ("get-task-allow", True),
            ("com.apple.developer.applesignin", []),
            ("com.apple.developer.associated-domains", None),
            ("com.apple.developer.devicecheck.appattest-environment", ["development"]),
        ]
        for key, value in mutations:
            with self.subTest(key=key):
                changed = copy.deepcopy(self.profile)
                changed["Entitlements"][key] = value
                with self.assertRaises(ValueError):
                    signing.validate(changed, self.now)


if __name__ == "__main__":
    unittest.main()
