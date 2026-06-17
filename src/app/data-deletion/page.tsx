export const metadata = {
  title: "Data Deletion Instructions | Lyrtrip",
  description: "How to request deletion of your Lyrtrip account and data.",
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Deletion Instructions</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: June 16, 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <p>
              You can request deletion of your Lyrtrip account and all associated
              personal data at any time, whether you signed up directly or via Google,
              Facebook, or WeChat login.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">How to Request Deletion</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                Send an email to{" "}
                <a
                  href="mailto:privacy@lyrtrip.com?subject=Data%20Deletion%20Request"
                  className="text-indigo-600 hover:underline"
                >
                  privacy@lyrtrip.com
                </a>{" "}
                from the email address associated with your account, with the subject
                line &quot;Data Deletion Request&quot;.
              </li>
              <li>
                Include the email or account name you used to sign in, and if you signed
                in via a third party (Google, Facebook, or WeChat), let us know which
                one.
              </li>
              <li>
                We will verify the request and delete your account and associated
                personal data within 30 days, except where we are required to retain
                certain records by law.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">What Gets Deleted</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your account profile and login identifiers</li>
              <li>Saved trips, searches, and location data tied to your account</li>
              <li>Any third-party login linkage (Google, Facebook, WeChat) stored by us</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Revoking Facebook Login Access</h2>
            <p>
              If you signed in with Facebook, you can also remove Lyrtrip&apos;s access
              directly from your Facebook account at any time via Facebook Settings
              &rarr; Apps and Websites. This revokes Lyrtrip&apos;s access to your
              Facebook data; for full deletion of data already stored by Lyrtrip, please
              also follow the steps above.
            </p>
          </section>

          <section>
            <p>
              See also our{" "}
              <a href="/privacy" className="text-indigo-600 hover:underline">
                Privacy Policy
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
