#!/usr/bin/env bash
# Build the signed Android APK and publish it as www.lyrtrip.com's "Download for Android" file
# (/downloads/lyrtrip.apk), then update the version line on src/app/app/page.tsx.
# Usage: mobile/publish-apk.sh   (then publish the frontend so /app shows the new version line)
set -euo pipefail
cd "$(dirname "$0")"

BUCKET=s3://lyrtrip-website-hosting
DISTRIBUTIONS="E2MAYSXZB0XTQ1 E2T1R9OO63W8NI"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
JDK=/usr/lib/jvm/java-21-openjdk-amd64
[ -d "$JDK" ] && export JAVA_HOME="$JDK" PATH="$JDK/bin:$PATH"

npx cap sync android
(cd android && ./gradlew --quiet assembleRelease)

APK=android/app/build/outputs/apk/release/app-release.apk
APKSIGNER="$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -V | tail -1)apksigner"
"$APKSIGNER" verify "$APK"   # refuses an unsigned or broken build

VERSION="$(sed -n 's/.*versionName "\(.*\)".*/\1/p' android/app/build.gradle | head -1)"
SIZE="$(awk -v b="$(stat -c %s "$APK")" 'BEGIN { printf "%.1f MB", b / 1048576 }')"
cp "$APK" "$HOME/Desktop/Lyrtrip-$VERSION.apk" 2>/dev/null || true

# infra/deploy-site.sh leaves downloads/* alone when it syncs with --delete
aws s3 cp "$APK" "$BUCKET/downloads/lyrtrip.apk" --only-show-errors \
  --content-type application/vnd.android.package-archive \
  --content-disposition 'attachment; filename="lyrtrip.apk"' \
  --cache-control "public, max-age=300"
for d in $DISTRIBUTIONS; do
  aws cloudfront create-invalidation --distribution-id "$d" --paths "/downloads/lyrtrip.apk" >/dev/null
done

sed -i "s#data-app-meta>Version [^·]* · [^·]* · #data-app-meta>Version $VERSION · $SIZE · #" ../src/app/app/page.tsx
echo "Published Lyrtrip $VERSION ($SIZE) to https://www.lyrtrip.com/downloads/lyrtrip.apk"
echo "src/app/app/page.tsx now says version $VERSION; publish the frontend to show that line."
