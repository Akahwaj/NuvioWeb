OFFLINE WEB BUNDLE PLACEHOLDER
==============================

Drop the built web app (the contents of the site's dist/ folder) into this
directory so the app can run in offline mode.

Expected layout after copying:

    ios/web/index.html
    ios/web/js/...
    ios/web/css/...
    ios/web/assets/...

The folder is added to the Xcode project as a folder reference (see
ios/project.yml), so its structure is preserved inside the app bundle.
At runtime the app loads https://akahwaj.github.io/ first and falls back to
web/index.html via loadFileURL when the hosted site cannot be reached.

Without a bundle here, offline mode shows a simple "unavailable" message.
