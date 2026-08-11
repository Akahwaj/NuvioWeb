# AnimeWorld — iOS App (WKWebView wrapper)

A thin native shell around the hosted AnimeWorld web app
(`https://akahwaj.github.io/`), built with `WKWebView`. Includes an offline
fallback to a bundled copy of the site (see `web/README.txt`).

## Requirements

- **macOS with Xcode 14+** — this project **cannot be compiled without macOS
  and Xcode**. There is no way around this on Linux/Windows.
- [XcodeGen](https://github.com/yonsm/XcodeGen) to generate the Xcode project.

## Build

```sh
cd ios
brew install xcodegen
xcodegen generate
open AnimeWorld.xcodeproj
```

The `.xcodeproj` is generated — do not edit or commit it; change
`project.yml` instead and re-run `xcodegen generate`.

Then select a simulator or your device and press **Run** (Cmd+R).

## Configuration

- Bundle ID: `com.akahwaj.animeworld`
- Deployment target: iOS 15.0, iPhone + iPad
- Hosted URL: single constant `HOSTED_URL` in
  `AnimeWorld/ViewController.swift`
- Offline bundle: copy the site's `dist/` output into `ios/web/`
- App icon: drop a 1024x1024 PNG into
  `AnimeWorld/Assets.xcassets/AppIcon.appiconset/` (see its README)

## Signing & distribution

### Free Apple ID (7-day sideload)
1. In Xcode: **Signing & Capabilities** → enable *Automatically manage
   signing* and pick your personal team.
2. Run on your own device — the profile expires after **7 days**, after
   which the app must be re-installed.
3. Alternatively use **AltStore** or **Sideloadly** with the unsigned IPA
   from CI (see `CI-WORKFLOW.md`) to sideload with a free account.

### Paid Apple Developer Program ($99/yr)
- 1-year provisioning profiles, proper device distribution.
- **TestFlight** for beta distribution to testers.

### App Store — read this first
App Store review of a thin web wrapper is **unlikely to pass**: App Review
Guideline **4.2 (Minimum Functionality)** rejects apps that are simply a
web site in a WebView without native features. **Sideloading is the
realistic distribution path** for this app; App Store submission would
require substantial native functionality first.

## Continuous integration

See `CI-WORKFLOW.md` for a ready-to-use GitHub Actions workflow (macos-14
runner: `xcodegen` + unsigned `xcodebuild`, zipped to an `.ipa` for
sideloading). A maintainer must copy it to `.github/workflows/ios.yml`
manually — the automation token used for PRs lacks the `workflow` scope.
