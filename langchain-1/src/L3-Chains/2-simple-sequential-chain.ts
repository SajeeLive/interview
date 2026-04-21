/**
 * SimpleSequentialChain equivalent
 *
 * Python: SimpleSequentialChain(chains=[chain_one, chain_two])
 * Modern LangChain JS: chain_one.pipe(chain_two)
 *
 * Each step passes its string output directly as the input to the next step.
 * Only a single input variable and single output — no named keys.
 */
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const chat = new ChatAnthropic({
  model: "claude-haiku-4-5-20251001",
  temperature: 0.9,
  anthropicApiKey: process.env.CLAUDE_API_KEY,
});

const parser = new StringOutputParser();

// Step 1: product → company name
const firstPrompt = ChatPromptTemplate.fromTemplate(
  "What is the best name to describe a company that makes {product}?"
);
const chainOne = firstPrompt.pipe(chat).pipe(parser);

// Step 2: company name → 20-word description
// The output of chainOne (a plain string) is passed as {input} by default
const secondPrompt = ChatPromptTemplate.fromTemplate(
  "Write a 20 words description for the following company: {input}"
);
const chainTwo = secondPrompt.pipe(chat).pipe(parser);

// SimpleSequentialChain: pipe the two chains together
const overallChain = chainOne.pipe(
  // wrap chainTwo so it receives the string as { input }
  async (companyName: string) => chainTwo.invoke({ input: companyName })
);

const product = "Queen Size Sheet Set";
console.log(`Product: ${product}\n`);

const companyName = await chainOne.invoke({ product });
console.log(`Step 1 — Company name: ${companyName}\n`);

const description = await overallChain.invoke({ product });
console.log(`Step 2 — Description: ${description}`);
