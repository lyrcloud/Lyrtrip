import type { Metadata } from "next";
import "./globals.css";
import HotelSearch from "@/components/HotelSearch";

export const metadata: Metadata = {
  title: "Lyrtrip",
  description: "Music trip planning application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`}
          async
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

export function ToursPage() {
  return (
    <div>
      <h1>Find Hotels for Your Music Trip</h1>
      <HotelSearch query="hotels in Paris" lat={48.8566} lng={2.3522} />
    </div>
  );
}