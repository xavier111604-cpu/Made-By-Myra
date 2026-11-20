import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "./db";
import { rateLimit } from "./rate-limit";

export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const credentialsSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase().trim();
        const allowed = await rateLimit(`login:${email}`, 10, 15 * 60);
        if (!allowed) throw new Error("Too many sign-in attempts. Please wait a few minutes and try again.");
        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "google") {
        const email = (profile?.email || user.email || "").toLowerCase();
        // Only accept Google accounts with a verified email address
        const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
        if (!email || verified === false) return false;
        await db.user.upsert({
          where: { email },
          update: { googleId: account.providerAccountId },
          create: { email, name: user.name ?? null, googleId: account.providerAccountId },
        });
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user || account) {
        const email = (user?.email || token.email || "").toLowerCase();
        const dbUser = await db.user.findUnique({ where: { email } });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.name = dbUser.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as "CUSTOMER" | "ADMIN") ?? "CUSTOMER";
      }
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}

/** Returns the signed-in user from the database (or null). */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return db.user.findUnique({ where: { id: session.user.id } });
}

export class AuthError extends Error {}

/** Server-side admin check. Always re-reads the role from the database. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new AuthError("Not authorized");
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Please sign in");
  return user;
}

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");
