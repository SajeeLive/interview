/**
 * SequentialChain equivalent
 *
 * Python: SequentialChain(chains=[...], input_variables=[...], output_variables=[...])
 * Modern LangChain JS: RunnableLambda that runs each step and threads named keys forward.
 *
 * Unlike SimpleSequentialChain, each step has named inputs/outputs and multiple
 * intermediate values are passed forward through the chain.
 *
 * Pipeline:
 *   Review → English_Review → summary
 *         ↘                        ↘
 *           language       →   followup_message
 */
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableLambda } from "@langchain/core/runnables";

const chat = new ChatAnthropic({
  model: "claude-haiku-4-5-20251001",
  temperature: 0.9,
  anthropicApiKey: process.env.CLAUDE_API_KEY,
});

const parser = new StringOutputParser();

// Step 1: Translate Review → English_Review
const translateChain = ChatPromptTemplate.fromTemplate(
  "Translate the following review to english:\n\n{Review}"
).pipe(chat).pipe(parser);

// Step 2: Summarise English_Review → summary
const summariseChain = ChatPromptTemplate.fromTemplate(
  "Can you summarize the following review in 1 sentence:\n\n{English_Review}"
).pipe(chat).pipe(parser);

// Step 3: Detect language of original Review → language
const languageChain = ChatPromptTemplate.fromTemplate(
  "What language is the following review:\n\n{Review}"
).pipe(chat).pipe(parser);

// Step 4: Write follow-up in the original language → followup_message
const followupChain = ChatPromptTemplate.fromTemplate(
  "Write a follow up response to the following summary in the specified language:\n\nSummary: {summary}\n\nLanguage: {language}"
).pipe(chat).pipe(parser);

// SequentialChain: run each step, thread all named keys forward
const overallChain = RunnableLambda.from(async ({ Review }: { Review: string }) => {
  const English_Review = await translateChain.invoke({ Review });

  // Steps 2 and 3 are independent — run in parallel
  const [summary, language] = await Promise.all([
    summariseChain.invoke({ English_Review }),
    languageChain.invoke({ Review }),
  ]);

  const followup_message = await followupChain.invoke({ summary, language });

  return { Review, English_Review, summary, language, followup_message };
});

// A French review (row 5 from the tutorial's Data.csv)
const review = `Je trouve que ce produit est vraiment excellent. La qualité est parfaite, \
la livraison a été rapide et le service client est très réactif. \
Je le recommande vivement à tous ceux qui cherchent un bon rapport qualité-prix.`;

console.log("=== Input Review ===");
console.log(review);
console.log();

const result = await overallChain.invoke({ Review: review });

console.log("=== English_Review ===");
console.log(result.English_Review);
console.log();

console.log("=== Summary ===");
console.log(result.summary);
console.log();

console.log("=== Language ===");
console.log(result.language);
console.log();

console.log("=== Follow-up Message ===");
console.log(result.followup_message);
