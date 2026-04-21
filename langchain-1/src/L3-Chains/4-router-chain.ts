/**
 * Router Chain equivalent
 *
 * Python: MultiPromptChain(router_chain, destination_chains, default_chain)
 * Modern LangChain JS: manual router using LCEL — the LLM classifies the input,
 * then we dispatch to the matching specialist chain.
 *
 * Flow:
 *   input → router LLM → { destination, next_inputs }
 *                              ↓
 *                   specialist chain (physics / math / history / cs / default)
 */
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableLambda } from "@langchain/core/runnables";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";

const chat = new ChatAnthropic({
  model: "claude-haiku-4-5-20251001",
  temperature: 0.0,
  anthropicApiKey: process.env.CLAUDE_API_KEY,
});

const parser = new StringOutputParser();

// ── Specialist prompts ────────────────────────────────────────────────────────

const specialists: Record<string, { description: string; prompt: string }> = {
  physics: {
    description: "Good for answering questions about physics",
    prompt: `You are a very smart physics professor. You are great at answering questions \
about physics in a concise and easy to understand manner. When you don't know the \
answer to a question you admit that you don't know.

Here is a question:
{input}`,
  },
  math: {
    description: "Good for answering math questions",
    prompt: `You are a very good mathematician. You are great at answering math questions. \
You are so good because you are able to break down hard problems into their component \
parts, answer the component parts, and then put them together to answer the broader question.

Here is a question:
{input}`,
  },
  history: {
    description: "Good for answering history questions",
    prompt: `You are a very good historian. You have an excellent knowledge of and \
understanding of people, events and contexts from a range of historical periods. \
You have the ability to think, reflect, debate, discuss and evaluate the past.

Here is a question:
{input}`,
  },
  "computer science": {
    description: "Good for answering computer science questions",
    prompt: `You are a successful computer scientist. You have a passion for creativity, \
collaboration, forward-thinking, confidence, strong problem-solving capabilities, \
understanding of theories and algorithms, and excellent communication skills.

Here is a question:
{input}`,
  },
};

// Build a map of specialist chains
const destinationChains: Record<
  string,
  (input: string) => Promise<string>
> = {};

for (const [name, { prompt }] of Object.entries(specialists)) {
  const chain = ChatPromptTemplate.fromTemplate(prompt)
    .pipe(chat)
    .pipe(parser);
  destinationChains[name] = (input: string) => chain.invoke({ input });
}

// Default chain — no specialist matched
const defaultChain = ChatPromptTemplate.fromTemplate("{input}")
  .pipe(chat)
  .pipe(parser);

// ── Router ────────────────────────────────────────────────────────────────────

const destinationList = Object.entries(specialists)
  .map(([name, { description }]) => `${name}: ${description}`)
  .join("\n");

const routerSchema = z.object({
  destination: z
    .string()
    .describe(
      `The specialist to route to. Must be one of: ${Object.keys(specialists).join(", ")}. Use "DEFAULT" if none fit.`
    ),
  next_inputs: z
    .string()
    .describe("The (potentially reworded) question to pass to the specialist"),
});

const routerOutputParser = StructuredOutputParser.fromZodSchema(routerSchema);

const routerPrompt = ChatPromptTemplate.fromTemplate(
  `Given the input, select the most suitable specialist to answer it.
Available specialists:
${destinationList}

{format_instructions}

Input: {input}`
);

const routerChain = routerPrompt.pipe(chat).pipe(routerOutputParser);

// ── Full router chain ─────────────────────────────────────────────────────────

const multiPromptChain = RunnableLambda.from(async (input: string) => {
  const formatInstructions = routerOutputParser.getFormatInstructions();

  const { destination, next_inputs } = await routerChain.invoke({
    input,
    format_instructions: formatInstructions,
  });

  console.log(`  → routed to: "${destination}"`);
  console.log(`  → next_inputs: "${next_inputs}"\n`);

  const dest = destination.toLowerCase();
  const handler = destinationChains[dest];

  if (handler) {
    return handler(next_inputs);
  }
  return defaultChain.invoke({ input: next_inputs });
});

// ── Run examples ──────────────────────────────────────────────────────────────

const questions = [
  "What is black body radiation?",
  "What is 2 + 2?",
  "Why does every cell in our body contain DNA?",
];

for (const question of questions) {
  console.log(`Question: ${question}`);
  const answer = await multiPromptChain.invoke(question);
  console.log(`Answer: ${answer}\n`);
  console.log("─".repeat(60) + "\n");
}
