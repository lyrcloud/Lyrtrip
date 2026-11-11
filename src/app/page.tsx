import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const SERVICES: { title: string; text: string }[] = [
  {
    title: "Flights",
    text: "Search fares from hundreds of airlines, compare stops, times and baggage, then book and pay securely on Lyrtrip.",
  },
  {
    title: "Hotels and vacation rentals",
    text: "Compare hotel prices across booking sites and send us a booking request for the stay you want. Our team confirms the room before you are charged.",
  },
  {
    title: "Rides, couriers and food",
    text: "See ride estimates near you, send a same-day courier across town, or order restaurant and grocery delivery, all from the same app.",
  },
  {
    title: "Shipping and freight",
    text: "Get instant quotes for parcels shipped worldwide, print your label and follow tracking updates. Larger loads? Request a truck, cargo or container quote.",
  },
  {
    title: "Tours, events and charters",
    text: "Request guided tours and pilgrimages, buy tickets for concerts and events, or charter a helicopter, seaplane or air ambulance.",
  },
  {
    title: "Rewards",
    text: "Earn points on every booking, climb membership tiers, and spend points, gift cards and coupons on your next trip.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "What can I book on Lyrtrip?",
    a: "Flights, hotels and vacation rentals, courier and food delivery, parcel shipping, freight, tours, event tickets and air charters. You can also apply for jobs and study programs abroad.",
  },
  {
    q: "Can I pay in my own currency?",
    a: "Yes. Lyrtrip shows prices in your local currency and language, and you pay by card at checkout.",
  },
  {
    q: "How do I get help with a booking?",
    a: "Chat with Lyrbot on any page, message us on WhatsApp at +1 661 580 9465, or email support@lyrtrip.com.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Lyrtrip",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      email: "support@lyrtrip.com",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "support@lyrtrip.com",
        telephone: "+1-661-580-9465",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Lyrtrip",
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeClient />
      <section aria-labelledby="about-lyrtrip" className="bg-white border-t border-gray-100">
        <div className="mx-auto max-w-screen-xl px-4 py-14 sm:px-6 lg:px-10">
          <h2 id="about-lyrtrip" className="text-2xl font-bold text-gray-900">
            Your whole trip, one app
          </h2>
          <p className="mt-3 max-w-3xl text-gray-600">
            Lyrtrip brings the travel and delivery services you need into one place. Plan a trip, book it, get
            around when you land and send things home, without juggling a different app for every step. Prices
            are shown in your currency and language wherever you are.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.title}>
                <h3 className="font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{s.text}</p>
              </div>
            ))}
          </div>
          <h2 className="mt-12 text-2xl font-bold text-gray-900">Frequently asked questions</h2>
          <dl className="mt-4 max-w-3xl space-y-4">
            {FAQ.map(({ q, a }) => (
              <div key={q}>
                <dt className="font-semibold text-gray-900">{q}</dt>
                <dd className="mt-1 text-sm text-gray-600">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
