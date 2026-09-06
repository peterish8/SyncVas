# 15 — Post-Class AI Summary Pipeline

## MVP stance

Board persistence/export is required. AI summary is P1/P2 and must never block End Class.

## Inputs

Best available:
- final Excalidraw board export image(s)
- clean text elements extracted from scene
- class title/subject
- accepted/answered doubts
- optional periodic board snapshots

Handwritten strokes are not normal text. A multimodal model may be needed to interpret handwriting/diagrams.

## Pipeline

1. finalize durable board snapshot
2. render board to high-resolution image(s)
3. extract Excalidraw text elements
4. collect answered/high-vote doubts
5. send compact structured input to AI adapter
6. require structured notes schema
7. save summary
8. generate notes PDF asynchronously

## Output structure

- Lecture title
- Topics covered
- Key definitions/concepts
- Worked examples or derivations recognized with confidence
- Important diagrams (referenced, not fabricated)
- Common class doubts
- Revision checklist

## Hallucination controls

- Tell model to distinguish readable board content from uncertain handwriting.
- Do not invent equations/claims that are not visible or provided.
- Mark uncertain transcription.
- Prefer omission over guessing.
- Teacher should be able to regenerate or eventually edit notes.

## Failure behavior

If AI fails, saved board and basic export remain available. Export state can show `Notes generation failed — retry`.
