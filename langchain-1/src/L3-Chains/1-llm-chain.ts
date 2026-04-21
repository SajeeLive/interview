/**
 * LLMChain equivalent
 *
 * Python: LLMChain(llm=llm, prompt=prompt)
 * Modern LangChain JS: prompt.pipe(model).pipe(parser)  — the LCEL "pipe" operator IS the chain.
 */
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const chat = new ChatAnthropic({
  model: "claude-haiku-4-5-20251001",
  temperature: 0.9,
  anthropicApiKey: process.env.CLAUDE_API_KEY,
});

// The prompt — one {product} variable
const prompt = ChatPromptTemplate.fromTemplate(
  "What is the best name to describe a company that makes {product}?"
);

// chain = prompt | model | output_parser
const chain = prompt.pipe(chat).pipe(new StringOutputParser());

const product = "Queen Size Sheet Set";
console.log(`Product: ${product}`);

const result = await chain.invoke({ product });
console.log(`Company name suggestion: ${result}`);
