import { useAuth } from "@clerk/react";
import { useEffect } from "react";
import { setTokenGetter } from "@/api/client";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);
  return <>{children}</>;
}
