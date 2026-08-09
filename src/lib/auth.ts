import NextAuth, { CredentialsSignin } from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { apiWords } from "./language";
import { forgetInvite, inviteFromCookie } from "./invite";
import { googleWorks } from "./settings";
import {
  callerAddress,
  clearFailedSignIns,
  noteFailedSignIn,
  signInAllowed,
} from "./signin-limits";

/**
 * Logowanie zamknięte po pięciu nieudanych próbach. Auth.js przepuszcza
 * `code` do adresu strony logowania, więc da się tam powiedzieć wprost, że to
 * nie jest złe hasło, tylko zapora.
 */
class TooManySignIns extends CredentialsSignin {
  code = "too-many-attempts";
}

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Kajet",
    credentials: {
      email: { label: "Adres e-mail", type: "email" },
      password: { label: "password", type: "password" },
    },
    async authorize(data, request) {
      const email = String(data?.email ?? "").trim().toLowerCase();
      const password = String(data?.password ?? "");
      if (!email || !password) return null;

      const from = request instanceof Request ? callerAddress(request) : null;

      const gate = signInAllowed(email, from, await apiWords());
      if (!gate.allowed) throw new TooManySignIns();

      const user = await prisma.user.findUnique({ where: { email } });
      // An account created through Google only has no password and cannot be
      // entered this way.
      if (!user?.passwordHash) {
        noteFailedSignIn(email, from);
        return null;
      }
      if (user.blocked) return null;

      const matches = await bcrypt.compare(password, user.passwordHash);
      if (!matches) {
        noteFailedSignIn(email, from);
        return null;
      }

      clearFailedSignIns(email, from);

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

/**
 * Prisma User.login is required and has no DB default. Auth.js's stock
 * createUser only sends email/name/image - new Google accounts then fail
 * mid-callback with an empty [auth][details] blob. We set login (and the
 * quota from the invite code) here before the row is written.
 */
function kajetAdapter(): Adapter {
  const base = PrismaAdapter(prisma) as Adapter;

  return {
    ...base,
    async createUser(data) {
      const email = data.email?.toLowerCase();
      if (!email) {
        throw new Error((await apiWords()).apiGoogleNoEmail);
      }

      // Kod przyjechał w ciasteczku ustawionym na stronie zakładania konta.
      // Callback signIn sprawdził go już raz - tutaj jest ostatnia bramka,
      // żeby konto nie powstało bez kodu.
      const code = await inviteFromCookie();
      if (!code) {
        throw new Error((await apiWords()).apiNoInviteForGoogle);
      }

      const login = await freeLogin(email);

      // Konto i zużycie miejsca w kodzie w jednej transakcji, tak samo jak
      // przy zakładaniu konta na hasło.
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            emailVerified: data.emailVerified ?? new Date(),
            name: data.name ?? null,
            image: data.image ?? null,
            login,
            quotaBytes: code.quotaBytes ?? undefined,
            permanentQuotaBytes: code.quotaBytes ?? undefined,
            // To samo co przy zakładaniu konta na hasło: kod niesie samo
            // uprawnienie, zgodę na wysyłanie treści potwierdza się osobno.
            canUseAi: code.grantsAi,
          },
        });

        await tx.inviteCode.update({
          where: { id: code.id },
          data: {
            usedSeats: { increment: 1 },
            usedById: code.seats === 1 ? created.id : undefined,
          },
        });

        return created;
      });

      await forgetInvite();

      return {
        id: user.id,
        email: user.email!,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.image,
      };
    },
  };
}

export const authConfig: NextAuthConfig = {
  adapter: kajetAdapter(),
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
      if (!email) return "/signin?error=AccessDenied";

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        if (existing.blocked) return "/signin?error=blocked";
        await prisma.user.update({
          where: { id: existing.id },
          data: { lastSignInAt: new Date() },
        });
        return true;
      }

      // Nowy adres. Konto powstaje tylko wtedy, gdy użytkownik zaczął od
      // strony zakładania konta i wpisał tam ważny kod.
      const code = await inviteFromCookie();
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
          sessionsRevokedAt: true,
        },
      });

      if (!account || account.blocked) {
        token.blocked = true;
        return token;
      }

      /*
        Wylogowanie ze wszystkich urządzeń. Sesja strony to podpisane
        ciasteczko, którego nie da się cofnąć w bazie, więc porównujemy moment
        jego wydania (iat, w sekundach) ze znacznikiem przy koncie. Ciasteczko
        starsze od znacznika przestaje działać przy pierwszym zapytaniu.
      */
      if (account.sessionsRevokedAt && typeof token.iat === "number") {
        const revokedAt = Math.floor(account.sessionsRevokedAt.getTime() / 1000);
        if (token.iat < revokedAt) {
          token.blocked = true;
          return token;
        }
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

  logger: {
    error(error) {
      // Surface enough to diagnose Google callback failures without dumping tokens.
      console.error("[auth]", error.name, error.message);
      if ("cause" in error && error.cause) {
        console.error("[auth] cause:", error.cause);
      }
    },
  },

  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

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
