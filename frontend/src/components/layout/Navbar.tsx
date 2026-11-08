import { UserButton, useAuth } from "@clerk/react";
import { Link, NavLink } from "react-router-dom";
import Logo from "@/components/brand/Logo";
import { CLERK_ENABLED } from "@/lib/auth";
import { cn } from "@/lib/utils";

function ClerkAccount() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <UserButton />;
  return (
    <Link
      to="/sign-in"
      className="rounded-md bg-ink px-3.5 py-2 text-sm font-semibold text-white hover:bg-ink/90"
    >
      Sign in
    </Link>
  );
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    "text-sm font-semibold transition-colors",
    isActive ? "text-ink" : "text-muted-foreground hover:text-ink"
  );

export default function Navbar() {
  return (
    <header className="z-30 flex-none border-b bg-card">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-8 px-5">
        <Logo />
        <nav className="flex items-center gap-6">
          {CLERK_ENABLED && (
            <NavLink to="/dashboard" className={navLink}>
              Contracts
            </NavLink>
          )}
          <NavLink to="/demo" className={navLink}>
            Sample NDA
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3">{CLERK_ENABLED && <ClerkAccount />}</div>
      </div>
    </header>
  );
}
