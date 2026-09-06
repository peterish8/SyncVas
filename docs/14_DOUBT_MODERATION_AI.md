# 14 — Doubt Moderation and AI Specification

## Goal

Reduce noise shown to the teacher without suppressing plausible academic questions.

## Pipeline

1. input validation
2. rate limit
3. deterministic noise checks
4. normalization
5. exact/near-exact duplicate check
6. AI relevance/spam classification if needed
7. accepted / uncertain / rejected / merged outcome

## Cheap checks

Reject or ask to edit when:
- empty/whitespace
- too short to carry meaning except known valid forms
- > max chars
- repeated-character spam
- emoji-only/noise
- blocked URL pattern
- known profanity/harassment pattern
- same participant rapid-repeat

Do not block “why?”, “how?”, formula fragments, or short technical terms merely for being short without context-aware logic.

## Relevance model contract

Input:
- current class title/subject
- compact current lecture context if available
- student question

Output strict JSON:
```json
{
  "academic": true,
  "relevant": true,
  "spam": false,
  "confidence": 0.91,
  "reasonCode": "related_clarification"
}
```

Do not ask whether the question contains the exact words written on the board. A comparison to a different method can be a legitimate doubt.

## Decision policy

Example starting thresholds; tune with real data:
- high confidence relevant -> accepted
- ambiguous -> uncertain queue
- high confidence non-academic/spam -> rejected

Never silently delete. Student receives a state and safe reason.

## Duplicate handling

P0: normalized exact duplicate + manual same-doubt voting.
P1: semantic similarity can suggest a likely existing doubt. Do not auto-merge at low confidence.

## Provider abstraction

Feature code calls `ai.moderateDoubt(input)`. Provider adapters handle SDK/model-specific code.

## Cost protection

- no LLM call for deterministic rejects
- per-participant and per-session AI budget guardrails
- timeout and fallback to `uncertain` rather than losing a plausible question
