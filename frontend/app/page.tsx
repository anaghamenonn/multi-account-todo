"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loading } from "@/components/Loading";

/** The root route only decides where to send the visitor - it renders
 * nothing of its own. */
export default function RootPage() {
  const { isAuthenticated, isLoading } = useAuth0();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(isAuthenticated ? "/dashboard" : "/login");
  }, [isLoading, isAuthenticated, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <Loading />
    </div>
  );
}
