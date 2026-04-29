import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfferPilot MVP",
  description: "A one-page job discovery and tailored resume generator MVP.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
