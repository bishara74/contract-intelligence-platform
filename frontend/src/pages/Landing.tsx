import { FileText, Github } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/brand/Logo";
import { CLERK_ENABLED, GITHUB_URL } from "@/lib/auth";
import { cn } from "@/lib/utils";

// ── Hero: a contract page marked up the way a reviewer would ───────────────────

type Note = { tone: "critical" | "high" | "medium" | "clause"; label: string; text: string };

const NOTE_TONE: Record<Note["tone"], string> = {
  critical: "text-severity-critical",
  high: "text-severity-high",
  medium: "text-severity-medium",
  clause: "text-ink",
};

const NOTE_RULE: Record<Note["tone"], string> = {
  critical: "border-severity-critical",
  high: "border-severity-high",
  medium: "border-highlight",
  clause: "border-ink",
};

function delay(ms: number): CSSProperties {
  return { animationDelay: `${ms}ms` };
}

function Mark({ red, at, children }: { red?: boolean; at: number; children: ReactNode }) {
  return (
    <span className={cn(red ? "mark-red" : "mark", "sweep")} style={delay(at)}>
      {children}
    </span>
  );
}

function Para({ n, heading, children, note, at }: {
  n: string;
  heading: string;
  children: ReactNode;
  note?: Note;
  at: number;
}) {
  return (
    <div className="grid gap-x-8 gap-y-2 md:grid-cols-[minmax(0,1fr)_180px]">
      <p className="font-serif text-[15px] leading-[1.7] text-ink/90">
        <span className="font-semibold text-ink">
          {n}&ensp;{heading}.
        </span>{" "}
        {children}
      </p>
      {note ? (
        <aside
          className={cn("note-in border-l-2 pl-3 md:mt-1 md:self-start", NOTE_RULE[note.tone])}
          style={delay(at + 350)}
        >
          <p className={cn("text-[13px] font-bold", NOTE_TONE[note.tone])}>{note.label}</p>
          <p className="text-[13px] leading-snug text-muted-foreground">{note.text}</p>
        </aside>
      ) : (
        <span className="hidden md:block" />
      )}
    </div>
  );
}

function MarkedUpPage() {
  return (
    <figure className="sheet relative mx-auto w-full max-w-[640px] rounded-sm px-6 py-8 sm:px-10 sm:py-10">
      {/* page furniture */}
      <div className="mb-7 flex items-baseline justify-between border-b border-dashed pb-4 font-serif">
        <span className="text-[15px] font-semibold tracking-wide text-ink">Mutual Non-Disclosure Agreement</span>
        <span className="text-xs text-muted-foreground">Page 3 of 4</span>
      </div>

      <div className="space-y-5">
        <Para
          n="4"
          heading="Term"
          at={300}
          note={{ tone: "medium", label: "Medium risk", text: "Renews every year unless notice is given 90 days ahead." }}
        >
          This Agreement continues for two (2) years and{" "}
          <Mark at={300}>shall renew automatically for successive one (1) year periods</Mark> unless either
          Party gives written notice at least ninety (90) days before the end of the term.
        </Para>
        <Para
          n="5"
          heading="Termination"
          at={700}
          note={{ tone: "high", label: "High risk", text: "Only Halden can end the agreement early." }}
        >
          <Mark red at={700}>Halden may terminate this Agreement at any time on thirty (30) days’ notice.</Mark>{" "}
          Northwind may terminate only upon a material breach which remains unremedied for sixty (60) days.
        </Para>
        <Para
          n="7"
          heading="Liability"
          at={1100}
          note={{ tone: "critical", label: "Critical risk", text: "No cap on what either side could owe." }}
        >
          Each Party shall be liable for <Mark red at={1100}>all losses, damages, costs and expenses</Mark>{" "}
          arising from any breach of this Agreement by it or its Representatives.
        </Para>
        <Para
          n="9"
          heading="Governing law"
          at={1500}
          note={{ tone: "clause", label: "Governing law clause", text: "England and Wales, English courts." }}
        >
          This Agreement shall be governed by <Mark at={1500}>the laws of England and Wales</Mark>.
        </Para>
      </div>
      <figcaption className="sr-only">
        A sample contract page with clauses highlighted and risks noted in the margin.
      </figcaption>
    </figure>
  );
}

// ── Feature examples ──────────────────────────────────────────────────────────

function AskExample() {
  return (
    <div className="space-y-3 text-sm">
      <p className="ml-auto w-fit rounded-md bg-ink px-3 py-2 text-white">Can Northwind end this early?</p>
      <p className="leading-relaxed text-ink">
        Only after a material breach by Halden that isn’t fixed within 60 days.{" "}
        <span className="inline-flex items-center gap-1 rounded-sm border bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
          <FileText className="h-3 w-3" aria-hidden />
          p. 3
        </span>
      </p>
    </div>
  );
}

function ClausesExample() {
  const rows: [string, number][] = [
    ["Confidentiality", 3],
    ["Termination", 2],
    ["Intellectual property", 1],
    ["Governing law", 1],
  ];
  return (
    <ul className="divide-y text-sm">
      {rows.map(([name, n]) => (
        <li key={name} className="flex justify-between py-1.5">
          <span className="text-ink">{name}</span>
          <span className="tabular-nums text-muted-foreground">{n}</span>
        </li>
      ))}
    </ul>
  );
}

function RisksExample() {
  const parts = [
    { n: 1, c: "bg-severity-critical", label: "critical" },
    { n: 2, c: "bg-severity-high", label: "high" },
    { n: 1, c: "bg-highlight", label: "medium" },
    { n: 1, c: "bg-severity-low", label: "low" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {parts.map((p) => (
          <div key={p.label} className={p.c} style={{ flex: p.n }} />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {parts.map((p, i) => (
          <span key={p.label}>
            <span className="font-semibold text-ink">{p.n}</span> {p.label}
            {i < parts.length - 1 ? ", " : ""}
          </span>
        ))}
      </p>
      <p className="border-l-2 border-severity-critical pl-3 text-sm text-ink">Liability is uncapped</p>
    </div>
  );
}

const FEATURES = [
  {
    title: "Ask in plain English",
    body: "Answers come only from the contract itself, with the page each one came from.",
    example: <AskExample />,
  },
  {
    title: "See every key clause",
    body: "Termination, liability, payment, IP and ten more types, pulled out and grouped.",
    example: <ClausesExample />,
  },
  {
    title: "Find the risky terms",
    body: "Auto-renewals, uncapped liability, one-sided rights, each with a suggested fix.",
    example: <RisksExample />,
  },
];

const STEPS = [
  { title: "Upload a PDF", body: "The file goes straight to Cloudflare R2 through a presigned URL." },
  { title: "It gets indexed", body: "PyMuPDF extracts the text; it's split into passages and embedded into Pinecone." },
  { title: "Ask and analyze", body: "GPT-4o-mini answers from the retrieved passages and extracts clauses and risks via LangChain." },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5">
        <Logo />
        <div className="flex items-center gap-5">
          <a
            href={GITHUB_URL}
            className="hidden items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink sm:inline-flex"
          >
            <Github className="h-4 w-4" aria-hidden />
            Source
          </a>
          {CLERK_ENABLED && (
            <Link to="/sign-in" className="text-sm font-semibold text-ink hover:underline underline-offset-4">
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:pt-16">
        <div className="max-w-xl">
          <h1 className="text-[clamp(2.6rem,6vw,4.4rem)] font-extrabold leading-[0.98] tracking-[-0.035em] text-ink">
            Know what you’re signing.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
            Upload a PDF contract. Ask questions about it in plain English, see every key clause pulled out, and
            find the terms that put you at risk, each traced back to its page.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              to="/demo"
              className="inline-flex h-12 items-center rounded-md bg-ink px-6 text-base font-semibold text-white hover:bg-ink/90"
            >
              Open the sample NDA
            </Link>
            {CLERK_ENABLED && (
              <Link
                to="/dashboard"
                className="inline-flex h-12 items-center rounded-md border border-input bg-card px-6 text-base font-semibold text-ink hover:bg-accent"
              >
                Upload your own
              </Link>
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">The sample works without an account.</p>
        </div>

        <MarkedUpPage />
      </section>

      {/* Features */}
      <section className="border-y bg-card">
        <div className="mx-auto max-w-[1240px] px-5 py-16">
          <h2 className="max-w-lg text-2xl font-bold tracking-tight text-ink">
            Three views of the same contract
          </h2>
          <div className="mt-10 grid gap-12 md:grid-cols-3 md:gap-0 md:divide-x">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-6 md:px-8 md:first:pl-0 md:last:pr-0">
                <div>
                  <h3 className="text-lg font-bold text-ink">{f.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
                <div className="mt-auto rounded-md border bg-background/60 p-4">{f.example}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1240px] px-5 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-ink">How it works</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 border-ink text-sm font-bold text-ink"
                aria-hidden
              >
                {i + 1}
              </span>
              <div>
                <h3 className="font-bold text-ink">{s.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Built with React, TypeScript and Tailwind on the front end; FastAPI, PostgreSQL, LangChain, OpenAI and
          Pinecone behind it; deployed on Vercel and Render with a Jenkins pipeline.
        </p>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-5 py-6 text-sm text-muted-foreground">
          <Logo />
          <p>Not legal advice. Have a lawyer review anything you plan to sign.</p>
          <a href={GITHUB_URL} className="inline-flex items-center gap-1.5 font-semibold hover:text-ink">
            <Github className="h-4 w-4" aria-hidden />
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
