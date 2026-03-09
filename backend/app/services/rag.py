"""RAG pipeline: LangChain LCEL retrieval chain with chat history support."""

import logging
from typing import Any

from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import AIMessage, HumanMessage
from langchain_openai import ChatOpenAI

from app.config import settings
from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a contract analysis expert. Answer the user's question based ONLY on the provided contract context. Follow these rules:
1. If the answer is in the context, provide a clear, precise answer and cite the page number(s).
2. If the answer is NOT in the context, say "I couldn't find information about that in this contract."
3. Never make up information that isn't in the context.
4. Be specific — quote relevant contract language when helpful.
5. Format your answer clearly with paragraphs. Use bullet points only if listing multiple items.

Context:
{context}"""


def _build_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.1,
        openai_api_key=settings.openai_api_key,
    )


def _build_chain(namespace: str) -> Any:
    """Build a LangChain LCEL retrieval chain for a given Pinecone namespace.

    Uses similarity_score_threshold retrieval (top-5, score >= 0.7).
    Chat history is injected directly into the prompt for follow-up support.
    """
    llm = _build_llm()

    vector_store = get_vector_store(namespace)
    retriever = vector_store.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs={"k": 5, "score_threshold": 0.7},
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
    ])

    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    return create_retrieval_chain(retriever, question_answer_chain)


async def ask(
    question: str,
    namespace: str,
    chat_history: list[dict[str, str]],
) -> dict[str, Any]:
    """Run the RAG pipeline for a user question.

    Args:
        question: The user's natural language question
        namespace: Pinecone namespace for this contract (contract_{id})
        chat_history: Last N messages as list of {"role": "user"|"assistant", "content": "..."}

    Returns:
        Dict with keys:
            answer (str): The LLM's answer
            sources (list): [{page, text, score}] from retrieved documents
    """
    chain = _build_chain(namespace)

    # Convert stored messages to LangChain message objects (last 10 only)
    lc_history: list[Any] = []
    for msg in chat_history[-10:]:
        if msg["role"] == "user":
            lc_history.append(HumanMessage(content=msg["content"]))
        else:
            lc_history.append(AIMessage(content=msg["content"]))

    result = await chain.ainvoke({
        "input": question,
        "chat_history": lc_history,
    })

    answer: str = result.get("answer", "")
    source_docs = result.get("context", [])

    sources = []
    for doc in source_docs:
        meta = doc.metadata
        sources.append({
            "page": meta.get("page_number", 0),
            "text": meta.get("chunk_text", doc.page_content),
            "score": meta.get("score", 0.0),
        })

    logger.info("RAG answered question in namespace %s, %d source docs", namespace, len(sources))
    return {"answer": answer, "sources": sources}
