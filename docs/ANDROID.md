# AnimeWorld Android Bootstrap APK

A thin native WebView wrapper that loads the hosted AnimeWorld web app so
updates are instant, with the built `dist/` bundle as an offline fallback.
One APK installs on Android phones, tablets, Android TV, and Fire TV.

## How it works

- `MainActivity` loads the hosted URL from `BuildConfig.HOSTED_URL`
  (default `https://akahwaj.github.io/NuvioWeb/`). To change it, edit the
  single `buildConfigField "String", "HOSTED_URL", ...` line in
  `android/app/build.gradle`.
- If the hosted page fails to load (offline / network error), the app falls
  back to `file:///android_asset/app/index.html`.
- To bundle an offline copy, run `node ./scripts/build.mjs` and copy the
  contents of `dist/` into `android/app/src/main/assets/app/` before building.
- TV support: both `LAUNCHER` and `LEANBACK_LAUNCHER` intent filters,
  touchscreen not required, D-pad navigable, back button walks WebView
  history, screen kept on during playback.

Requirements: `applicationId` `com.akahwaj.animeworld`, minSdk 24
(Android 7.0+), targetSdk 34.

## Build

### GitHub Actions (no local setup needed)

The workflow `.github/workflows/android-apk.yml` builds the debug APK on every
push to this branch and via **Actions → Android Bootstrap APK → Run
workflow**. Download the `animeworld-bootstrap-debug.apk` artifact from the
workflow run page.

> Note: if the workflow file is not yet present, see
> `docs/ANDROID-WORKFLOW.md` for the exact YAML to commit (the automation
> token used to author this branch lacked the `workflow` OAuth scope required
> to create files under `.github/workflows/`).

### Local

Requires JDK 17 and Android SDK (or Android Studio).

```sh
cd android
gradle wrapper --gradle-version 8.9   # once, if gradle-wrapper.jar is missing
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

The debug APK is signed with the Android debug keystore automatically — no
secrets or release keys required.

## Install

### Phone / tablet

1. Transfer the APK to the device (download, USB, cloud drive).
2. Allow "Install unknown apps" for your file manager/browser when prompted.
3. Open the APK and install.

Or via adb:

```sh
adb install -r animeworld-bootstrap-debug.apk
```

### Android TV / Fire TV (Downloader app)

1. On the TV, install the **Downloader** app (by AFTVnews) from the store.
2. Enable **Settings → My Fire TV → Developer Options → Install unknown apps →
   Downloader** (Fire TV), or the equivalent on Android TV.
3. Host the APK anywhere reachable (e.g. GitHub Actions artifact direct link
   or a short URL) and enter the URL in Downloader to install.

### Android TV / Fire TV (adb over network)

```sh
# Enable Developer Options + Network/USB debugging on the TV first
adb connect <tv-ip-address>:5555
adb install -r animeworld-bootstrap-debug.apk
```

The app appears in the TV launcher (leanback) as **AnimeWorld**.

## License

AnimeWorld is a fork of NuvioWeb by NuvioMedia
(https://github.com/NuvioMedia/NuvioWeb), licensed GPL-3.0. See LICENSE and
NOTICE.
