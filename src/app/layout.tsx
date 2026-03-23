import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import { Web3Provider } from "@/providers/web3-provider";
import { AppProvider } from "@/providers/app-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-geist-mono",
  weight: ["400", "700"],
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
      className={`${inter.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <AppProvider>
          <Web3Provider>{children}</Web3Provider>
        </AppProvider>
      </body>
    </html>
  );
}
