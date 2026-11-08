import { useAuth } from "@clerk/react";
import { Navigate, Outlet } from "react-router-dom";
import { CLERK_ENABLED } from "@/lib/auth";

function ClerkGate() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center" role="status" aria-label="Loading">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-ink border-t-transparent" />
      </div>
    );
  }
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return <Outlet />;
}

export default function ProtectedRoute() {
  // Without auth configured, the signed-in area is unavailable; send people to the sample.
  if (!CLERK_ENABLED) return <Navigate to="/demo" replace />;
  return <ClerkGate />;
}
