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
          and risk detection — powered by LangChain RAG and GPT-4o mini.
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
            <h3 className="font-semibold text-lg mb-2">AI Q&A (RAG)</h3>
            <p className="text-muted-foreground text-sm">
              Ask any question about your contract in plain English. Get precise answers with
              source citations, backed by Retrieval-Augmented Generation.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <FileSearch className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">Clause Extraction</h3>
            <p className="text-muted-foreground text-sm">
              Automatically identify and categorize key clauses — termination, liability,
              payment terms, IP rights, and more — with confidence scores.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <ShieldAlert className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">Risk Analysis</h3>
            <p className="text-muted-foreground text-sm">
              Flag potential risks like uncapped liability, one-sided termination rights, and
              missing standard clauses — with actionable recommendations.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/40">
        <div className="container mx-auto px-4 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { step: "1", title: "Upload", desc: "Drag and drop your PDF contract. Secure upload to Cloudflare R2." },
              { step: "2", title: "Analyze", desc: "AI processes your contract — embedding chunks into Pinecone vector store." },
              { step: "3", title: "Ask & Review", desc: "Chat with your contract, review extracted clauses, and check flagged risks." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                  {step}
                </div>
                <h3 className="font-semibold text-lg">{title}</h3>
                <p className="text-muted-foreground text-sm max-w-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
