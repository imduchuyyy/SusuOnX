import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { xLayer } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "LongDotAI",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
  chains: [xLayer],
  ssr: true,
});
