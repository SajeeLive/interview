import type { Embeddings } from "@langchain/core/embeddings";
import type { Document } from "@langchain/core/documents";
import cosineSimilarity from "./cosine-similarity.js";

interface VectorEntry {
  doc: Document;
  vector: number[];
}

/**
 * Pure in-memory vector store — no native bindings required.
 * Equivalent to DocArrayInMemorySearch / MemoryVectorStore.
 */
export class MemoryVectorStore {
  private entries: VectorEntry[] = [];

  constructor(private embeddings: Embeddings) {}

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings
  ): Promise<MemoryVectorStore> {
    const store = new MemoryVectorStore(embeddings);
    const texts = docs.map((d) => d.pageContent);
    const vectors = await embeddings.embedDocuments(texts);
    vectors.forEach((vector, i) => store.entries.push({ doc: docs[i], vector }));
    return store;
  }

  async similaritySearch(query: string, k = 4): Promise<Document[]> {
    return (await this.similaritySearchWithScore(query, k)).map(([doc]) => doc);
  }

  async similaritySearchWithScore(
    query: string,
    k = 4
  ): Promise<[Document, number][]> {
    const queryVec = await this.embeddings.embedQuery(query);
    return this.entries
      .map(({ doc, vector }) => [doc, cosineSimilarity(queryVec, vector)] as [Document, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, k);
  }

  asRetriever(k = 4) {
    return {
      invoke: (query: string) => this.similaritySearch(query, k),
    };
  }
}
