import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      login?: string;
      role?: "USER" | "ADMIN";
      blocked?: boolean;
      quotaBytes?: string;
      usedBytes?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    login?: string;
    role?: "USER" | "ADMIN";
    blocked?: boolean;
    quotaBytes?: string;
    usedBytes?: string;
  }
}
