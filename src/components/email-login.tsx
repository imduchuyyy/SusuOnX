"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowRight, Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DoodleMascot } from "@/components/doodle-mascot";
import { useApp } from "@/providers/app-provider";
import { generateX25519KeyPair } from "@/lib/okx-crypto";
import { authInit, authVerify } from "@/lib/okx-api";
import {
  saveSession,
  type OkxSession,
  type WalletAddress,
} from "@/lib/okx-auth-store";

type LoginStep = "email" | "otp" | "success";

interface EmailLoginProps {
  onSuccess?: () => void;
}

export function EmailLogin({ onSuccess }: EmailLoginProps) {
  const { login } = useApp();
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [flowId, setFlowId] = useState<string | null>(null);
  const [x25519PrivateKey, setX25519PrivateKey] = useState<string | null>(null);
  const [x25519PublicKey, setX25519PublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) return;

      setLoading(true);
      setError(null);

      try {
        // Generate X25519 keypair now — we'll need the public key for verify
        const keyPair = generateX25519KeyPair();
        setX25519PrivateKey(keyPair.privateKeyBase64);
        setX25519PublicKey(keyPair.publicKeyBase64);

        // Call OKX directly from browser — no backend proxy
        const result = await authInit(email.trim());
        setFlowId(result.flowId);
        setStep("otp");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send OTP");
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  const handleVerifyOtp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!otp.trim() || !flowId || !x25519PublicKey || !x25519PrivateKey)
        return;

      setLoading(true);
      setError(null);

      try {
        // Call OKX directly from browser — no backend proxy
        const data = await authVerify(
          email.trim(),
          flowId,
          otp.trim(),
          x25519PublicKey,
        );

        // Build the session object and save to localStorage
        const session: OkxSession = {
          email: email.trim(),
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          sessionCert: data.sessionCert,
          encryptedSessionSk: data.encryptedSessionSk,
          sessionKey: x25519PrivateKey,
          teeId: data.teeId,
          sessionKeyExpireAt: data.sessionKeyExpireAt,
          projectId: data.projectId,
          accountId: data.accountId,
          accountName: data.accountName,
          isNew: data.isNew ?? false,
          addresses: (data.addressList ?? []).map(
            (a: WalletAddress) => ({
              address: a.address,
              chainIndex: a.chainIndex,
              chainName: a.chainName,
              addressType: a.addressType ?? "",
              chainPath: a.chainPath ?? "",
            }),
          ),
        };

        saveSession(session);
        login(session);

        setStep("success");

        // Brief success state, then the parent will redirect/render dashboard
        setTimeout(() => {
          // Reset form state
          setEmail("");
          setOtp("");
          setFlowId(null);
          setStep("email");
          onSuccess?.();
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed");
      } finally {
        setLoading(false);
      }
    },
    [otp, flowId, x25519PublicKey, x25519PrivateKey, email, login],
  );

  return (
    <Card className="w-full max-w-sm mx-auto border-0 bg-gradient-to-br from-pastel-blue/30 via-white to-pastel-mint/20 shadow-none">
      <CardContent className="pt-8 pb-6 px-6">
        <div className="flex justify-center mb-5">
          <DoodleMascot
            size={64}
            mood={step === "success" ? "happy" : "waving"}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === "email" && (
            <motion.form
              key="email"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSendOtp}
              className="space-y-4"
            >
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-[#1F2937]">
                  Sign in to Long.AI
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your email to get started
                </p>
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10"
                  disabled={loading}
                  autoFocus
                  required
                />
              </div>

              {error && (
                <p className="text-xs text-destructive text-center">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={loading || !email.trim()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {loading ? "Sending..." : "Send OTP"}
              </Button>
            </motion.form>
          )}

          {step === "otp" && (
            <motion.form
              key="otp"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleVerifyOtp}
              className="space-y-4"
            >
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-[#1F2937]">
                  Check your email
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter the code sent to{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="pl-10 text-center text-lg tracking-[0.3em] font-mono"
                  disabled={loading}
                  autoFocus
                  maxLength={6}
                  required
                />
              </div>

              {error && (
                <p className="text-xs text-destructive text-center">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={loading || otp.length < 6}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {loading ? "Verifying..." : "Verify"}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setError(null);
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                Use a different email
              </button>
            </motion.form>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pastel-mint mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6 text-[#059669]" />
              </div>
              <h3 className="text-lg font-bold text-[#1F2937]">
                Welcome!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Setting up your wallet...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
