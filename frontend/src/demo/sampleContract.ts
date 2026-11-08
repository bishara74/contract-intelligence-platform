/**
 * Demo mode data.
 *
 * A fictional mutual NDA with pre-computed clauses, risks and answers, so the
 * product can be explored without an account or a running backend. All parties
 * and terms are invented.
 */
import type {
  ChatMessage,
  ClausesGroupedResponse,
  Contract,
  RisksResponse,
  SourceChunk,
} from "@/types";

export const DEMO_CONTRACT_ID = "demo";

export function isDemoId(id: string | undefined): boolean {
  return id === DEMO_CONTRACT_ID;
}

const CREATED = "2026-03-13T10:24:00Z";

export const demoContract: Contract = {
  id: DEMO_CONTRACT_ID,
  filename: "Mutual-NDA_Halden-Northwind.pdf",
  file_url: "",
  file_size_bytes: 184_320,
  page_count: 4,
  chunk_count: 16,
  status: "ready",
  error_message: null,
  summary:
    "A mutual non-disclosure agreement between Halden Labs GmbH and Northwind Analytics Ltd. covering information shared while evaluating a data partnership. It runs for two years, renews automatically, and keeps confidentiality obligations alive for five years after it ends. It is governed by the laws of England and Wales.",
  pinecone_namespace: "demo",
  created_at: CREATED,
  updated_at: CREATED,
};

// ─── Clauses ──────────────────────────────────────────────────────────────────

function clause(
  n: number,
  clause_type: string,
  title: string,
  page_number: number,
  confidence_score: number,
  content: string
) {
  return {
    id: `demo-clause-${n}`,
    contract_id: DEMO_CONTRACT_ID,
    clause_type: clause_type as never,
    title,
    content,
    page_number,
    confidence_score,
    created_at: CREATED,
  };
}

const clauses = [
  clause(1, "confidentiality", "Definition of Confidential Information", 1, 0.96,
    "“Confidential Information” means all information disclosed by either Party, whether in writing, orally or by any other means, including supplier lists, personnel information, business or marketing plans, security processes and any information which by its nature should reasonably be understood to be confidential."),
  clause(2, "confidentiality", "Obligations of the Receiving Party", 1, 0.93,
    "The Receiving Party shall hold Confidential Information in strict confidence, use it solely for the Purpose, and disclose it only to employees and advisers who need to know it and are bound by obligations no less protective than those in this Agreement."),
  clause(3, "confidentiality", "Survival of Obligations", 3, 0.88,
    "The obligations in Clause 3 shall survive termination or expiry of this Agreement for a period of five (5) years."),
  clause(4, "termination", "Term and Automatic Renewal", 3, 0.95,
    "This Agreement commences on the Effective Date and continues for two (2) years. It shall renew automatically for successive one (1) year periods unless either Party gives written notice of non-renewal at least ninety (90) days before the end of the then-current term."),
  clause(5, "termination", "Termination for Convenience", 3, 0.84,
    "Halden may terminate this Agreement at any time on thirty (30) days’ written notice. Northwind may terminate only upon a material breach by Halden which remains unremedied for sixty (60) days."),
  clause(6, "liability", "Remedies and Liability", 3, 0.81,
    "Each Party shall be liable for all losses, damages, costs and expenses arising from any breach of this Agreement by it or its Representatives."),
  clause(7, "indemnification", "Indemnity", 3, 0.79,
    "Northwind shall indemnify Halden against all claims, losses and expenses arising out of any unauthorised use or disclosure of Halden’s Confidential Information."),
  clause(8, "intellectual_property", "No Licence", 2, 0.9,
    "Nothing in this Agreement grants the Receiving Party any licence or right in respect of the Disclosing Party’s intellectual property, other than the limited right to use Confidential Information for the Purpose."),
  clause(9, "data_protection", "Personal Data", 2, 0.77,
    "Where Confidential Information includes personal data, each Party shall comply with applicable data protection legislation, including the UK GDPR."),
  clause(10, "governing_law", "Governing Law and Jurisdiction", 4, 0.97,
    "This Agreement and any dispute arising out of it shall be governed by the laws of England and Wales, and the courts of England shall have exclusive jurisdiction."),
  clause(11, "other", "Return or Destruction of Materials", 2, 0.86,
    "On written request, the Receiving Party shall promptly return or destroy all documents containing Confidential Information and certify in writing that it has done so."),
  clause(12, "non_compete", "Non-Solicitation", 4, 0.72,
    "During the term and for twelve (12) months after it, neither Party shall solicit for employment any employee of the other Party with whom it had contact in connection with the Purpose."),
];

export const demoClauses: ClausesGroupedResponse = {
  clauses_by_type: clauses.reduce<Record<string, typeof clauses>>((acc, c) => {
    (acc[c.clause_type] ??= []).push(c);
    return acc;
  }, {}),
  total: clauses.length,
};

// ─── Risks ────────────────────────────────────────────────────────────────────

function risk(
  n: number,
  severity: "critical" | "high" | "medium" | "low",
  risk_type: string,
  title: string,
  description: string,
  recommendation: string,
  clause_id: string | null
) {
  return {
    id: `demo-risk-${n}`,
    contract_id: DEMO_CONTRACT_ID,
    clause_id,
    risk_type,
    severity,
    title,
    description,
    recommendation,
    created_at: CREATED,
  };
}

const risks = [
  risk(1, "critical", "uncapped_liability", "Liability is uncapped",
    "Clause 7.1 makes each party liable for “all losses” from a breach, with no cap and no exclusion of indirect or consequential loss. A minor slip by an adviser could expose Northwind to unlimited damages.",
    "Add a liability cap (for example, a fixed sum or fees paid in the past 12 months) and exclude indirect and consequential loss.",
    "demo-clause-6"),
  risk(2, "high", "one_sided_termination", "Only Halden can terminate for convenience",
    "Halden can walk away on 30 days’ notice, but Northwind can only terminate after an unremedied material breach of 60 days.",
    "Make termination for convenience mutual, with the same notice period for both parties.",
    "demo-clause-5"),
  risk(3, "high", "one_sided_indemnity", "Indemnity runs one way",
    "Northwind indemnifies Halden for misuse of Halden’s information, but Halden gives no matching indemnity, even though the agreement is described as mutual.",
    "Make the indemnity reciprocal or remove it and rely on the general remedies clause.",
    "demo-clause-7"),
  risk(4, "medium", "auto_renewal", "Renews automatically with a 90-day notice window",
    "The agreement rolls over every year unless notice is given at least 90 days before the term ends. Missing the window locks both parties in for another year.",
    "Diary the notice deadline, or ask for the agreement to expire at the end of the term unless both parties agree to extend.",
    "demo-clause-4"),
  risk(5, "low", "missing_dispute_resolution", "No step before going to court",
    "Disputes go straight to the English courts. There is no requirement to negotiate or mediate first, which can make small disagreements expensive.",
    "Add an escalation step, such as 30 days of good-faith negotiation between senior managers before either party starts proceedings.",
    "demo-clause-10"),
];

export const demoRisks: RisksResponse = {
  risks,
  severity_counts: risks.reduce<Record<string, number>>((acc, r) => {
    acc[r.severity] = (acc[r.severity] ?? 0) + 1;
    return acc;
  }, {}),
  total: risks.length,
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const DEMO_QUESTIONS = [
  "When can this contract be terminated?",
  "How long do the confidentiality obligations last?",
  "Is there a cap on liability?",
  "Which law governs this agreement?",
];

const src = (page: number, text: string, score: number): SourceChunk => ({ page, text, score });

const answers: Record<string, { answer: string; sources: SourceChunk[] }> = {
  [DEMO_QUESTIONS[0]]: {
    answer:
      "There are three ways it can end:\n\n1. At the end of a term, if either party sends written notice of non-renewal at least 90 days before the term ends. Otherwise it renews for another year.\n2. Halden can terminate at any time on 30 days’ written notice.\n3. Northwind can only terminate if Halden commits a material breach and doesn’t fix it within 60 days.\n\nNote that the termination rights are not balanced between the parties.",
    sources: [clauses[3], clauses[4]].map((c, i) => src(c.page_number, c.content, 0.91 - i * 0.04)),
  },
  [DEMO_QUESTIONS[1]]: {
    answer:
      "The confidentiality obligations survive for five years after the agreement terminates or expires. Because the agreement itself runs for at least two years and renews automatically, the total period can be considerably longer than five years.",
    sources: [clauses[2], clauses[3]].map((c, i) => src(c.page_number, c.content, 0.89 - i * 0.06)),
  },
  [DEMO_QUESTIONS[2]]: {
    answer:
      "No. Clause 7.1 makes each party liable for all losses, damages, costs and expenses arising from a breach, without any cap and without excluding indirect or consequential loss. This is the most significant risk in the agreement.",
    sources: [src(clauses[5].page_number, clauses[5].content, 0.87)],
  },
  [DEMO_QUESTIONS[3]]: {
    answer:
      "The agreement is governed by the laws of England and Wales, and the English courts have exclusive jurisdiction over any dispute.",
    sources: [src(clauses[9].page_number, clauses[9].content, 0.94)],
  },
};

const FALLBACK =
  "The demo answers the suggested questions only. Sign in and upload a contract to ask anything you like.";

let history: ChatMessage[] = [];

export function getDemoHistory(): ChatMessage[] {
  return history;
}

export async function askDemo(question: string): Promise<{ answer: string; sources: SourceChunk[]; message_id: string }> {
  const now = new Date().toISOString();
  history = [
    ...history,
    { id: `u-${history.length}`, contract_id: DEMO_CONTRACT_ID, role: "user", content: question, source_chunks: null, created_at: now },
  ];
  // Simulate retrieval + generation latency so the UI shows its working state
  await new Promise((r) => setTimeout(r, 1100));
  const match = answers[question.trim()];
  const answer = match?.answer ?? FALLBACK;
  const sources = match?.sources ?? [];
  const id = `a-${history.length}`;
  history = [
    ...history,
    { id, contract_id: DEMO_CONTRACT_ID, role: "assistant", content: answer, source_chunks: sources, created_at: new Date().toISOString() },
  ];
  return { answer, sources, message_id: id };
}
