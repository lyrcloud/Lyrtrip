import { AlreadyInApp } from "@/components/AppBanner";

export const metadata = {
  title: "Get the Lyrtrip app | Lyrtrip",
  description: "Download the Lyrtrip app for Android: flights, hotels, rides, courier and trips in your pocket.",
  alternates: { canonical: "/app" },
};

// mobile/publish-apk.sh uploads the signed APK to this path and rewrites the version line below
const APK_URL = "/downloads/lyrtrip.apk";

export default function GetTheAppPage() {
  return (
    <div className="flex-1 bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={64} height={64} className="rounded-2xl border border-gray-200" />
          <h1 className="text-3xl font-bold text-gray-900">Get the Lyrtrip app</h1>
        </div>
        <p className="text-gray-700 leading-relaxed mb-6">
          Plan and book on your phone: flights, hotels, rides, courier and your trips always with you, with
          booking updates and check-in reminders.
        </p>

        <a
          href={APK_URL}
          download="lyrtrip.apk"
          className="inline-block rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Download for Android
        </a>
        <p className="mt-2 text-sm text-gray-500" data-app-meta>Version 1.4 · 4.5 MB · Android 7.0 or newer</p>

        <AlreadyInApp />

        <h2 className="text-xl font-bold text-gray-900 mt-10 mb-3">How to install</h2>
        <ol className="list-decimal pl-6 space-y-2 text-gray-700">
          <li>Tap <strong>Download for Android</strong> above.</li>
          <li>Open the downloaded <strong>lyrtrip.apk</strong> from your notifications or Downloads.</li>
          <li>If Android asks, allow your browser to <strong>install unknown apps</strong>, then tap <strong>Install</strong>.</li>
          <li>Open Lyrtrip and sign in with the same account you use here.</li>
        </ol>
        <p className="mt-6 text-gray-700 leading-relaxed">
          The app is coming to Google Play soon. The iPhone app is on its way; until then, iPhone travellers can
          tap Share, then <strong>Add to Home Screen</strong> in Safari.
        </p>
      </div>
    </div>
  );
}
