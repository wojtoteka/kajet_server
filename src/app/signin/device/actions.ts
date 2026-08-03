"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { approveLoginChallenge, denyLoginChallenge } from "@/lib/login-challenge";

export type DeviceResult = { error?: string; success?: string; deepLink?: string };

export async function approveDevice(
  _previous: DeviceResult,
  data: FormData,
): Promise<DeviceResult> {
  const user = await currentUser();
  if (!user) redirect("/signin");

  const code = String(data.get("code") ?? "").trim();
  if (!code) return { error: "Brakuje kodu logowania." };

  const result = await approveLoginChallenge(code, user);
  if (!result.ok) return { error: result.reason };

  revalidatePath("/signin/device");
  return {
    success:
      `Połączono urządzenie „${result.device}". Wróć do aplikacji Kajet — ` +
      "powinna się zalogować sama w ciągu kilku sekund.",
    deepLink: `kajet://auth?code=${encodeURIComponent(code)}`,
  };
}

export async function denyDevice(
  _previous: DeviceResult,
  data: FormData,
): Promise<DeviceResult> {
  const user = await currentUser();
  if (!user) redirect("/signin");

  const code = String(data.get("code") ?? "").trim();
  if (!code) return { error: "Brakuje kodu logowania." };

  const result = await denyLoginChallenge(code, user);
  if (!result.ok) return { error: result.reason };

  revalidatePath("/signin/device");
  return { success: "Odrzucono logowanie. Aplikacja dostanie informację przy następnym sprawdzeniu." };
}
