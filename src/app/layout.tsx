import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Web3Provider } from "@/providers/web3-provider";
import { AppProvider } from "@/providers/app-provider";
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
  title: "Long.AI - X Layer AI Yield Agent",
  description:
    "AI-powered DeFi yield agent on X Layer chain. Connect your wallet and let AI find the best yield strategies for you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="h-full">
        <AppProvider>
          <Web3Provider>{children}</Web3Provider>
        </AppProvider>
      </body>
    </html>
  );
}
