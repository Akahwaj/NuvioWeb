# iOS CI workflow (manual install required)

> **Note for maintainers:** the automation token used to open pull requests
> does **not** have the `workflow` OAuth scope, so this file could not be
> committed to `.github/workflows/`. To enable CI, copy the YAML below into
> `.github/workflows/ios.yml` on `main` yourself — a one-time manual step.

The workflow runs on a `macos-14` runner, generates the project with
XcodeGen, builds an **unsigned** `Release` `.app`, and packages it as a
zipped `.ipa` artifact suitable for sideloading (AltStore / Sideloadly /
Xcode with a free or paid Apple ID). No signing certificates or secrets are
required.

```yaml
name: iOS Build

on:
  push:
    branches: [main]
    paths:
      - 'ios/**'
      - '.github/workflows/ios.yml'
  pull_request:
    paths:
      - 'ios/**'
  workflow_dispatch:

jobs:
  build:
    name: Build unsigned AnimeWorld.ipa
    runs-on: macos-14
    defaults:
      run:
        working-directory: ios
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode_15.4.app/Contents/Developer

      - name: Install XcodeGen
        run: brew install xcodegen

      - name: Generate Xcode project
        run: xcodegen generate

      - name: Build (unsigned, device target)
        run: |
          xcodebuild \
            -project AnimeWorld.xcodeproj \
            -scheme AnimeWorld \
            -configuration Release \
            -destination 'generic/platform=iOS' \
            CODE_SIGNING_ALLOWED=NO \
            CODE_SIGNING_REQUIRED=NO \
            CODE_SIGN_IDENTITY="" \
            build

      - name: Package unsigned IPA
        run: |
          APP_PATH=$(find "$HOME/Library/Developer/Xcode/DerivedData" \
            -name 'AnimeWorld.app' -path '*Release-iphoneos*' | head -n 1)
          if [ -z "$APP_PATH" ]; then
            echo "::error::AnimeWorld.app not found in DerivedData"
            exit 1
          fi
          rm -rf Payload AnimeWorld-unsigned.ipa
          mkdir -p Payload
          cp -R "$APP_PATH" Payload/
          zip -qr AnimeWorld-unsigned.ipa Payload
          ls -lh AnimeWorld-unsigned.ipa

      - name: Upload IPA artifact
        uses: actions/upload-artifact@v4
        with:
          name: AnimeWorld-unsigned-ipa
          path: ios/AnimeWorld-unsigned.ipa
          retention-days: 14
```

## Notes

- The resulting IPA is **unsigned**. Users must sign it at install time
  (AltStore/Sideloadly handle this with their Apple ID), or a maintainer can
  re-sign it with `codesign`/`fastlane sigh` using a distribution
  certificate.
- To add signed builds later, import a distribution certificate + profile
  into the runner keychain (e.g. with `apple-actions/import-codesign-certs`)
  and drop the `CODE_SIGNING_*=NO` overrides.
