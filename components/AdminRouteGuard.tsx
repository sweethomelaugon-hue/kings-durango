"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { isAdminSession, readAuthSession } from "@/lib/auth";

export default function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const syncAuth = () => {
      const session = readAuthSession();
      if (!isAdminSession(session)) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        setIsReady(false);
        return;
      }

      setIsReady(true);
    };

    syncAuth();
    window.addEventListener("auth:updated", syncAuth);
    return () => {
      window.removeEventListener("auth:updated", syncAuth);
    };
  }, [pathname, router]);

  if (!isReady) {
    return null;
  }

  return <>{children}</>;
}
