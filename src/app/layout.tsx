import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "AntreSehat", template: "%s · AntreSehat" },
  description: "Booking dan antrean klinik online yang realtime.",
};

export const viewport: Viewport = { themeColor: "#eceef1" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-dvh antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
          <p className="border-t border-border pt-6 text-xs text-muted-foreground">
            Demo portofolio — data fiktif, bukan untuk penggunaan medis.
          </p>
        </footer>
        <Toaster position="top-center" theme="light" />
      </body>
    </html>
  );
}
