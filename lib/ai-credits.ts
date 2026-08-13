export type AiOperation = "ASSISTANT_REPLY" | "PROFILE_ANALYSIS" | "PROGRAM_GENERATION";

export type AiUsage = { inputTokens: number; outputTokens: number; thoughtsTokens?: number };

const POLICIES = {
  ASSISTANT_REPLY: { inputWeight: 0.03, outputWeight: 0.15, thinkingWeight: 0.05, minimum: 8, maximum: 120 },
  PROFILE_ANALYSIS: { inputWeight: 0.04, outputWeight: 0.2, thinkingWeight: 0.06, minimum: 80, maximum: 600 },
  PROGRAM_GENERATION: { inputWeight: 0.04, outputWeight: 0.2, thinkingWeight: 0.06, minimum: 120, maximum: 900 },
} as const;

export function aiCreditLimit(operation: AiOperation, complexity = 1) {
  if (operation !== "PROGRAM_GENERATION") return POLICIES[operation].maximum;
  return Math.min(POLICIES.PROGRAM_GENERATION.maximum, 300 + Math.max(1, Math.min(4, complexity)) * 150);
}

export function minimumAiCredits(operation: AiOperation) {
  return POLICIES[operation].minimum;
}

export function calculateAiCredits(operation: AiOperation, usage: AiUsage, complexity = 1) {
  const policy = POLICIES[operation];
  const input = Math.max(0, Math.round(usage.inputTokens || 0));
  const output = Math.max(0, Math.round(usage.outputTokens || 0));
  const thinking = Math.max(0, Math.round(usage.thoughtsTokens || 0));
  if (input === 0 && output === 0 && thinking === 0) return 0;
  const weighted = Math.ceil(input * policy.inputWeight + output * policy.outputWeight + thinking * policy.thinkingWeight);
  return Math.min(aiCreditLimit(operation, complexity), Math.max(policy.minimum, weighted));
}

export const AI_CREDIT_EXPLANATION = "Входящий контекст расходуется дешевле готового ответа; у каждой операции есть жёсткий предел списания.";
