import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  Manrope,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { FONT_CSS_VARS } from "@/lib/branding";
import { readBranding } from "@/lib/branding.server";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await readBranding();
  return {
    title: `${branding.name} — ${branding.tagline}`,
    description: branding.description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await readBranding();
  const fontVar =
    FONT_CSS_VARS[branding.fontFamily] ?? FONT_CSS_VARS.geist;
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${manrope.variable} ${spaceGrotesk.variable} font-sans antialiased`}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--brand:${branding.brandColor};--ink:${branding.inkColor};--panel:${branding.panelColor};--edge:${branding.edgeColor};--text:${branding.textColor};--ui-font-sans:var(${fontVar})}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
