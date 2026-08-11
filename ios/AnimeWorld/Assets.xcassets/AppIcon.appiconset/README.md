# App Icon

Drop a single **1024x1024 px PNG** named `AppIcon-1024.png` into this folder
(`ios/AnimeWorld/Assets.xcassets/AppIcon.appiconset/`).

Xcode's single-size app icon format (Xcode 14+) will generate every required
size from that one image at build time. No other changes are needed —
`Contents.json` already references the filename above.

Until a real icon is added, you can either:
- delete the `filename` entry from `Contents.json` to build with the default
  blank icon, or
- export the web app's logo (`assets/` in the repo root) as a 1024px PNG.
