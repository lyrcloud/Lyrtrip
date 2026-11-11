import type { Metadata } from "next";
import "./globals.css";
import HotelSearch from "@/components/HotelSearch";
import Footer from "@/components/Footer";
import Lyrbot from "@/components/Lyrbot";
import Navigation from "@/components/Navigation";
import { BottomNav, SideNav } from "@/components/AppNav";
import { AuthProvider } from "@/context/AuthContext";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { SITE_URL } from "@/lib/site";

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const SITE_TITLE = "Lyrtrip – Book Flights, Hotels, Rides & Tours";
const SITE_DESCRIPTION =
  "Search and book flights, compare hotels, send parcels, get rides and book tours, charters and event tickets – all in one travel app, in your own currency.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Lyrtrip",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Lyrtrip – flights, hotels, rides, tours, shipping" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {googleMapsApiKey ? (
          <script
            src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&loading=async`}
            async
          />
        ) : null}
        <script src="https://accounts.google.com/gsi/client" async defer />
        {/* Apply a collapsed side panel before the first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("lyrtrip:rail")==="slim")document.documentElement.dataset.rail="slim"}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <LocaleProvider>
          <AuthProvider>
            <Navigation />
            <SideNav />
            <div className="flex-1 flex flex-col ps-[var(--rail-w)] pb-[var(--bottom-bar-h)] transition-[padding] duration-200 print:p-0">
              <div className="flex-1 flex flex-col">{children}</div>
              <Footer />
            </div>
            <BottomNav />
            <Lyrbot />
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

export function ToursPage() {
  return (
    <div>
      <h1>Find Hotels for Your Music Trip</h1>
      <HotelSearch lat={48.8566} lng={2.3522} />
    </div>
  );
}
