import { FileText } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <FileText className="h-5 w-5 text-primary" />
          <span>ContractIntel</span>
        </Link>
        <nav className="ml-6 flex items-center gap-4 text-sm">
          <Link
            to="/dashboard"
            className={
              pathname === "/dashboard"
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
