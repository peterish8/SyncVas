"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Hero board preview.
 *
 * A self-contained mock of the real Syncvas room: window chrome, app bar with
 * live roster, tool rail, a traced graph on dotted board paper, the teacher
 * cursor, and the student doubt rail. Layout and styling live in
 * app/styles/board-preview.css under the sv-board-* prefix so this preview can
 * be reworked without touching the wider origin-* marketing surface.
 */

const TOOLS = [
  { key: "select", label: "Select", path: "M4 3l14 6-5.5 1.6L11 16z" },
  { key: "pen", label: "Pen", path: "M3 17l9.5-9.5 4 4L7 21H3zM14 5.5L16.5 3l4 4L18 9.5z" },
  { key: "text", label: "Text", path: "M5 5h14M12 5v14" },
  { key: "shape", label: "Shape", path: "M4 5h16v14H4z" },
  { key: "erase", label: "Erase", path: "M5 19h14M6 15l7-7 5 5-4 4z" },
];

/** Depth-first traversal being drawn on the board. */
const NODES = [
  { id: "A", x: 128, y: 34 },
  { id: "B", x: 62, y: 104 },
  { id: "C", x: 196, y: 104 },
  { id: "D", x: 26, y: 174 },
  { id: "E", x: 100, y: 174 },
  { id: "F", x: 196, y: 174 },
];

const EDGES: Array<[string, string]> = [
  ["A", "B"],
  ["A", "C"],
  ["B", "D"],
  ["B", "E"],
  ["C", "F"],
];

/** Nodes already popped onto the traversal stack. */
const VISITED = new Set(["A", "C", "F"]);

function nodeAt(id: string) {
  const n = NODES.find((node) => node.id === id);
  if (!n) throw new Error(`Unknown node ${id}`);
  return n;
}

export function BoardPreview() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="sv-board"
      animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
      transition={reduceMotion ? undefined : { duration: 9.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="sv-board-chrome" aria-hidden="true">
        <span className="sv-board-lights">
          <i />
          <i />
          <i />
        </span>
        <span className="sv-board-address">syncvas.app/r/CS-09</span>
        <span className="sv-board-chrome-spacer" />
      </div>

      <header className="sv-board-bar">
        <div className="sv-board-identity">
          <span className="sv-board-mark" aria-hidden="true" />
          <strong>syncvas</strong>
          <span className="sv-board-class">Class 09 · Algorithms</span>
          <span className="sv-board-live">
            <i aria-hidden="true" />
            Live
          </span>
        </div>
        <div className="sv-board-roster">
          <span className="sv-board-avatars" aria-hidden="true">
            <i data-seat="1">RK</i>
            <i data-seat="2">AM</i>
            <i data-seat="3">JP</i>
            <i data-seat="4">+25</i>
          </span>
          <span className="sv-board-code">CS-09</span>
        </div>
      </header>

      <div className="sv-board-body">
        <aside className="sv-board-tools" aria-hidden="true">
          {TOOLS.map((tool, i) => (
            <span key={tool.key} className={i === 1 ? "is-active" : undefined} title={tool.label}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d={tool.path} />
              </svg>
            </span>
          ))}
        </aside>

        <div className="sv-board-canvas">
          <div className="sv-board-canvas-head">
            <span className="sv-board-topic">Tracing depth-first search</span>
            <span className="sv-board-pen-tag">Ms. Rao is drawing</span>
          </div>

          <svg className="sv-board-graph" viewBox="0 0 240 210" aria-hidden="true">
            {EDGES.map(([from, to]) => {
              const a = nodeAt(from);
              const b = nodeAt(to);
              const onPath = VISITED.has(from) && VISITED.has(to);
              return (
                <line
                  key={`${from}${to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={onPath ? "sv-edge is-path" : "sv-edge"}
                />
              );
            })}
            {NODES.map((n) => (
              <g key={n.id} className={VISITED.has(n.id) ? "sv-node is-visited" : "sv-node"}>
                <circle cx={n.x} cy={n.y} r="17" />
                <text x={n.x} y={n.y + 5}>
                  {n.id}
                </text>
              </g>
            ))}
          </svg>

          <div className="sv-board-code-block" aria-hidden="true">
            <code>
              <b>function</b> dfs(node) {"{"}
            </code>
            <code className="sv-board-code-indent">
              <b>if</b> (!node) <b>return</b>;
            </code>
            <code className="sv-board-code-indent sv-board-code-live">
              visit(node);<span className="sv-board-caret" />
            </code>
          </div>

          <span className="sv-board-stack" aria-hidden="true">
            stack → [A, C, F]
          </span>

          <motion.svg
            className="sv-board-cursor"
            viewBox="0 0 24 24"
            aria-hidden="true"
            animate={
              reduceMotion
                ? undefined
                : { x: [176, 196, 150, 176], y: [96, 150, 176, 96], rotate: [-8, -4, -10, -8] }
            }
            transition={
              reduceMotion ? undefined : { duration: 11, repeat: Infinity, ease: "easeInOut" }
            }
          >
            <path
              fill="currentColor"
              d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"
            />
          </motion.svg>
        </div>

        <aside className="sv-board-rail" aria-hidden="true">
          <p className="sv-board-rail-title">Doubts</p>
          <span className="sv-board-doubt">
            Why visit C before B?
            <b>▲ 4</b>
          </span>
          <span className="sv-board-doubt">
            Is the stack LIFO here?
            <b>▲ 2</b>
          </span>
          <span className="sv-board-rail-note">Anonymous · moderated</span>
        </aside>
      </div>

      <footer className="sv-board-status" aria-hidden="true">
        <span>Board v.24</span>
        <span className="sv-board-following">
          <i />
          Following teacher
        </span>
        <span className="sv-board-zoom">100%</span>
      </footer>
    </motion.div>
  );
}
