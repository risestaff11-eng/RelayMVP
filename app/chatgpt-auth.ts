import { redirect } from "next/navigation";
import { getAccountUser, type AccountUser } from "../lib/account-auth";

export type ChatGPTUser = AccountUser;

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  return getAccountUser();
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getAccountUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  return `/auth?returnTo=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  return `/api/auth/logout?returnTo=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

function safeRelativeReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://relay.local");
    return url.origin === "https://relay.local" ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
