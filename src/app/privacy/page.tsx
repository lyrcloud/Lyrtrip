export const metadata = {
  title: "Privacy Policy | Lyrtrip",
  description: "How Lyrtrip collects, uses, and protects your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="flex-1 bg-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: September 30, 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Overview</h2>
            <p>
              Lyrtrip (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides music trip
              planning, travel search, and booking tools at www.lyrtrip.com (the
              &quot;Service&quot;), including hotel and flight search and booking, ride
              fare estimates, same-day courier delivery, and parcel shipping. This Privacy
              Policy explains what information we collect, how we use and share it, and
              the choices you have.
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
                <span className="font-semibold">Traveler and booking details:</span> when
                you book a flight or hotel, the details needed to make the reservation for
                each traveler, such as title, given and family name, date of birth,
                gender, nationality, email address, and phone number, along with your
                itinerary, dates, and booking references.
              </li>
              <li>
                <span className="font-semibold">Payment information:</span> payments are
                processed by Stripe. Your card details are entered on Stripe&apos;s
                checkout page and are not received or stored by Lyrtrip. We receive
                payment status, amount, and a transaction reference.
              </li>
              <li>
                <span className="font-semibold">Order and ride details:</span> items,
                pickup and drop-off addresses, and ride type you select when placing an
                order or booking a ride.
              </li>
              <li>
                <span className="font-semibold">Location data:</span> if you grant
                permission, your device location, and addresses you search for or select,
                used to show nearby results on the map and prefill pickup locations.
              </li>
              <li>
                <span className="font-semibold">Trip and search data:</span> destinations,
                dates, and search criteria you enter to use the Service.
              </li>
              <li>
                <span className="font-semibold">Usage data:</span> standard technical logs
                (e.g. IP address, browser type, pages visited, errors) used to operate,
                secure, and improve the Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Information</h2>
            <p>We use the information above to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Create and authenticate your account</li>
              <li>Provide search results and location-based features</li>
              <li>Make, confirm, change, cancel, and refund bookings and orders you request</li>
              <li>Send booking confirmations and service-related emails</li>
              <li>Detect and prevent fraud and abuse, and keep the Service secure</li>
              <li>Maintain and improve the Service</li>
              <li>Comply with legal, tax, and accounting obligations</li>
            </ul>
            <p className="mt-2">
              We do not sell your personal information, and we do not use it for
              third-party advertising.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. How We Share Information</h2>
            <p>
              We share personal information only as needed to provide the Service, with:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <span className="font-semibold">Travel suppliers and booking
                platforms</span> &mdash; including Duffel and Amadeus, and
                the airlines and hotels they connect to. Traveler details are passed to
                them to create your reservation, and they may be required to share them
                with government authorities (for example, for airline security or
                immigration checks).
              </li>
              <li>
                <span className="font-semibold">Stripe</span> &mdash; payment processing
                and refunds.
              </li>
              <li>
                <span className="font-semibold">Courier and shipping partners</span> &mdash; when
                you book a courier delivery or buy a shipping label, the pickup and delivery
                names, addresses, phone numbers and item details are shared with the courier
                or carrier that carries it.
              </li>
              <li>
                <span className="font-semibold">Amazon Web Services (AWS)</span> &mdash;
                hosting, backend processing, account authentication (Amazon Cognito), and
                transactional email delivery (Amazon SES).
              </li>
              <li>
                <span className="font-semibold">Google Maps Platform</span> &mdash; maps,
                geocoding, and location search.
              </li>
              <li>
                <span className="font-semibold">Google, Facebook / Meta, and WeChat</span>{" "}
                &mdash; if you choose to sign in with one of these providers, they share
                basic profile information (such as name and email) with us as permitted by
                your settings with that provider.
              </li>
              <li>
                <span className="font-semibold">Legal and safety</span> &mdash; when
                required by law, or to protect the rights, property, or safety of
                Lyrtrip, our users, or others.
              </li>
            </ul>
            <p className="mt-2">
              Each provider&apos;s use of your information is governed by its own
              privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Cookies and Browser Storage</h2>
            <p>
              We do not use advertising or third-party tracking cookies. We use your
              browser&apos;s local and session storage to keep you signed in, protect
              the sign-in process, remember a referral link you opened, and keep a record
              of bookings made on that device. You can clear this data at any time
              through your browser settings; doing so will sign you out. Third-party
              services such as Google Maps and Stripe checkout may set their own cookies
              when you use them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Data Retention</h2>
            <p>
              We retain account and trip data for as long as your account is active, or
              as needed to provide the Service. Booking and payment records may be kept
              longer where required for legal, tax, accounting, or dispute purposes.
              You may request deletion at any time &mdash; see our{" "}
              <a href="/data-deletion" className="text-brand-600 hover:underline">
                Data Deletion Instructions
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Security</h2>
            <p>
              We use industry-standard measures to protect your information, including
              encrypted (HTTPS) connections and access-controlled cloud infrastructure.
              No method of transmission or storage is completely secure, so we cannot
              guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. International Transfers</h2>
            <p>
              Lyrtrip and its service providers may process your information in
              countries other than your own, including the United States. When you book
              international travel, your details are necessarily shared with suppliers
              and authorities in the countries involved.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Your Choices and Rights</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You can disable location permissions in your browser or device at any time.</li>
              <li>
                You can revoke Google, Facebook, or WeChat access from that provider&apos;s
                account settings.
              </li>
              <li>
                Depending on where you live, you may have the right to access, correct,
                delete, or receive a copy of your personal information, or to object to
                certain processing. To make a request, contact us (see Section 11).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed to children under 13, and we do not knowingly
              collect personal information from children under 13, except traveler
              details for a minor provided by a parent or guardian making a booking on
              their behalf.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Contact Us</h2>
            <p>
              Questions about this policy or your data can be sent to{" "}
              <a href="mailto:privacy@lyrtrip.com" className="text-brand-600 hover:underline">
                privacy@lyrtrip.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">12. Changes to This Policy</h2>
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
