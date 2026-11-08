import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Wordmark: a folded page with a highlighted line, then the name. */
export default function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      <svg viewBox="0 0 22 26" className="h-6 w-auto" aria-hidden="true">
        <path d="M1 1h14l6 6v18H1z" fill="#fff" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M15 1v6h6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <rect x="4.5" y="10" width="13" height="3.2" fill="#FFE36E" />
        <rect x="4.5" y="15.5" width="13" height="1.6" fill="currentColor" />
        <rect x="4.5" y="19.5" width="8" height="1.6" fill="#C7362F" />
      </svg>
      <span className="text-[17px] font-bold tracking-[-0.02em]">ContractIntel</span>
    </Link>
  );
}
