"use client";

import { useAuth0 } from "@auth0/auth0-react";

export function LogoutButton() {
  const { logout } = useAuth0();

  return (
    <button
      type="button"
      onClick={() =>
        logout({ logoutParams: { returnTo: `${window.location.origin}/login` } })
      }
      className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      Log Out
    </button>
  );
}
