import { Link, Outlet, useLocation } from "react-router-dom";
import { CLERK_ENABLED } from "@/lib/auth";
import Navbar from "./Navbar";

function DemoNotice() {
  return (
    <div className="border-b border-highlight/60 bg-highlight/40">
      <p className="mx-auto max-w-[1400px] px-5 py-1.5 text-[13px] text-ink">
        Fictional sample NDA<span className="hidden sm:inline"> with pre-computed results</span>.{" "}
        {CLERK_ENABLED ? (
          <Link to="/sign-in" className="font-semibold underline underline-offset-2">
            Sign in to analyze your own contract
          </Link>
        ) : (
          <span className="hidden sm:inline">Uploading your own contracts needs the full deployment.</span>
        )}
      </p>
    </div>
  );
}

export default function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="flex h-dvh flex-col">
      <Navbar />
      {pathname.startsWith("/demo") && <DemoNotice />}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
