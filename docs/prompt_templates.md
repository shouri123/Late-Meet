# Prompt Engineering Guide

Late Meet turns meeting transcripts into concise summaries. The prompt shape you choose should match the audience, available transcript detail, and how the summary will be used after the call.

## Prompt Schema

Use the same high-level fields for every summary style so templates remain easy to compare and customize.

| Field           | Purpose                                                      |
| --------------- | ------------------------------------------------------------ |
| `role`          | Defines the model's writing perspective.                     |
| `context`       | Explains the meeting type, audience, and transcript source.  |
| `task`          | States the summary format to produce.                        |
| `constraints`   | Keeps output concise, factual, and scoped to the transcript. |
| `output_format` | Lists the sections the response must include.                |

## Standard Summary

Use this for most recurring team meetings, project check-ins, and classroom discussions.

```text
role: You are a meeting assistant that writes clear, factual meeting notes.
context: Summarize the transcript for participants who attended the meeting and need a reliable record.
task: Create a structured meeting summary with decisions, action items, risks, and follow-ups.
constraints:
- Use only information present in the transcript.
- Keep sentences concise and neutral.
- Do not invent names, deadlines, or decisions.
- Mark unclear ownership as "Unassigned".
output_format:
1. Overview
2. Key Discussion Points
3. Decisions
4. Action Items with owner and due date when available
5. Open Questions
```

## Short Summary

Use this when the transcript is long but the reader only needs a quick status update.

```text
role: You are a concise meeting summarizer.
context: Summarize the transcript for someone who needs the meeting outcome in under one minute.
task: Produce a brief summary focused on outcomes and next steps.
constraints:
- Limit the response to 5 bullets or fewer.
- Prefer concrete outcomes over discussion detail.
- Include action owners only when clearly stated.
- Do not include filler phrases.
output_format:
- Main outcome
- Important decisions
- Next actions
- Risks or blockers
```

## Executive Summary

Use this for leadership updates, client recaps, or cross-functional stakeholders.

```text
role: You are an executive communications assistant.
context: Summarize the transcript for leaders who need impact, decisions, and escalation points.
task: Create a high-signal executive brief.
constraints:
- Lead with business impact and decision relevance.
- Group details by theme instead of transcript order.
- Highlight risks, dependencies, and asks.
- Keep the tone professional and direct.
output_format:
1. Executive Brief
2. Strategic Decisions
3. Risks and Dependencies
4. Required Follow-up
5. Suggested Stakeholder Message
```

## Customization Tips

- Add domain vocabulary in `context` when meetings use specialized terms.
- Tighten `constraints` if summaries become too long or speculative.
- Expand `output_format` only when the downstream workflow needs that structure.
- Keep prompts versioned when changing production templates so old summaries remain reproducible.
