import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap" });
import Nav from "@/components/Nav";
import BottomNav from "@/components/BottomNav";
import MobileHeader from "@/components/MobileHeader";
import { AuthProvider } from "@/components/AuthProvider";
import FontSizeProvider from "@/components/FontSizeProvider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Rzodkiewkowo",
  description: "Zarządzanie foliami i zbiorami",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Rzodkiewkowo" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16a34a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className={`${inter.className} min-h-screen bg-gray-50 antialiased`}>
        <FontSizeProvider>
          <AuthProvider>
            <Nav />
            <MobileHeader />
            <main className="max-w-5xl mx-auto px-4 pt-4 pb-24 md:pt-6 md:pb-8">
              {children}
            </main>
            <BottomNav />
          </AuthProvider>
        </FontSizeProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}


