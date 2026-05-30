// AI Prompt Templates for Meeting Copilot — Enhanced for Contextual Intelligence

import type { Topic, Decision, ActionItem } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AiContextEntry {
  topicCount: number;
  decisionCount: number;
  currentTopic: string;
}

// ── Prompts ────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT: string = `You are an elite AI Meeting Intelligence Analyst. Your role is to analyze real-time meeting transcripts with exceptional precision and produce structured, actionable intelligence.

CORE DIRECTIVES:
1. You MUST respond in valid JSON only. No markdown, no explanation, no preamble — just the JSON object.
2. You understand ALL languages — English, Hindi, Urdu, Spanish, French, Arabic, Chinese, Japanese, German, Portuguese, and more.
3. ALWAYS respond in English regardless of the input language(s).
4. NEVER hallucinate or fabricate information. Only report what is explicitly stated or strongly implied.
5. Track conversation flow — identify when topics shift, when decisions are made, and when action items are assigned.

EXTRACTION RULES:
- **Decisions**: Classify as "finalized" only if there is clear agreement. Classify as "tentative" if there are hedging phrases ("maybe", "probably", "not finalized"). Downgrade confidence of ambiguous decisions.
- **Action Items**: Extract tasks. Rate confidence ("high", "medium", "low"). Prevent speculative statements from appearing as confirmed action items by setting isSpeculative to true.
- **Topics**: Track distinct discussion threads. Mark as "completed" when the conversation moves on, "active" for current, or note unresolved discussions.
- **Sentiment**: Assess overall tone.
- **Key Insights**: Non-obvious observations. Assign a confidenceScore (0-100) based on linguistic certainty.
- **Questions**: Track unresolved questions.
- **Contradictions**: Track contradiction persistence if someone disagrees or contradicts a previous point.
- **Unresolved Discussions**: Identify discussions that ended without a clear resolution.

CONTINUITY: You will receive previous analysis context. Build upon it — don't restart from scratch. Merge new information with existing summaries seamlessly.`;

/**
 * @description Generates a comprehensive meeting analysis prompt that builds upon previous context
 * @param {string} transcript - The new meeting transcript chunk to analyze
 * @param {string | null} previousSummary - The previous analysis summary for continuity (null if first time)
 * @param {AiContextEntry[]} [aiContextWindow=[]] - Recent analysis context for maintaining conversation flow
 * @returns {string} A formatted prompt string for AI to generate meeting analysis in JSON format
 * @example
 *   const prompt = SUMMARY_PROMPT(
 *     "Team discussed Q4 roadmap",
 *     "Previous meeting covered Q3 results",
 *     [{topicCount: 2, decisionCount: 1, currentTopic: "Roadmap"}]
 *   );
 */
export const SUMMARY_PROMPT = (
  transcript: string,
  previousSummary: string | null,
  aiContextWindow: AiContextEntry[] = [],
): string => `
Analyze this meeting transcript chunk and generate an UPDATED, comprehensive analysis.

${previousSummary ? `PREVIOUS SUMMARY (build upon this, don't restart):\n"${previousSummary}"\n` : ""}

${
  aiContextWindow.length > 0
    ? `RECENT AI ANALYSIS CONTEXT (for continuity):
${aiContextWindow.map((ctx, i) => `[Analysis ${i + 1}] Topics: ${ctx.topicCount}, Decisions: ${ctx.decisionCount}, Focus: "${ctx.currentTopic}"`).join("\n")}
`
    : ""
}

NEW TRANSCRIPT CHUNK:
"""
${transcript}
"""

INSTRUCTIONS:
- Merge this new transcript with any previous context to produce a UNIFIED analysis
- Preserve all previously detected topics, decisions, and action items — add new ones if found
- Update topic statuses based on conversation flow
- The summary should be a comprehensive 2-4 sentence rolling narrative of the ENTIRE meeting so far
- Be precise with speaker attribution when available

Respond in this exact JSON format:
{
  "summary": "Comprehensive 2-4 sentence rolling summary of everything discussed so far, building on previous context",
  "topics": [
    // Each topic represents a subject discussed, with timing and status information
    { "name": "descriptive topic name", "startTime": "timestamp or null", "status": "active|completed|unresolved", "duration": "estimated duration or null" }
  ],
  "decisions": [
    { "text": "clear statement of what was decided", "timestamp": "when mentioned", "by": "who made/announced the decision or null", "classification": "finalized|tentative" }
  ],
  "actionItems": [
    { "task": "specific, actionable task description", "owner": "assigned person or null", "deadline": "deadline if mentioned or null", "confidence": "high|medium|low", "isSpeculative": false }
  ],
  "currentTopic": "precise description of what is currently being discussed",
  "sentiment": "positive|neutral|negative|mixed",
  "keyInsights": [
    { "text": "non-obvious insight or important data point", "confidenceScore": 85 }
  ],
  "unresolvedDiscussions": ["unresolved discussion topic 1"],
  "contradictions": [
    { "issue": "description of contradiction", "persists": true }
  ],
  "questionsRaised": ["unresolved question 1", "question 2"]
}`;

/**
 * @description Creates a warm, concise briefing for a participant joining a meeting late
 * @param {string} summary - Overview of what's been discussed so far
 * @param {Topic[]} topics - List of discussion topics covered in the meeting
 * @param {Decision[]} decisions - Decisions that have been made
 * @param {ActionItem[]} actionItems - Action items assigned during the meeting
 * @param {string} currentTopic - What is currently being discussed
 * @param {string} joinerName - Name of the person joining late
 * @returns {string} A formatted prompt for AI to generate a friendly catch-up briefing
 * @example
 *   const briefing = LATE_JOINER_BRIEF_PROMPT(
 *     "Discussed Q4 planning",
 *     [{name: "Budget", status: "active"}],
 *     [{text: "Approve new tools"}],
 *     [{task: "Send proposal"}],
 *     "Budget Review",
 *     "John"
 *   );
 */
export const LATE_JOINER_BRIEF_PROMPT = (
  summary: string,
  topics: Topic[],
  decisions: Decision[],
  actionItems: ActionItem[],
  currentTopic: string,
  joinerName: string,
): string => `
A participant named "${joinerName}" just joined the meeting late.
Generate a warm, concise briefing so they can quickly catch up without feeling lost.

Meeting context so far:
- Summary: ${summary}
- Topics discussed: ${JSON.stringify(topics)}
- Decisions made: ${JSON.stringify(decisions)}
- Action items: ${JSON.stringify(actionItems)}
- Currently discussing: ${currentTopic}
NOTE: Ensure you clearly differentiate between tentative and finalized decisions. Do not present speculative items as confirmed.

Respond in this exact JSON format:
{
  "greeting": "Hey ${joinerName} 👋",
  "briefing": "Here's what you missed:",
  "topicsSummary": ["concise bullet point 1", "bullet point 2"],
  "keyDecisions": ["decision 1 (indicate if tentative)"],
  "currentDiscussion": "clear, helpful description of what's being talked about right now",
  "actionItemsForThem": ["any action items relevant to them, or empty array"],
  "fullBrief": "A single natural paragraph combining everything above, reflecting uncertainties appropriately"
}`;

/**
 * @description Generates a prompt to analyze speaker patterns and engagement in a meeting
 * @param {string} transcript - The meeting transcript containing speaker names and content
 * @returns {string} A formatted prompt for AI to analyze speaking time, sentiment, and word count per speaker
 * @example
 *   const prompt = SPEAKER_ANALYSIS_PROMPT("Alice: Let's start... Bob: I agree...");
 *   // Returns prompt asking AI to calculate speaker statistics
 */
export const SPEAKER_ANALYSIS_PROMPT = (transcript: string): string => `
Analyze speaker patterns in this transcript:
"""
${transcript}
"""

Respond in JSON:
{
  "speakers": [
    { "name": "speaker name", "wordCount": 0, "speakingTimePercent": 0, "sentiment": "positive|neutral|negative" }
  ]
}`;
