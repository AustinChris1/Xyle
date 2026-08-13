import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { LiveRibbon } from "@/components/LiveRibbon";
import { PageShell } from "@/components/PageShell";
import { WalletProviders } from "@/components/WalletProviders";
import "./globals.css";

const display = Instrument_Sans({
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Xyle",
    template: "%s | Xyle",
  },
  description:
    "Xyle is a verification oracle. Give it a claim and four independent miners check the evidence, score it for authenticity, and return a verdict with on-chain receipts, or refuse when the evidence does not hold.",
  openGraph: {
    title: "Xyle",
    description:
      "Give Xyle a claim. Four independent miners check it and return a receipted verdict, or refuse when the evidence does not hold.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f7" },
    { media: "(prefers-color-scheme: dark)", color: "#08070d" },
  ],
};

/** Runs before first paint so the theme never flashes. */
const themeScript = `(function(){try{var s=localStorage.getItem("xyle-theme");var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <WalletProviders>
          <Nav />
          <LiveRibbon />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
            <PageShell>{children}</PageShell>
          </main>
          <Footer />
        </WalletProviders>
      </body>
    </html>
  );
}
