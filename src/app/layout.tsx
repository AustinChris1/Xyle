import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { Aurora } from "@/components/Aurora";
import { Nav } from "@/components/Nav";
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
    default: "Signal Arena",
    template: "%s | Signal Arena",
  },
  description:
    "Prediction markets that settle on verified evidence. Every resolution is a paid, receipted call to live Telegraph miners.",
  openGraph: {
    title: "Signal Arena",
    description:
      "Prediction markets that settle on verified evidence, not on a moderator clicking resolve.",
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
const themeScript = `(function(){try{var s=localStorage.getItem("signal-arena-theme");var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

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
        <Aurora />
        <WalletProviders>
          <Nav />
          <LiveRibbon />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
            <PageShell>{children}</PageShell>
          </main>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-center font-mono text-[11px] text-muted sm:flex-row sm:text-left">
              <span>Signal Arena</span>
              <span>
                Settled by live Telegraph miners, paid per call with x402
              </span>
              <a
                href="https://hackathon.telegraphprotocol.com"
                className="text-copper transition-colors hover:text-copper-hot"
                target="_blank"
                rel="noreferrer"
              >
                Telegraph Hackathon
              </a>
            </div>
          </footer>
        </WalletProviders>
      </body>
    </html>
  );
}
