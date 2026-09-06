import { describe, expect, it } from "vitest";
import { BLOCK_GRAMMARS, BlockCompileError } from "@/lib/blocks/types";
import { compileBlock } from "@/lib/blocks/registry";

describe("board grammar compiler", () => {
  it("compiles every v1.1 and v1.2 grammar into bounded output", () => {
    for (const grammar of BLOCK_GRAMMARS) {
      const result = compileBlock({ grammar, source: grammar === "mermaid" ? "flowchart LR\nA --> B" : `${grammar} example` });
      expect(result.grammar).toBe(grammar);
      expect(result.elements.length).toBeGreaterThan(0);
      expect(result.elements.length).toBeLessThanOrEqual(500);
      expect(new TextEncoder().encode(JSON.stringify(result.elements)).byteLength).toBeLessThan(900_000);
    }
  });

  it("uses an image fallback for unsupported Mermaid types", () => {
    const result = compileBlock({ grammar: "mermaid", source: "gantt\n  title Sprint" });
    expect(result.files).not.toEqual({});
    expect(result.warnings.join(" ")).toMatch(/fallback/i);
  });

  it("rejects unknown, empty, and oversized sources without partial output", () => {
    expect(() => compileBlock({ grammar: "not-real", source: "x" })).toThrowError(BlockCompileError);
    expect(() => compileBlock({ grammar: "code", source: "  " })).toThrow(/source block/i);
    expect(() => compileBlock({ grammar: "code", source: "x".repeat(12_001) })).toThrow(/12,000/);
  });

  it("keeps source and options in each compiled element customData", () => {
    const result = compileBlock({ grammar: "ds", source: "array [5,2,9]", options: { theme: "nord", reveal: "step" } });
    const metadata = result.elements[0].customData as { sv?: { grammar?: string; source?: string; opts?: { theme?: string } } };
    expect(metadata.sv?.grammar).toBe("ds");
    expect(metadata.sv?.source).toContain("array");
    expect(metadata.sv?.opts?.theme).toBe("nord");
  });
});
