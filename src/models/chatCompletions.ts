/**
 * Model handlers that use OpenAI Chat Completions API (/chat/completions)
 * instead of the Responses API (/responses).
 *
 * This is required because the Nosana endpoint (Ollama-based) only supports
 * the /chat/completions endpoint, but @ai-sdk/openai v2 defaults to /responses.
 */

import { type IAgentRuntime, type GenerateTextParams, ModelType, logger } from "@elizaos/core";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

function getBaseURL(runtime: IAgentRuntime): string {
  return (
    (runtime.getSetting("OPENAI_BASE_URL") as string) ||
    (runtime.getSetting("OPENAI_API_URL") as string) ||
    "https://api.openai.com/v1"
  );
}

function getApiKey(runtime: IAgentRuntime): string {
  return (runtime.getSetting("OPENAI_API_KEY") as string) || "";
}

function getModelName(runtime: IAgentRuntime): string {
  return (
    (runtime.getSetting("OPENAI_LARGE_MODEL") as string) ||
    (runtime.getSetting("LARGE_MODEL") as string) ||
    (runtime.getSetting("MODEL_NAME") as string) ||
    "qwen3.5:27b"
  );
}

function getSmallModelName(runtime: IAgentRuntime): string {
  return (
    (runtime.getSetting("OPENAI_SMALL_MODEL") as string) ||
    (runtime.getSetting("SMALL_MODEL") as string) ||
    (runtime.getSetting("MODEL_NAME") as string) ||
    "qwen3.5:27b"
  );
}

function createClient(runtime: IAgentRuntime) {
  const baseURL = getBaseURL(runtime);
  const apiKey = getApiKey(runtime);
  return createOpenAI({ apiKey, baseURL });
}

async function generateWithChatCompletions(
  runtime: IAgentRuntime,
  params: GenerateTextParams,
  modelName: string,
  modelType: string
): Promise<string> {
  const openai = createClient(runtime);

  logger.debug(`[NosShip] ${modelType} model: ${modelName} via /chat/completions`);

  // Use openai.chat() which routes to /chat/completions
  const { text } = await generateText({
    model: openai.chat(modelName),
    prompt: params.prompt,
    system: runtime.character.system ?? undefined,
    temperature: params.temperature ?? 0.7,
    maxOutputTokens: params.maxTokens ?? 8192,
    frequencyPenalty: params.frequencyPenalty ?? 0.7,
    presencePenalty: params.presencePenalty ?? 0.7,
    stopSequences: params.stopSequences ?? [],
  });

  return text;
}

export async function handleTextSmall(runtime: IAgentRuntime, params: GenerateTextParams): Promise<string> {
  const modelName = getSmallModelName(runtime);
  return generateWithChatCompletions(runtime, params, modelName, ModelType.TEXT_SMALL);
}

export async function handleTextLarge(runtime: IAgentRuntime, params: GenerateTextParams): Promise<string> {
  const modelName = getModelName(runtime);
  return generateWithChatCompletions(runtime, params, modelName, ModelType.TEXT_LARGE);
}
