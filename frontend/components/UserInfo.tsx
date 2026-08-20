"use client";

import { useAuth0 } from "@auth0/auth0-react";

export function UserInfo() {
  const { user } = useAuth0();

  if (!user) return null;

  return (
    <div className="flex min-w-0 items-center gap-3">
      {user.picture && (
        // Auth0 profile pictures are hosted externally (Gravatar, social
        // providers, etc.) - a plain <img> avoids configuring next/image
        // remote patterns for arbitrary providers.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.picture}
          alt=""
          referrerPolicy="no-referrer"
          className="h-9 w-9 shrink-0 rounded-full"
        />
      )}
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
          {user.name ?? user.email ?? "Signed in"}
        </p>
        {user.email && (
          <p className="truncate text-zinc-500 dark:text-zinc-400">{user.email}</p>
        )}
      </div>
    </div>
  );
}
