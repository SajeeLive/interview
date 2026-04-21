import { ChatAnthropic } from "@langchain/anthropic";
import {
  InMemoryChatMessageHistory,
  BaseChatMessageHistory,
} from "@langchain/core/chat_history";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";

const MODEL = "claude-haiku-4-5-20251001";
const API_KEY = process.env.CLAUDE_API_KEY;

const chat = new ChatAnthropic({
  model: MODEL,
  temperature: 0.0,
  anthropicApiKey: API_KEY,
});

// Helper to build a conversation chain with a given history store
function makeChain(getHistory: (sessionId: string) => BaseChatMessageHistory) {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant."],
    new MessagesPlaceholder("history"),
    ["human", "{input}"],
  ]);

  return new RunnableWithMessageHistory({
    runnable: prompt.pipe(chat).pipe(new StringOutputParser()),
    getMessageHistory: getHistory,
    inputMessagesKey: "input",
    historyMessagesKey: "history",
  });
}

async function say(
  chain: RunnableWithMessageHistory<{ input: string }, string>,
  input: string,
  sessionId = "default"
): Promise<string> {
  const response = await chain.invoke(
    { input },
    { configurable: { sessionId } }
  );
  console.log(`Human: ${input}`);
  console.log(`AI:    ${response}\n`);
  return response;
}

// ─────────────────────────────────────────────
// Part 1: ConversationBufferMemory
// Keeps the full conversation history, every turn.
// ─────────────────────────────────────────────
console.log("=== ConversationBufferMemory ===");

const bufferStore = new InMemoryChatMessageHistory();
const bufferChain = makeChain(() => bufferStore);

await say(bufferChain, "Hi, my name is Andrew");
await say(bufferChain, "What is 1+1?");
await say(bufferChain, "What is my name?"); // remembers "Andrew"

// Inspect the raw buffer
console.log("Buffer contents:");
const bufferMessages = await bufferStore.getMessages();
bufferMessages.forEach((m) =>
  console.log(`  [${m.type}]: ${m.content}`)
);

// Manual save_context equivalent
console.log("\n--- Manual save_context ---");
const manualStore = new InMemoryChatMessageHistory();
await manualStore.addMessage(new HumanMessage("Hi"));
await manualStore.addMessage(new AIMessage("What's up"));
await manualStore.addMessage(new HumanMessage("Not much, just hanging"));
await manualStore.addMessage(new AIMessage("Cool"));

const manualMessages = await manualStore.getMessages();
console.log("Memory variables:");
manualMessages.forEach((m) =>
  console.log(`  [${m.type}]: ${m.content}`)
);

// ─────────────────────────────────────────────
// Part 2: ConversationBufferWindowMemory (k=1)
// Keeps only the last k human+AI exchange pairs.
// ─────────────────────────────────────────────
console.log("\n=== ConversationBufferWindowMemory (k=1) ===");

class WindowChatMessageHistory extends InMemoryChatMessageHistory {
  constructor(private k: number) {
    super();
  }

  override async getMessages(): Promise<BaseMessage[]> {
    const all = await super.getMessages();
    // Keep only the last k * 2 messages (k human+AI pairs)
    return all.slice(-(this.k * 2));
  }
}

const windowStore = new WindowChatMessageHistory(1);
const windowChain = makeChain(() => windowStore);

await say(windowChain, "Hi, my name is Andrew");
await say(windowChain, "What is 1+1?");
await say(windowChain, "What is my name?"); // forgets "Andrew" — only last 1 exchange kept

// ─────────────────────────────────────────────
// Part 3: ConversationTokenBufferMemory
// Drops oldest messages once total tokens exceed the limit.
// ─────────────────────────────────────────────
console.log("\n=== ConversationTokenBufferMemory (max_token_limit=60) ===");

function estimateTokens(text: string): number {
  // Rough approximation: ~4 chars per token
  return Math.ceil(text.length / 4);
}

class TokenBufferChatMessageHistory extends InMemoryChatMessageHistory {
  constructor(private maxTokens: number) {
    super();
  }

  override async getMessages(): Promise<BaseMessage[]> {
    const all = await super.getMessages();
    let total = 0;
    const kept: BaseMessage[] = [];
    // Walk from newest → oldest, keep what fits
    for (let i = all.length - 1; i >= 0; i--) {
      const tokens = estimateTokens(all[i].content as string);
      if (total + tokens > this.maxTokens) break;
      total += tokens;
      kept.unshift(all[i]);
    }
    return kept;
  }
}

const tokenStore = new TokenBufferChatMessageHistory(60);
await tokenStore.addMessage(new HumanMessage("AI is what?!"));
await tokenStore.addMessage(new AIMessage("Amazing!"));
await tokenStore.addMessage(new HumanMessage("Backpropagation is what?"));
await tokenStore.addMessage(new AIMessage("Beautiful!"));
await tokenStore.addMessage(new HumanMessage("Chatbots are what?"));
await tokenStore.addMessage(new AIMessage("Charming!"));

console.log("Token-limited memory (oldest dropped when over limit):");
const tokenMessages = await tokenStore.getMessages();
tokenMessages.forEach((m) =>
  console.log(`  [${m.type}]: ${m.content}`)
);

// ─────────────────────────────────────────────
// Part 4: ConversationSummaryBufferMemory
// Summarizes old messages via the LLM when token limit is exceeded.
// ─────────────────────────────────────────────
console.log("\n=== ConversationSummaryBufferMemory (max_token_limit=100) ===");

class SummaryBufferChatMessageHistory extends InMemoryChatMessageHistory {
  private summary = "";

  constructor(
    private maxTokens: number,
    private llm: ChatAnthropic
  ) {
    super();
  }

  private async summarizeMessages(messages: BaseMessage[]): Promise<string> {
    const transcript = messages
      .map((m) => `${m.type}: ${m.content}`)
      .join("\n");
    const prompt = `Progressively summarize the lines of conversation provided, adding onto the previous summary returning a new summary.

Previous summary: ${this.summary}
New lines:
${transcript}

New summary:`;
    const result = await this.llm.invoke(prompt);
    return result.content as string;
  }

  override async addMessage(message: BaseMessage): Promise<void> {
    await super.addMessage(message);
    await this.trimIfNeeded();
  }

  private async trimIfNeeded(): Promise<void> {
    const all = await super.getMessages();
    const totalTokens = all.reduce(
      (sum, m) => sum + estimateTokens(m.content as string),
      0
    );

    if (totalTokens > this.maxTokens) {
      // Summarize the oldest half, keep the newest half
      const splitAt = Math.floor(all.length / 2);
      const toSummarize = all.slice(0, splitAt);
      const toKeep = all.slice(splitAt);

      this.summary = await this.summarizeMessages(toSummarize);
      await super.clear();
      for (const m of toKeep) await super.addMessage(m);
    }
  }

  override async getMessages(): Promise<BaseMessage[]> {
    const messages = await super.getMessages();
    if (!this.summary) return messages;
    // Prepend summary as a system context message
    return [new AIMessage(`[Summary of earlier conversation]: ${this.summary}`), ...messages];
  }
}

const schedule =
  "There is a meeting at 8am with your product team. " +
  "You will need your powerpoint presentation prepared. " +
  "9am-12pm have time to work on your LangChain project which will go quickly " +
  "because LangChain is such a powerful tool. " +
  "At Noon, lunch at the italian restaurant with a customer who is driving " +
  "from over an hour away to meet you to understand the latest in AI. " +
  "Be sure to bring your laptop to show the latest LLM demo.";

const summaryStore = new SummaryBufferChatMessageHistory(100, chat);
await summaryStore.addMessage(new HumanMessage("Hello"));
await summaryStore.addMessage(new AIMessage("What's up"));
await summaryStore.addMessage(new HumanMessage("Not much, just hanging"));
await summaryStore.addMessage(new AIMessage("Cool"));
await summaryStore.addMessage(new HumanMessage("What is on the schedule today?"));
await summaryStore.addMessage(new AIMessage(schedule));

console.log("Summary memory contents:");
const summaryMessages = await summaryStore.getMessages();
summaryMessages.forEach((m) =>
  console.log(`  [${m.type}]: ${(m.content as string).slice(0, 120)}...`)
);

const summaryChain = makeChain(() => summaryStore);
await say(summaryChain, "What would be a good demo to show?");
