import type { Metadata } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/core/auth/AuthContext";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  "http://localhost:3000";

const poppins = Poppins({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "GVCFI-SSC",
  description: "Green Valley College Foundation Inc. – Supreme Student Council Systems",
  openGraph: {
    title: "GVCFI-SSC",
    description: "Green Valley College Foundation Inc. – Supreme Student Council Systems",
    type: "website",
    siteName: "GVCFI-SSC",
  },
  twitter: {
    card: "summary_large_image",
    title: "GVCFI-SSC",
    description: "Green Valley College Foundation Inc. – Supreme Student Council Systems",
  },
  icons: {
    icon: "/gvcfi.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>{children}</AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
