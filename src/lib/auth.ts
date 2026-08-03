import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { googleWorks } from "./settings";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Hasło",
    credentials: {
      email: { label: "Adres e-mail", type: "email" },
      password: { label: "Hasło", type: "password" },
    },
    async authorize(data) {
      const email = String(data?.email ?? "").trim().toLowerCase();
      const password = String(data?.password ?? "");
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      // An account created through Google only has no password and cannot be
      // entered this way.
      if (!user?.passwordHash) return null;
      if (user.blocked) return null;

      const matches = await bcrypt.compare(password, user.passwordHash);
      if (!matches) return null;

      await prisma.user.update({
        where: { id: user.id },
        data: { lastSignInAt: new Date() },
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name ?? user.login,
        image: user.image,
      };
    },
  }),
];

if (googleWorks()) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers,
  // Credentials only work with JWT sessions. Database sessions are for OAuth
  // alone; mixing them throws UnsupportedStrategy and login silently fails.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: {
    signIn: "/signin",
    error: "/signin",
    newUser: "/library",
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;

      const email = user.email?.toLowerCase();
      if (!email) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        if (existing.blocked) return "/signin?error=blocked";
        await prisma.user.update({
          where: { id: existing.id },
          data: { lastSignInAt: new Date() },
        });
        return true;
      }

      // A new address. An account is created only when the user started from
      // the registration page and a code is already parked for this address.
      const code = await findParkedCode(email);
      if (!code) return "/signin?error=code-required";
      return true;
    },

    async jwt({ token }) {
      if (!token.sub) return token;

      const account = await prisma.user.findUnique({
        where: { id: token.sub },
        select: {
          id: true,
          login: true,
          role: true,
          blocked: true,
          quotaBytes: true,
          usedBytes: true,
        },
      });

      if (!account || account.blocked) {
        token.blocked = true;
        return token;
      }

      token.login = account.login;
      token.role = account.role;
      token.blocked = false;
      token.quotaBytes = account.quotaBytes.toString();
      token.usedBytes = account.usedBytes.toString();
      return token;
    },

    async session({ session, token }) {
      if (!token.sub || token.blocked) {
        return {
          ...session,
          user: { ...session.user, id: token.sub ?? "", blocked: true },
        };
      }

      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub,
          login: token.login,
          role: token.role,
          blocked: false,
          quotaBytes: token.quotaBytes,
          usedBytes: token.usedBytes,
        },
      };
    },
  },

  events: {
    async createUser({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return;

      const code = await findParkedCode(email);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          login: await freeLogin(email),
          quotaBytes: code?.quotaBytes ?? undefined,
          permanentQuotaBytes: code?.quotaBytes ?? undefined,
          emailVerified: new Date(),
        },
      });

      if (code) {
        await prisma.inviteCode.update({
          where: { id: code.id },
          data: {
            usedSeats: { increment: 1 },
            usedById: code.seats === 1 ? user.id : undefined,
          },
        });
        await prisma.verificationToken.deleteMany({
          where: { identifier: `code:${email}` },
        });
      }
    },
  },

  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

async function findParkedCode(email: string) {
  const parked = await prisma.verificationToken.findFirst({
    where: { identifier: `code:${email}`, expires: { gt: new Date() } },
  });
  if (!parked) return null;

  const code = await prisma.inviteCode.findUnique({ where: { code: parked.token } });
  if (!code) return null;
  if (code.expiresAt && code.expiresAt < new Date()) return null;
  if (code.usedSeats >= code.seats) return null;
  return code;
}

export async function freeLogin(email: string): Promise<string> {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 24) || "kajet";

  let candidate = base;
  let counter = 1;
  while (await prisma.user.findUnique({ where: { login: candidate }, select: { id: true } })) {
    counter += 1;
    candidate = `${base}${counter}`;
  }
  return candidate;
}

export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id || session.user.blocked) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.blocked) return null;
  return user;
}

export async function currentAdmin() {
  const user = await currentUser();
  return user?.role === "ADMIN" ? user : null;
}
