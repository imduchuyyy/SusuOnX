"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Shield,
  TrendingUp,
  Zap,
  Sparkles,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DoodleMascot, MascotIcon } from "@/components/doodle-mascot";

const FEATURES = [
  {
    icon: Bot,
    title: "AI-Powered Strategies",
    description:
      "Chat with our AI agent to discover yield strategies tailored to your risk profile on X Layer.",
    bg: "bg-pastel-blue",
    color: "text-[#3730A3]",
  },
  {
    icon: Shield,
    title: "Persona-Based Risk",
    description:
      "Configure your risk tolerance and approved actions. The AI adapts its recommendations to match.",
    bg: "bg-pastel-mint",
    color: "text-[#065F46]",
  },
  {
    icon: TrendingUp,
    title: "Curated Vaults",
    description:
      "Access hand-picked yield vaults from 5% stable yields to 40%+ aggressive strategies.",
    bg: "bg-pastel-lavender",
    color: "text-[#5B21B6]",
  },
  {
    icon: Zap,
    title: "One-Click Deposits",
    description:
      "Execute deposits through the chat interface. Your AI agent wallet handles the transactions.",
    bg: "bg-pastel-peach",
    color: "text-[#92400E]",
  },
];

const STATS = [
  { label: "TVL on X Layer", value: "$18.4M" },
  { label: "Active Vaults", value: "3" },
  { label: "Avg APY", value: "22.1%" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] overflow-x-hidden">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <MascotIcon size={32} />
          <span className="text-lg font-bold text-[#1F2937] tracking-tight">
            Long.AI
          </span>
        </div>
        <Link href="/dashboard">
          <Button size="sm" className="gap-1.5">
            Launch App
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-pastel-blue px-4 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#3730A3]" />
              <span className="text-xs font-semibold text-[#3730A3]">
                AI Yield Agent on X Layer
              </span>
            </div>
            <h1 className="text-5xl font-bold leading-tight text-[#1F2937] tracking-tight lg:text-6xl">
              Smarter yields,{" "}
              <span className="doodle-underline">zero stress</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Connect your wallet, tell our AI agent your goals, and let it find
              the best DeFi yield strategies on X Layer for you.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Link href="/dashboard">
                <Button size="lg" className="gap-2 text-base px-8">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Layers className="h-4 w-4" />
                Built on X Layer
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="flex justify-center"
          >
            <div className="relative">
              {/* Decorative blobs */}
              <div className="absolute -top-8 -left-8 h-48 w-48 rounded-full bg-pastel-blue/50 blur-3xl" />
              <div className="absolute -bottom-8 -right-8 h-48 w-48 rounded-full bg-pastel-mint/50 blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full bg-pastel-lavender/40 blur-2xl" />

              {/* Mascot */}
              <div className="relative">
                <DoodleMascot size={280} mood="waving" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 flex flex-wrap justify-center gap-8"
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-2xl bg-white px-6 py-3 border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <span className="text-2xl font-bold text-[#1F2937]">
                {stat.value}
              </span>
              <span className="text-sm text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold text-[#1F2937] tracking-tight">
            How it works
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto">
            A smarter way to earn yield on X Layer, powered by AI and designed
            for every risk level.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <Card className="h-full shadow-none hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div
                      className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${feature.bg}`}
                    >
                      <Icon className={`h-5 w-5 ${feature.color}`} />
                    </div>
                    <h3 className="text-base font-semibold text-[#1F2937] mb-1.5">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-0 bg-gradient-to-br from-pastel-blue/40 via-white to-pastel-mint/30 shadow-none">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <DoodleMascot size={80} mood="happy" className="mb-6" />
              <h2 className="text-2xl font-bold text-[#1F2937] mb-2">
                Ready to earn smarter yields?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-sm">
                Connect your wallet and start chatting with your AI yield agent
                in seconds.
              </p>
              <Link href="/dashboard">
                <Button size="lg" className="gap-2 text-base px-8">
                  Launch Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MascotIcon size={20} />
            <span className="text-sm font-semibold text-[#1F2937]">
              Long.AI
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Built on X Layer. Powered by AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
