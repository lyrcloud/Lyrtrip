# Lyrtrip Android app

Capacitor shell around https://www.lyrtrip.com. The app loads the live site, so a frontend deploy updates the app without a new build. Native pieces: splash screen, status bar and an offline screen (`www/offline.html`).

App ID: `com.lyrtrip.app`. The site can detect the app by `LyrtripApp` in the user agent or `window.Capacitor`.

## Build

Needs JDK 21 and the Android SDK (API 36):

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ANDROID_HOME=~/Android/Sdk
npm install
npm run android:debug     # android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a phone or emulator with `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

## Icons

`node make-icons.mjs && npm run assets` regenerates `assets/` and the launcher icons from the map-pin mark in `../public/logo.png`.

## Known limits

- Google sign-in through the Cognito Hosted UI is blocked by Google inside WebViews (`disallowed_useragent`). Email/password works; Google needs a native sign-in plugin like Lyrshop's `GoogleSignInPlugin`.
- No release signing yet; this is a debug build for testing.
