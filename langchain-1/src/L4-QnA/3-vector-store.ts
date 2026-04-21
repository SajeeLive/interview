/**
 * Step 3: Vector Store + Similarity Search
 *
 * Python: DocArrayInMemorySearch.from_documents(docs, embeddings)
 *         db.similarity_search(query)
 *
 * LangChain JS: MemoryVectorStore — a pure-JS in-memory vector store.
 *               No native bindings or external service needed.
 *
 * What happens:
 *   1. Each document's text is embedded into a vector
 *   2. All vectors are stored in an index (HNSWLib)
 *   3. At query time, the query is embedded and the nearest vectors are returned
 */
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "OutdoorClothingCatalog.csv");

const embeddings = new HuggingFaceTransformersEmbeddings({
  model: "Xenova/all-MiniLM-L6-v2",
});

// Load documents
const loader = new CSVLoader(filePath);
const docs = await loader.load();
console.log(`Loaded ${docs.length} documents`);

// Build the vector store — embeds every document
console.log("Building vector index (embedding all documents)...");
const db = await MemoryVectorStore.fromDocuments(docs, embeddings);
console.log("Vector store ready.\n");

// Similarity search
const query = "Please suggest a shirt with sun blocking";
console.log(`Query: "${query}"\n`);

const results = await db.similaritySearch(query, 4); // top 4 results

console.log(`Top ${results.length} similar documents:`);
results.forEach((doc, i) => {
  console.log(`\n[${i + 1}] ${doc.metadata.source} (row ${doc.metadata.line})`);
  console.log(`    ${doc.pageContent.slice(0, 120)}...`);
});

// Similarity search with scores
console.log("\n=== With relevance scores ===");
const scored = await db.similaritySearchWithScore(query, 4);
scored.forEach(([doc, score], i) => {
  // Cosine similarity — higher = more similar (range: -1 to 1)
  console.log(`[${i + 1}] score: ${score.toFixed(4)} | ${doc.pageContent.slice(0, 80)}...`);
});
