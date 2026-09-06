import type { BinaryFiles } from "@excalidraw/excalidraw/types";
export type BlockElementSkeleton = {
  type: string;
  x?: number;
  y?: number;
  [key: string]: unknown;
};

export const BLOCK_GRAMMARS = [
  "mermaid", "code", "math", "ds", "calltree", "plot", "dp", "trace", "tensor", "nn",
  "dfa", "nfa", "tm", "mem", "bits", "confusion", "truth", "kmap", "circuit", "sched", "matrix", "table",
] as const;

export type BlockGrammarId = (typeof BLOCK_GRAMMARS)[number];
export type BlockTheme = "one-dark-pro" | "github-light" | "github-dark" | "nord" | "catppuccin-latte" | "monokai";

export type BlockOptions = {
  theme?: BlockTheme | "light" | "dark";
  language?: string;
  title?: string;
  focus?: string;
  diff?: boolean;
  lineNumbers?: boolean;
  reveal?: "all" | "step";
  step?: number;
};

export type BlockCompileRequest = {
  grammar: BlockGrammarId | string;
  source: string;
  options?: BlockOptions;
};

export type BlockCompileResult = {
  grammar: BlockGrammarId;
  source: string;
  options: Required<Pick<BlockOptions, "theme" | "reveal" | "step">> & BlockOptions;
  elements: BlockElementSkeleton[];
  files: BinaryFiles;
  warnings: string[];
};

export class BlockCompileError extends Error {
  readonly code: "UNKNOWN_GRAMMAR" | "INVALID_SOURCE" | "SOURCE_TOO_LARGE" | "ELEMENT_LIMIT" | "SCENE_TOO_LARGE";
  constructor(code: BlockCompileError["code"], message: string) {
    super(message);
    this.name = "BlockCompileError";
    this.code = code;
  }
}

export const BLOCK_LIMITS = {
  sourceBytes: 12_000,
  elements: 500,
  sceneBytes: 900_000,
  filesBytes: 2_000_000,
} as const;
