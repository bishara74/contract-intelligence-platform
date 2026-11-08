import "@fontsource-variable/schibsted-grotesk";
import "@fontsource-variable/source-serif-4";
import { ClerkProvider } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CLERK_ENABLED, CLERK_PUBLISHABLE_KEY } from "@/lib/auth";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const app = (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {CLERK_ENABLED ? (
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY!}
        afterSignOutUrl="/"
        signUpFallbackRedirectUrl="/dashboard"
        signInFallbackRedirectUrl="/dashboard"
        appearance={{
          variables: {
            colorPrimary: "#172033",
            colorText: "#172033",
            fontFamily: '"Schibsted Grotesk Variable", system-ui, sans-serif',
            borderRadius: "0.375rem",
          },
        }}
      >
        <AuthProvider>{app}</AuthProvider>
      </ClerkProvider>
    ) : (
      app
    )}
  </React.StrictMode>
);
