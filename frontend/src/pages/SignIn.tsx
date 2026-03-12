import { SignIn as ClerkSignIn } from "@clerk/react";

export default function SignIn() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <ClerkSignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
