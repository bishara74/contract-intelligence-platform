export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

/** When no Clerk key is configured, the app runs in demo-only mode. */
export const CLERK_ENABLED = Boolean(CLERK_PUBLISHABLE_KEY);

export const GITHUB_URL = "https://github.com/bishara74/contract-intelligence-platform";
