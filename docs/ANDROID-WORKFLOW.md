# Android Bootstrap APK (workflow install note)

The GitHub Actions workflow for building the debug APK must live at
`.github/workflows/android-apk.yml`. It could not be pushed via the API token
used by automation (missing `workflow` scope), so create that file manually
with the contents below (identical to `android-apk.yml` at the repo root of
this branch):

```yaml
name: Android Bootstrap APK

on:
  push:
    branches:
      - feat/android-bootstrap
  workflow_dispatch:

jobs:
  build-debug-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up JDK 17 (Temurin)
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Set up Gradle
        uses: gradle/actions/setup-gradle@v4

      # gradle-wrapper.jar is not committed (binary), so generate the wrapper
      # using the Gradle provided by setup-gradle, then use it for the build.
      - name: Generate Gradle wrapper
        working-directory: android
        run: gradle wrapper --gradle-version 8.9 --distribution-type bin

      - name: Build debug APK
        working-directory: android
        run: ./gradlew --no-daemon assembleDebug

      - name: Rename APK
        run: cp android/app/build/outputs/apk/debug/app-debug.apk animeworld-bootstrap-debug.apk

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: animeworld-bootstrap-debug.apk
          path: animeworld-bootstrap-debug.apk
```
