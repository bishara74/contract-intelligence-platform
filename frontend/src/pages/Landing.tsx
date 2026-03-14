import { ArrowRight, Brain, FileSearch, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <FileSearch className="h-5 w-5 text-primary" />
            ContractIntel
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Understand Any Contract{" "}
          <span className="text-primary">in Seconds</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Upload a PDF contract and instantly get AI-powered Q&A, automatic clause extraction,
          and risk detection.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Upload Your Contract <ArrowRight className="h-5 w-5" />
        </Link>
      </section>

      {/* Feature Cards */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <Brain className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">AI Q&A</h3>
            <p className="text-muted-foreground text-sm">
              Ask any question about your contract and get clear answers with exact references
              to the relevant sections.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <FileSearch className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">Clause Extraction</h3>
            <p className="text-muted-foreground text-sm">
              Instantly identify key clauses like termination terms, payment conditions,
              liability limits, and intellectual property rights.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <ShieldAlert className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">Risk Analysis</h3>
            <p className="text-muted-foreground text-sm">
              Spot potential risks like unfair termination rights, missing protections, and
              one-sided liability — with clear recommendations.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
