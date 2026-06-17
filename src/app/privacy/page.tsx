export const metadata = {
  title: "Privacy Policy | Lyrtrip",
  description: "How Lyrtrip collects, uses, and protects your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: June 16, 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Overview</h2>
            <p>
              Lyrtrip (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides music trip
              planning and travel search tools at www.lyrtrip.com (the &quot;Service&quot;).
              This Privacy Policy explains what information we collect, how we use it,
              and the choices you have.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <span className="font-semibold">Account information:</span> name, email
                address, and profile identifier when you sign up or sign in, including via
                Google, Facebook, or WeChat login.
              </li>
              <li>
                <span className="font-semibold">Location data:</span> if you grant
                permission, your device location or addresses you search/select, used to
                show nearby results on the map.
              </li>
              <li>
                <span className="font-semibold">Trip and search data:</span> destinations,
                dates, and search criteria you enter to use the Service.
              </li>
              <li>
                <span className="font-semibold">Usage data:</span> standard technical logs
                (e.g. browser type, pages visited) used to operate and improve the
                Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Information</h2>
            <p>We use the information above to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Create and authenticate your account</li>
              <li>Provide search results and location-based features</li>
              <li>Maintain, secure, and improve the Service</li>
              <li>Communicate with you about your account or the Service</li>
            </ul>
            <p className="mt-2">We do not sell your personal information.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Third-Party Services</h2>
            <p>We rely on the following third parties to operate the Service:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <span className="font-semibold">AWS Cognito</span> &mdash; account
                authentication, including Google, Facebook, and WeChat sign-in.
              </li>
              <li>
                <span className="font-semibold">Google Maps Platform</span> &mdash; maps,
                geocoding, and location search.
              </li>
              <li>
                <span className="font-semibold">Facebook / Meta, Google, and WeChat
                login</span> &mdash; if you choose to sign in with one of these providers,
                they share basic profile information (such as name and email) with us as
                permitted by your settings with that provider.
              </li>
            </ul>
            <p className="mt-2">
              Each provider&apos;s use of your information is governed by their own
              privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Retention</h2>
            <p>
              We retain account and trip data for as long as your account is active, or
              as needed to provide the Service. You may request deletion at any time
              &mdash; see our{" "}
              <a href="/data-deletion" className="text-indigo-600 hover:underline">
                Data Deletion Instructions
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Your Choices</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You can disable location permissions in your browser or device at any time.</li>
              <li>You can unlink a social login provider from your account settings.</li>
              <li>
                You can request access to, correction of, or deletion of your data by
                contacting us (see Section 8).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed to children under 13, and we do not knowingly
              collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Contact Us</h2>
            <p>
              Questions about this policy or your data can be sent to{" "}
              <a href="mailto:privacy@lyrtrip.com" className="text-indigo-600 hover:underline">
                privacy@lyrtrip.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will
              be reflected by updating the &quot;Last updated&quot; date above.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
