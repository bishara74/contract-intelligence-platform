import { SignUp as ClerkSignUp } from "@clerk/react";

export default function SignUp() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <ClerkSignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
