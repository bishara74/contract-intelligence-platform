# CLAUDE.md — Contract Intelligence Platform

## Project Overview

A Contract Intelligence Platform that lets users upload PDF contracts, ask natural language questions via RAG, extract clauses automatically, and flag risks. This is the demo version — no auth, no billing. Deploy to Vercel (frontend) + Render (backend).

## Tech Stack

- **Frontend:** React 18 (Vite) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2.0 (async) + Alembic
- **Database:** PostgreSQL (local via Docker, Render managed in production)
- **Vector DB:** Pinecone Serverless (dimension 1536, cosine metric)
- **LLM:** OpenAI gpt-4o-mini via LangChain
- **Embeddings:** OpenAI text-embedding-3-small via LangChain OpenAIEmbeddings
- **File Storage:** Cloudflare R2 (S3-compatible, accessed via boto3)
- **PDF Parsing:** PyMuPDF (fitz)
- **Background Tasks:** FastAPI BackgroundTasks
- **Local Dev:** Docker + Docker Compose
- **Deployment:** Vercel (frontend) + Render (backend)

## Project Structure

```
contract-intelligence/
├── CLAUDE.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── __init__.py
│       ├── main.py              # FastAPI app, CORS, lifespan
│       ├── config.py            # Pydantic Settings (env vars)
│       ├── database.py          # Async SQLAlchemy engine + session
│       ├── models/
│       │   ├── __init__.py
│       │   ├── contract.py      # Contract model
│       │   ├── clause.py        # Clause model
│       │   ├── risk.py          # Risk model
│       │   └── chat_message.py  # ChatMessage model
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── contract.py      # Contract request/response schemas
│       │   ├── clause.py
│       │   ├── risk.py
│       │   ├── chat.py
│       │   └── common.py        # SuccessResponse, ErrorResponse wrappers
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── health.py        # GET /api/v1/health
│       │   ├── contracts.py     # Upload, list, get, delete contracts
│       │   ├── chat.py          # POST /api/v1/contracts/{id}/chat
│       │   ├── clauses.py       # Extract + GET clauses
│       │   └── risks.py         # Analyze + GET risks
│       ├── services/
│       │   ├── __init__.py
│       │   ├── storage.py       # Cloudflare R2 upload/download/presigned URLs
│       │   ├── pdf_parser.py    # PyMuPDF text extraction + LangChain chunking
│       │   ├── vector_store.py  # Pinecone + LangChain embeddings
│       │   ├── rag.py           # LangChain RAG pipeline (retrieval + generation)
│       │   ├── clause_extractor.py  # LangChain structured output for clauses
│       │   └── risk_analyzer.py     # LangChain risk analysis
│       └── utils/
│           ├── __init__.py
│           └── response.py      # Helper functions for consistent API responses
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx              # React Router setup
        ├── api/
        │   └── client.ts        # Axios instance + typed API functions
        ├── components/
        │   ├── ui/              # shadcn/ui components
        │   ├── layout/
        │   │   ├── AppShell.tsx
        │   │   └── Navbar.tsx
        │   ├── upload/
        │   │   ├── DropZone.tsx
        │   │   └── ProcessingStatus.tsx
        │   ├── chat/
        │   │   ├── ChatWindow.tsx
        │   │   ├── MessageBubble.tsx
        │   │   ├── SourceCitation.tsx
        │   │   └── ChatInput.tsx
        │   ├── clauses/
        │   │   ├── ClauseList.tsx
        │   │   └── ClauseCard.tsx
        │   └── risks/
        │       ├── RiskList.tsx
        │       ├── RiskCard.tsx
        │       └── RiskSummaryBar.tsx
        ├── pages/
        │   ├── Landing.tsx
        │   ├── Dashboard.tsx
        │   └── ContractDetail.tsx
        ├── hooks/
        │   └── useContract.ts   # React Query hooks for contract data
        ├── store/
        │   └── chatStore.ts     # Zustand store for chat state
        └── types/
            └── index.ts         # All TypeScript interfaces matching backend schemas
```

## Database Schema

All tables use UUID primary keys. Use SQLAlchemy 2.0 mapped_column style with type hints.

### contracts
- id: UUID, PK, default uuid4
- filename: String, not null
- file_url: String, not null (R2 presigned or direct URL)
- file_size_bytes: Integer, not null
- page_count: Integer, default 0
- chunk_count: Integer, default 0
- status: Enum('uploading', 'processing', 'ready', 'error'), default 'uploading'
- error_message: String, nullable
- summary: Text, nullable (AI-generated contract summary)
- pinecone_namespace: String, not null, unique (format: contract_{id})
- created_at: DateTime, default utcnow
- updated_at: DateTime, default utcnow, onupdate utcnow

### clauses
- id: UUID, PK
- contract_id: UUID, FK → contracts.id, indexed, ondelete CASCADE
- clause_type: Enum('termination', 'liability', 'indemnification', 'confidentiality', 'payment_terms', 'governing_law', 'non_compete', 'intellectual_property', 'force_majeure', 'dispute_resolution', 'warranty', 'insurance', 'data_protection', 'other')
- title: String, not null
- content: Text, not null
- page_number: Integer, not null
- confidence_score: Float, not null
- created_at: DateTime, default utcnow

### risks
- id: UUID, PK
- contract_id: UUID, FK → contracts.id, indexed, ondelete CASCADE
- clause_id: UUID, FK → clauses.id, nullable
- risk_type: String, not null
- severity: Enum('low', 'medium', 'high', 'critical')
- title: String, not null
- description: Text, not null
- recommendation: Text, not null
- created_at: DateTime, default utcnow

### chat_messages
- id: UUID, PK
- contract_id: UUID, FK → contracts.id, indexed, ondelete CASCADE
- role: Enum('user', 'assistant')
- content: Text, not null
- source_chunks: JSON, nullable (array of {page: int, text: str, score: float})
- created_at: DateTime, default utcnow

## API Endpoints

All responses follow this format:
```json
// Success
{"success": true, "data": { ... }}

// Error
{"success": false, "error": {"code": "PROCESSING_FAILED", "message": "..."}}
```

### Health
- `GET /api/v1/health` → returns DB connection status

### Contracts
- `POST /api/v1/contracts/upload-url` → body: {filename, file_size_bytes} → returns {contract_id, upload_url (presigned R2 URL)}
- `POST /api/v1/contracts/{contract_id}/confirm-upload` → triggers background processing pipeline (parse → chunk → embed → ready). Returns contract status.
- `GET /api/v1/contracts` → list all contracts, ordered by created_at desc
- `GET /api/v1/contracts/{contract_id}` → single contract with status
- `DELETE /api/v1/contracts/{contract_id}` → deletes from DB, R2, and Pinecone

### Chat (RAG)
- `POST /api/v1/contracts/{contract_id}/chat` → body: {question} → returns {answer, sources: [{page, text, score}], message_id}
- `GET /api/v1/contracts/{contract_id}/chat/history` → returns all messages for this contract, ordered by created_at asc

### Clauses
- `POST /api/v1/contracts/{contract_id}/extract-clauses` → triggers clause extraction as background task, returns {status: "processing"}
- `GET /api/v1/contracts/{contract_id}/clauses` → returns extracted clauses grouped by type

### Risks
- `POST /api/v1/contracts/{contract_id}/analyze-risks` → triggers risk analysis as background task (requires clauses to be extracted first), returns {status: "processing"}
- `GET /api/v1/contracts/{contract_id}/risks` → returns risks with severity counts

## LangChain Implementation Details

This is critical — use LangChain abstractions everywhere, not raw OpenAI SDK calls.

### Chunking (pdf_parser.py)
```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""]
)
```
Preserve page number mapping: track which page each chunk came from.

### Embeddings + Vector Store (vector_store.py)
```python
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vector_store = PineconeVectorStore(
    index=pinecone_index,
    embedding=embeddings,
    namespace=f"contract_{contract_id}"
)
```
Batch upsert: 100 vectors at a time. Each vector metadata: contract_id, filename, page_number, chunk_index, chunk_text.

### RAG Pipeline (rag.py)
Build using LangChain Expression Language (LCEL):
```python
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1)
retriever = vector_store.as_retriever(
    search_type="similarity_score_threshold",
    search_kwargs={"k": 5, "score_threshold": 0.7}
)
```

System prompt for RAG:
```
You are a contract analysis expert. Answer the user's question based ONLY on the provided contract context. Follow these rules:
1. If the answer is in the context, provide a clear, precise answer and cite the page number(s).
2. If the answer is NOT in the context, say "I couldn't find information about that in this contract."
3. Never make up information that isn't in the context.
4. Be specific — quote relevant contract language when helpful.
5. Format your answer clearly with paragraphs. Use bullet points only if listing multiple items.
```

Include chat history (last 10 messages) for follow-up question support.

### Clause Extraction (clause_extractor.py)
Use LangChain's Pydantic output parser:
```python
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate
```
Process chunks in batches to stay within context window. Deduplicate clauses that span multiple chunks. Generate a 3-4 sentence contract summary and save to contracts.summary.

### Risk Analysis (risk_analyzer.py)
Use LangChain with structured output. Check for:
- Auto-renewal traps
- Unlimited/uncapped liability
- One-sided termination rights
- Overly broad non-compete
- Missing standard clauses (force majeure, data protection, dispute resolution, insurance)
- Vague payment terms
- Unfavorable governing law
- Unlimited indemnification

Each risk must have: severity, title, description, actionable recommendation. Link to the relevant clause_id where applicable.

## Frontend Implementation Details

### Routing (App.tsx)
- `/` → Landing page
- `/dashboard` → Dashboard (contract list + upload)
- `/contracts/:id` → Contract detail (tabs: Chat | Clauses | Risks)

### Landing Page
- Hero section: "Understand Any Contract in Seconds" with subheadline and CTA
- 3 feature cards with icons: AI Q&A, Clause Extraction, Risk Analysis
- How it works: 3 steps (Upload → Analyze → Ask)
- Professional design, fully responsive, dark mode support

### Dashboard
- Card grid of uploaded contracts
- Each card: filename, status badge (processing=yellow, ready=green, error=red), page count, risk summary, upload date
- Upload button → drag-and-drop modal with progress and processing status
- Delete contract (with confirmation)
- Empty state for first visit

### Contract Detail — Chat Tab (default)
- Left panel (65%): chat interface
  - Message bubbles (user=right, assistant=left)
  - Source citations as clickable page badges below assistant messages
  - Citation click → popover showing source text
  - Typing indicator animation while waiting
  - Input bar at bottom, disabled during processing
  - Welcome message with suggested starter questions: "What are the payment terms?", "When can this contract be terminated?", "What are my confidentiality obligations?"
- Right sidebar (35%):
  - Contract metadata (name, pages, chunks, date)
  - AI summary (if generated)
  - Action buttons: Extract Clauses, Analyze Risks
  - Status indicators for each action

### Contract Detail — Clauses Tab
- Trigger extraction if not done (button + loading state)
- Clauses grouped by type, collapsible sections
- Each clause: colored type badge, title, expandable content, page number, confidence indicator
- Filter by clause type
- Count per type

### Contract Detail — Risks Tab
- Trigger analysis if not done (button + loading state)
- Summary bar: count by severity (critical/high/medium/low) with colored badges
- Risk cards: severity badge, title, description, recommendation, linked clause
- Filter by severity
- Sort by severity (critical first)

### State Management
- **React Query (TanStack Query):** All server state — contract list, contract detail, clauses, risks, chat history. Use polling (refetchInterval: 2000) while contract status is 'processing'.
- **Zustand:** Chat input state, active tab, UI preferences.
- **Axios client:** Base URL from VITE_API_URL env var. Typed request/response functions matching backend schemas.

### TypeScript Types (types/index.ts)
Define interfaces for every API response matching the backend Pydantic schemas exactly. No `any` types anywhere.

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/contract_intel
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=contract-intelligence
R2_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=contract-intelligence
CORS_ORIGINS=http://localhost:5173
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000
```

## Docker Compose (local development)

Services:
- **api:** FastAPI on port 8000, mounts ./backend, hot reload with uvicorn --reload
- **db:** PostgreSQL 16 on port 5432, persistent volume
- **frontend:** React dev server on port 5173, mounts ./frontend

Pinecone and R2 are cloud services — no containers needed.

## Build Order

Build in this exact order. Each step should be fully working before moving to the next:

1. Project scaffolding: all config files, Docker Compose, empty FastAPI app + React app, health check endpoint working
2. Database: SQLAlchemy models, Alembic migration, verify tables created
3. R2 storage service: presigned upload URL endpoint, confirm upload endpoint, test with curl
4. PDF parsing: PyMuPDF extraction + LangChain chunking, test with a real PDF
5. Pinecone embeddings: LangChain OpenAIEmbeddings + PineconeVectorStore, batch upsert, verify in Pinecone dashboard
6. RAG chat: LangChain retrieval chain, chat endpoint, chat history, test Q&A accuracy
7. Clause extraction: LangChain structured output parser, batch processing, summary generation
8. Risk analysis: LangChain risk prompt, severity scoring, clause linking
9. Frontend landing page + dashboard + upload flow with processing status
10. Frontend contract detail page: chat interface with citations
11. Frontend clauses tab + risks tab
12. Final: CORS, error handling audit, README with architecture diagram and screenshots

## Code Standards

- Python: type hints on all functions, Pydantic v2 schemas, docstrings on all services, async/await throughout
- TypeScript: strict mode, interfaces for all data, no `any`
- Error handling: try/except with specific exceptions in Python, error boundaries in React, user-friendly messages
- Clean Architecture: routers → services → models. Routers never import SQLAlchemy directly.
- All LangChain usage should use the latest langchain-openai, langchain-pinecone, langchain-community packages (not deprecated langchain.llms or langchain.embeddings imports)

## README.md

The README must prominently feature these keywords (they map to an internship I'm applying for):
- LangChain, RAG (Retrieval-Augmented Generation), Vector Database, Pinecone
- LLM Engineering, NLP, Generative AI, Prompt Engineering
- Python, FastAPI, React, TypeScript, PostgreSQL, SQL
- Docker, Cloud Deployment (Vercel, Render, Cloudflare R2)
- OpenAI, gpt-4o-mini, Embeddings, Semantic Search

Include: project description, architecture diagram (text-based), tech stack, features list, setup instructions, screenshots placeholder, live demo link placeholder.