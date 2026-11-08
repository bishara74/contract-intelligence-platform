import { SignUp as ClerkSignUp } from "@clerk/react";
import { Link } from "react-router-dom";
import Logo from "@/components/brand/Logo";

export default function SignUp() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo />
      <ClerkSignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
      />
      <p className="text-sm text-muted-foreground">
        Just looking?{" "}
        <Link to="/demo" className="font-semibold text-ink underline underline-offset-2">
          Open the sample NDA
        </Link>{" "}
        without an account.
      </p>
    </div>
  );
}
