import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "GPX Summit Poster Generator",
    template: "%s · GPX Summit Poster",
  },
  description: "Ubah rekaman pendakian GPX jadi poster siap cetak + file 3D print rute 1:1.",
  applicationName: "GPX Summit Poster",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
};

/* Runs before paint so the right theme class is on <html> from the first
   frame — no light-flash. DEFAULT = GELAP; terang hanya bila user memilih
   lewat toggle (localStorage "light"). */
const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");document.documentElement.classList.toggle("dark",t!=="light");}catch(e){document.documentElement.classList.add("dark");}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
