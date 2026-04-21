/**
 * Step 4: Retrieval QA — Full RAG Pipeline
 *
 * Python: RetrievalQA.from_chain_type(llm=llm, chain_type="stuff", retriever=retriever)
 * LangChain JS (v1): LCEL — retriever | format_docs | prompt | llm | parser
 *
 * RAG flow:
 *   question → retriever → relevant docs → stuffed into prompt → LLM → answer
 *
 * "stuff" = all retrieved docs are concatenated directly into the prompt context.
 */
import { ChatAnthropic } from "@langchain/anthropic";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { MemoryVectorStore } from "./utils/memory-vector-store.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableLambda } from "@langchain/core/runnables";
import type { Document as LCDocument } from "@langchain/core/documents";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "OutdoorClothingCatalog.csv");

const llm = new ChatAnthropic({
  model: "claude-haiku-4-5-20251001",
  temperature: 0.0,
  anthropicApiKey: process.env.CLAUDE_API_KEY,
});

const embeddings = new HuggingFaceTransformersEmbeddings({
  model: "Xenova/all-MiniLM-L6-v2",
});

// ── 1. Load + embed documents ────────────────────────────────────────────────
const loader = new CSVLoader(filePath);
const docs = await loader.load();

console.log("Building vector index...");
const db = await MemoryVectorStore.fromDocuments(docs, embeddings);
const retriever = db.asRetriever(4);
console.log("Ready.\n");

// ── 2. Manual approach: retrieve docs, stuff into prompt, call LLM ───────────
console.log("=== Manual approach (qdocs → LLM) ===");
const query = "Please list all your shirts with sun protection in a table in markdown and summarize each one.";

const retrieved = await retriever.invoke(query);
const qdocs = retrieved.map((d) => d.pageContent).join("\n\n");

const manualResponse = await llm.invoke(`${qdocs}\n\nQuestion: ${query}`);
console.log(manualResponse.content);

// ── 3. RetrievalQA "stuff" chain via LCEL ────────────────────────────────────
console.log("\n=== RetrievalQA chain (stuff — LCEL) ===");

// "stuff" = join all doc contents into one context string
const formatDocs = (documents: LCDocument[]) =>
  documents.map((d) => d.pageContent).join("\n\n");

const qaPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant. Answer the question based only on the following context:\n\n{context}",
  ],
  ["human", "{question}"],
]);

// RetrievalQA chain: retrieve → format → prompt → llm → parse
const retrievalChain = RunnablePassthrough.assign({
  context: RunnableLambda.from((input: { question: string }) =>
    retriever.invoke(input.question).then(formatDocs)
  ),
}).pipe(qaPrompt).pipe(llm).pipe(new StringOutputParser());

const response = await retrievalChain.invoke({ question: query });
console.log(response);

// ── 4. A few more questions ───────────────────────────────────────────────────
const questions = [
  "Do you have any waterproof jackets?",
  "What products are good for sun protection?",
];

for (const q of questions) {
  console.log(`\n─── Q: ${q}`);
  const answer = await retrievalChain.invoke({ question: q });
  console.log(`A: ${answer}`);
}
