"use client";

import { Auth0Provider, type AppState } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();

  const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "";
  const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID ?? "";
  const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;

  // Called once Auth0 redirects back with ?code=&state=. Strips those
  // params from the URL and sends the user on to where they were headed.
  const onRedirectCallback = (appState?: AppState) => {
    router.replace(appState?.returnTo ?? "/dashboard");
  };

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
        ...(audience ? { audience } : {}),
      }}
      onRedirectCallback={onRedirectCallback}
      cacheLocation="localstorage"
      useRefreshTokens
    >
      {children}
    </Auth0Provider>
  );
}
