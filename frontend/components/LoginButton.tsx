"use client";

import { useAuth0 } from "@auth0/auth0-react";

export function LoginButton() {
  const { loginWithRedirect, isLoading } = useAuth0();

  return (
    <button
      type="button"
      onClick={() => loginWithRedirect()}
      disabled={isLoading}
      className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      Log In
    </button>
  );
}
