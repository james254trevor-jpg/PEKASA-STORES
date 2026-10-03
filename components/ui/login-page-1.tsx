"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EyeIcon, EyeOffIcon, Mail, Lock, ShieldCheck, KeyRound, ArrowLeft, Smartphone, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";

const socialButtons = [
  {
    name: "Apple",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4">
        <path
          d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    name: "Google",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4">
        <path
          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    name: "Meta",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4">
        <path
          d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

export interface LoginPageProps {
  onSuccess?: (email?: string) => void;
  onNavigateRegister?: () => void;
  onClose?: () => void;
  errorMessage?: string | null;
  onLogin?: (identifier: string, password: string) => Promise<boolean>;
}

export function LoginPage3({ onSuccess, onNavigateRegister, onClose, errorMessage: propError, onLogin }: LoginPageProps = {}) {
  const { requestLogin, verifyCashierOtp, loginError } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // OTP Step State (for Cashiers)
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [tempToken, setTempToken] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [dispatchedOtp, setDispatchedOtp] = useState("");
  const [otpInput, setOtpInput] = useState("");

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      const res = await requestLogin(email.trim(), password.trim());
      if (res.requireOtp) {
        // Switch to OTP step for Cashier
        setStep("otp");
        setTempToken(res.tempToken || "");
        setContactInfo(res.contactInfo || "");
        setDispatchedOtp(res.demoOtp || "");
      } else if (res.success) {
        // Direct login for Admin
        if (onSuccess) {
          onSuccess(email);
        }
      } else {
        setLocalError(res.error || "Login failed. Please check credentials.");
      }
    } catch (err: any) {
      setLocalError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!otpInput.trim() || !tempToken) return;

    setLoading(true);
    try {
      const res = await verifyCashierOtp(tempToken, otpInput.trim());
      if (res.success) {
        if (onSuccess) {
          onSuccess(email);
        }
      } else {
        setLocalError(res.error || "Invalid OTP code. Please enter the code sent to your phone/email.");
      }
    } catch (err: any) {
      setLocalError(err?.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="from-background to-muted/50 relative isolate flex min-h-dvh w-full items-center justify-center overflow-hidden bg-gradient-to-br py-8">
      <div className="relative z-10 container mx-auto flex min-h-dvh items-center justify-center px-4 py-8">
        <Card className="relative w-full max-w-md ring-0 p-8 shadow-2xl bg-card border-border">
          {onClose && (
            <button
              onClick={onClose}
              type="button"
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-sm font-semibold p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
          )}

          <div className="mb-6 flex flex-col items-center">
            <div className="my-2 flex justify-center">
              <div className="bg-[#0B2D4A] relative size-14 rounded-2xl border border-[#FFD700]/30 flex items-center justify-center text-[#FFD700] shadow-md shadow-[#0B2D4A]/30">
                <div className="flex h-full items-center justify-center">
                  {step === 'otp' ? (
                    <KeyRound className="w-7 h-7 text-[#FFD700] animate-bounce" />
                  ) : (
                    <ShieldCheck className="w-7 h-7 text-[#FFD700]" />
                  )}
                </div>
              </div>
            </div>
            <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-foreground">
              {step === 'otp' ? 'Two-Factor OTP Security' : 'PEKASA Terminal Sign In'}
            </h1>
            <p className="text-muted-foreground text-center text-xs">
              {step === 'otp'
                ? `Enter the 6-digit OTP code dispatched to ${contactInfo}`
                : 'Role-Based Authentication for Administrators & Counter Cashiers'}
            </p>
          </div>

          {/* Error Message */}
          {(propError || loginError || localError) && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold text-center">
              {propError || loginError || localError}
            </div>
          )}

          {step === 'credentials' ? (
            /* STEP 1: CREDENTIALS */
            <form className="flex flex-col gap-5" onSubmit={handleSubmitCredentials}>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Username, phone or email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-transparent ps-10 h-10 text-sm"
                  autoComplete="username"
                  required
                />
                <Mail className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
              </div>

              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-transparent ps-10 pe-10 h-10 text-sm font-mono"
                  autoComplete="current-password"
                  required
                />
                <Lock className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute end-0 top-0 h-full cursor-pointer px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4 text-muted-foreground" />
                  ) : (
                    <EyeIcon className="size-4 text-muted-foreground" />
                  )}
                </Button>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember3"
                    className="data-[state=checked]:bg-primary bg-transparent"
                  />
                  <label
                    htmlFor="remember3"
                    className="leading-none text-muted-foreground cursor-pointer"
                  >
                    Remember terminal
                  </label>
                </div>
                <a
                  href="#forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Please contact an administrator to reset your password.");
                  }}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              {/* Login Button */}
              <Button
                className="h-10 px-4 py-2 w-full cursor-pointer font-bold bg-[#FFD700] text-[#0B2D4A] hover:bg-[#FFD700]/90 shadow-md disabled:opacity-50 text-sm"
                type="submit"
                disabled={loading}
              >
                {loading ? "Authenticating..." : "Sign In to Counter Terminal"}
              </Button>

              <p className="pt-2 border-t border-border text-[10px] text-center text-muted-foreground">
                Cashier accounts require an OTP code upon signing in.
              </p>

              {/* Social Login placeholders */}
              <div className="relative my-2 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card text-muted-foreground px-2">
                    Authorized Terminal Network
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {socialButtons.map((button, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant="outline"
                    className="h-8 px-3 text-xs w-full cursor-pointer border-border hover:bg-muted"
                    onClick={() => {
                      alert(`${button.name} SSO authentication gateway connected.`);
                    }}
                  >
                    {button.icon}
                  </Button>
                ))}
              </div>
            </form>
          ) : (
            /* STEP 2: OTP VERIFICATION FOR CASHIER */
            <form className="flex flex-col gap-5" onSubmit={handleVerifyOtp}>
              {/* Simulated OTP Notification Banner */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-bold">
                  <Smartphone className="w-4 h-4 text-amber-500 animate-pulse" />
                  <span>SMS & Email OTP Dispatched</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  A 6-digit one-time code was sent to <strong>{contactInfo}</strong>.
                </p>
                {dispatchedOtp && (
                  <div className="mt-2 p-2 bg-amber-500/20 rounded border border-amber-500/30 flex items-center justify-between">
                    <span className="font-mono text-sm font-extrabold tracking-widest text-amber-600 dark:text-amber-300">
                      OTP: {dispatchedOtp}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOtpInput(dispatchedOtp)}
                      className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] transition-colors cursor-pointer"
                    >
                      Fill Code
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Enter 6-Digit OTP Code</label>
                <div className="relative">
                  <Input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    className="h-12 text-center text-xl tracking-widest font-mono font-bold bg-transparent border-2 border-primary/40 focus:border-primary"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  Code expires in 10 minutes.
                </p>
              </div>

              <Button
                className="h-10 px-4 py-2 w-full cursor-pointer font-bold bg-[#FFD700] text-[#0B2D4A] hover:bg-[#FFD700]/90 shadow-md disabled:opacity-50 text-sm"
                type="submit"
                disabled={loading || otpInput.length < 4}
              >
                {loading ? "Verifying OTP..." : "Verify Code & Start Cashier Shift"}
              </Button>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setOtpInput("");
                    setLocalError(null);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to login</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setLocalError(null);
                    const res = await requestLogin(email, password);
                    if (res.demoOtp) {
                      setDispatchedOtp(res.demoOtp);
                      alert(`A new OTP has been dispatched to ${contactInfo}: ${res.demoOtp}`);
                    }
                  }}
                  className="text-xs text-primary font-semibold underline underline-offset-2 hover:text-primary/80 cursor-pointer"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {/* Creation Link / Info */}
          <div className="mt-5 pt-3 border-t border-border text-center text-xs text-muted-foreground">
            <span>New cashier registration is reserved exclusively for administrators.</span>
          </div>
        </Card>
      </div>
    </section>
  );
}

export const LoginPage1 = LoginPage3;
export default LoginPage3;
