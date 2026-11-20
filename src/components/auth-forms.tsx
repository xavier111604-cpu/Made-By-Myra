"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { registerUser, requestPasswordReset, resetPassword } from "@/actions/auth";

function safeCallback(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";
}

function GoogleButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button type="button" className="btn-secondary w-full" onClick={() => signIn("google", { callbackUrl })}>
      Continue with Google
    </button>
  );
}

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const callbackUrl = safeCallback(sp.get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(sp.get("error") ? "Sign-in failed. Please try again." : null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await signIn("credentials", { email, password, redirect: false });
          if (res?.ok) {
            router.push(callbackUrl);
            router.refresh();
          } else setError(res?.error && res.error !== "CredentialsSignin" ? res.error : "That email and password don't match.");
        });
      }}
    >
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" type="email" className="input" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <div className="flex justify-between">
          <label htmlFor="password" className="label">Password</label>
          <Link href="/forgot-password" className="text-xs text-gold hover:underline">Forgot password?</Link>
        </div>
        <input id="password" type="password" className="input" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      {googleEnabled && <GoogleButton callbackUrl={callbackUrl} />}
      <p className="text-center text-sm">
        New here? <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="font-medium text-gold hover:underline">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const callbackUrl = safeCallback(sp.get("callbackUrl"));
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await registerUser(form);
          if (!res.ok) return setError(res.error);
          const login = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
          if (login?.ok) {
            router.push(callbackUrl);
            router.refresh();
          } else router.push("/login");
        });
      }}
    >
      <div>
        <label htmlFor="name" className="label">Name</label>
        <input id="name" className="input" required maxLength={100} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" type="email" className="input" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" type="password" className="input" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-describedby="pw-hint" />
        <p id="pw-hint" className="mt-1 text-xs text-charcoal/60">At least 8 characters, with a letter and a number.</p>
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Creating your account…" : "Create account"}</button>
      {googleEnabled && <GoogleButton callbackUrl={callbackUrl} />}
      <p className="text-center text-sm">
        Already have an account? <Link href="/login" className="font-medium text-gold hover:underline">Sign in</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="text-sm" role="status">If an account exists for that email, we&apos;ve sent a link to reset your password. Please check your inbox.</p>;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await requestPasswordReset(email);
          if (res.ok) setDone(true);
          else setError(res.error);
        });
      }}
    >
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
    </form>
  );
}

export function ResetForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await resetPassword(sp.get("token") ?? "", password);
          if (res.ok) router.push("/login?reset=1");
          else setError(res.error);
        });
      }}
    >
      <div>
        <label htmlFor="password" className="label">New password</label>
        <input id="password" type="password" className="input" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save new password"}</button>
    </form>
  );
}
