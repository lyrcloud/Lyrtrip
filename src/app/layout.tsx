import type { Metadata } from "next";
import "./globals.css";
import HotelSearch from "@/components/HotelSearch";
import Footer from "@/components/Footer";
import Lyrbot from "@/components/Lyrbot";
import Navigation from "@/components/Navigation";
import { AuthProvider } from "@/context/AuthContext";

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export const metadata: Metadata = {
  title: "Lyrtrip",
  description: "Get in Lyrtrip",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {googleMapsApiKey ? (
          <script
            src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&loading=async`}
            async
          />
        ) : null}
        <script src="https://accounts.google.com/gsi/client" async defer />
      </head>
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          <Navigation />
          <div className="flex-1 flex flex-col">{children}</div>
          <Footer />
          <Lyrbot />
        </AuthProvider>
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
