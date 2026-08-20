"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loading } from "@/components/Loading";
import { LoginButton } from "@/components/LoginButton";

export default function LoginPage() {
  const { isAuthenticated, isLoading, error } = useAuth0();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  const missingConfig =
    !process.env.NEXT_PUBLIC_AUTH0_DOMAIN || !process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Todo</h1>
        <p className="max-w-sm text-zinc-500 dark:text-zinc-400">
          A simple multi-account todo list. Log in to see and manage your own
          todos - nobody else&apos;s.
        </p>
      </div>

      {missingConfig && (
        <p className="max-w-sm rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Auth0 is not configured yet. Set NEXT_PUBLIC_AUTH0_DOMAIN and
          NEXT_PUBLIC_AUTH0_CLIENT_ID in frontend/.env.local, then restart the
          dev server.
        </p>
      )}

      {error && (
        <p className="max-w-sm rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error.message}
        </p>
      )}

      <LoginButton />
    </div>
  );
}
