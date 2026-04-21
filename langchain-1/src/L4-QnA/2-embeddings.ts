/**
 * Step 2: Embeddings
 *
 * Python: OpenAIEmbeddings() → embeddings.embed_query("Hi my name is Harrison")
 * LangChain JS: HuggingFaceTransformersEmbeddings — runs a small model locally,
 *               no API key required.
 *
 * An embedding is a vector of numbers that captures the *semantic meaning* of text.
 * Similar sentences produce vectors that are close together in space.
 * This is what makes similarity search possible.
 */
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";

// "Xenova/all-MiniLM-L6-v2" is a small (22MB) but capable sentence embedding model.
// It downloads once and is cached locally in node_modules/.cache
const embeddings = new HuggingFaceTransformersEmbeddings({
  model: "Xenova/all-MiniLM-L6-v2",
});

console.log("Embedding model: Xenova/all-MiniLM-L6-v2 (runs locally, no API key needed)");
console.log("(First run downloads ~22MB — subsequent runs use cache)\n");

const sampleText = "Hi my name is Harrison";
console.log(`Embedding query: "${sampleText}"`);

const embed = await embeddings.embedQuery(sampleText);

console.log(`Vector length: ${embed.length}`);
console.log(`First 5 values: [${embed.slice(0, 5).map((v) => v.toFixed(6)).join(", ")}]`);

// Show that similar sentences have close vectors
const { default: cosineSimilarity } = await import("./utils/cosine-similarity.js");

const sentenceA = "I love outdoor hiking in the mountains";
const sentenceB = "I enjoy trekking in the wilderness";
const sentenceC = "The quarterly earnings report is due Friday";

const [vecA, vecB, vecC] = await Promise.all([
  embeddings.embedQuery(sentenceA),
  embeddings.embedQuery(sentenceB),
  embeddings.embedQuery(sentenceC),
]);

console.log("\n=== Semantic similarity demo ===");
console.log(`"${sentenceA}"`);
console.log(`"${sentenceB}" → similarity: ${cosineSimilarity(vecA, vecB).toFixed(4)} (high — same topic)`);
console.log(`"${sentenceC}" → similarity: ${cosineSimilarity(vecA, vecC).toFixed(4)} (low  — different topic)`);
