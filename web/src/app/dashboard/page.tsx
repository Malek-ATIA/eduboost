"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    currentSession().then((s) => {
      if (!s) {
        router.replace("/login");
        return;
      }

      if (typeof window !== "undefined") {
        let pendingRef: string | null = null;
        let pendingOrg = false;
        try {
          pendingRef = sessionStorage.getItem("eduboost_pending_ref");
          pendingOrg = sessionStorage.getItem("eduboost_pending_org_create") === "1";
        } catch {}
        if (pendingRef) {
          try { sessionStorage.removeItem("eduboost_pending_ref"); } catch {}
          api(`/referrals/claim`, {
            method: "POST",
            body: JSON.stringify({ code: pendingRef }),
          }).catch(() => {});
        }
        if (pendingOrg) {
          try { sessionStorage.removeItem("eduboost_pending_org_create"); } catch {}
          router.replace("/orgs/new");
          return;
        }
      }

      const role = currentRole(s);
      if (isAdmin(s)) return router.replace("/admin");
      if (role === "teacher") return router.replace("/teacher");
      if (role === "parent") return router.replace("/parent");
      router.replace("/student");
    });
  }, [router]);

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-ink-soft">
      Loading...
    </main>
  );
}
