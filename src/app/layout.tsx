import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Гоё пицца - Хүргэлтийн үйлчилгээ",
  description: "Орон сууцны хүргэлтийн үйлчилгээ - Амттай пицца хүргэж өгнө",
};

const TempoInit = dynamic(
  () => import("./client-components").then((mod) => mod.TempoInit),
  { ssr: false },
);

const DebugPanel = dynamic(() => import("../components/DebugPanel"), {
  ssr: false,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <Script src="https://api.tempolabs.ai/proxy-asset?url=https://storage.googleapis.com/tempo-public-assets/error-handling.js" />
      <body className={inter.className}>
        {children}
        <TempoInit />
        <DebugPanel />
      </body>
    </html>
  );
}
