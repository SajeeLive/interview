import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

const MODEL = "claude-haiku-4-5-20251001";
const API_KEY = process.env.CLAUDE_API_KEY;

const customerEmail = `
Arrr, I be fuming that me blender lid flew off and splattered me kitchen walls
with smoothie! And to make matters worse, the warranty don't cover the cost of
cleaning up me kitchen. I need yer help right now, matey!
`;



// ─────────────────────────────────────────────
// Part 2: LangChain — Model + Prompt Template
// ─────────────────────────────────────────────

const chat = new ChatAnthropic({
  model: MODEL,
  temperature: 0.0,
  anthropicApiKey: API_KEY,
});

const templateString = `Translate the text that is delimited by triple backticks \
into a style that is {style}. \
text: \`\`\`{text}\`\`\`
`;

const promptTemplate = ChatPromptTemplate.fromTemplate(templateString);

// Customer email → calm English
const customerStyle = "American English in a calm and respectful tone";
const customerMessages = await promptTemplate.formatMessages({
  style: customerStyle,
  text: customerEmail,
});

console.log("\n=== Part 2a: LangChain — customer email translation ===");
const customerResponse = await chat.invoke(customerMessages);
console.log(customerResponse.content);

// Service reply → pirate English
const serviceReply = `Hey there customer, the warranty does not cover \
cleaning expenses for your kitchen because it's your fault that \
you misused your blender by forgetting to put the lid on before \
starting the blender. Tough luck! See ya!`;

const servicePirateStyle = "a polite tone that speaks in English Pirate";
const serviceMessages = await promptTemplate.formatMessages({
  style: servicePirateStyle,
  text: serviceReply,
});

console.log("\n=== Part 2b: LangChain — service reply in pirate ===");
const serviceResponse = await chat.invoke(serviceMessages);
console.log(serviceResponse.content);

// ─────────────────────────────────────────────
// Part 3: Output Parsers
// ─────────────────────────────────────────────

const customerReview = `\
This leaf blower is pretty amazing. It has four settings: \
candle blower, gentle breeze, windy city, and tornado. \
It arrived in two days, just in time for my wife's anniversary present. \
I think my wife liked it so much she was speechless. \
So far I've been the only one using it, and I've been \
using it every other morning to clear the leaves on our lawn. \
It's slightly more expensive than the other leaf blowers \
out there, but I think it's worth it for the extra features.`;

// Define the output schema with Zod
const reviewSchema = z.object({
  gift: z
    .boolean()
    .describe(
      "Was the item purchased as a gift for someone else? True if yes, False if not or unknown."
    ),
  delivery_days: z
    .number()
    .describe(
      "How many days did it take for the product to arrive? Output -1 if not found."
    ),
  price_value: z
    .string()
    .describe(
      "Any sentences about the value or price, as a comma-separated list."
    ),
});

const outputParser = StructuredOutputParser.fromZodSchema(reviewSchema);
const formatInstructions = outputParser.getFormatInstructions();

const reviewTemplate = `\
For the following text, extract the following information:

gift: Was the item purchased as a gift for someone else? \
Answer True if yes, False if not or unknown.

delivery_days: How many days did it take for the product to arrive? \
If this information is not found, output -1.

price_value: Extract any sentences about the value or price, \
and output them as a comma separated list.

text: {text}

{format_instructions}
`;

const reviewPrompt = ChatPromptTemplate.fromTemplate(reviewTemplate);
const reviewMessages = await reviewPrompt.formatMessages({
  text: customerReview,
  format_instructions: formatInstructions,
});

console.log("\n=== Part 3: Output Parser ===");
const reviewResponse = await chat.invoke(reviewMessages);
const outputDict = await outputParser.parse(reviewResponse.content as string);
console.log(outputDict);
console.log("delivery_days:", outputDict.delivery_days);
