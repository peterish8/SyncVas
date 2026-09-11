/**
 * Teacher scene plate — flowing silk, drawn in WebGL.
 *
 * Replaces `/syncvas-teacher-ribbons.png`. Where `auralis-field` is an ambient
 * page-wide wash (smoothstep over plain noise), this is a ribbon field: the
 * sample point is pushed through a very low-frequency domain warp and read
 * through broad smoothstep washes. Same noise basis (lib/gl/noise), with only
 * a restrained diagonal tint so the plate stays distinct from the page wash.
 *
 * Motion lives in the shader, not in transforms: `u_time` advances the warp, so
 * the ribbons genuinely deform as they move instead of sliding as rigid shapes.
 *
 * Theme is read from `data-theme` and observed, matching auralis-field.
 * `prefers-reduced-motion` freezes the field on its first frame rather than
 * removing it.
 */

"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

import { FBM_2D_GLSL, SNOISE_2D_GLSL } from "@/lib/gl/noise";
import { cn } from "@/lib/utils";

const VERTEX_SHADER = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_dark;
uniform vec3  u_lime;
uniform vec3  u_deep;
uniform vec3  u_graphite;
uniform vec3  u_base;

${SNOISE_2D_GLSL}
${FBM_2D_GLSL}

void main() {
  vec2 uv = vUv;
  float ratio = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2((uv.x - 0.5) * ratio, uv.y - 0.5) * 2.2;
  float t = u_time;

  /* A gentle diagonal drift keeps this plate distinct from Auralis without
     introducing visible grain, stripes, or oily high-frequency detail. */
  vec2 drift = vec2(0.26, -0.14);
  vec2 q = vec2(
    snoise(p * 0.18 + drift * t * 0.05 + vec2(1.7, 9.2)),
    snoise(p * 0.18 - drift * t * 0.04 + vec2(8.3, 2.8))
  );
  vec2 warped = p * 0.3 + q * 0.34;
  float washA = clamp(0.5 + 0.5 * snoise(warped + drift * t * 0.02), 0.0, 1.0);
  float washB = clamp(0.5 + 0.5 * snoise(warped * 0.82 - q * 0.18 + vec2(3.1, 7.4)), 0.0, 1.0);

  float limeWash = smoothstep(0.48, 0.76, washA);
  float graphiteWash = smoothstep(0.56, 0.82, washB);
  float deepWash = smoothstep(0.42, 0.72, 0.58 * washA + 0.42 * washB);

  vec3 col = u_base;
  col = mix(col, u_graphite, graphiteWash * mix(0.045, 0.08, u_dark));
  col = mix(col, u_deep, deepWash * mix(0.06, 0.05, u_dark));
  col = mix(col, u_lime, limeWash * mix(0.085, 0.055, u_dark));

  /* Soft inward falloff so the plate settles into its rounded card instead of
     butting hard against the corners. */
  vec2 d = abs(uv - 0.5) * 2.0;
  float edge = smoothstep(1.28, 0.35, max(d.x, d.y) + length(d) * 0.22);
  col = mix(u_base, col, clamp(edge, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

/** Light plate: warm paper with full-chroma brand accents. */
const LIGHT = {
  lime: "#d8f700",
  deep: "#9fbe12",
  graphite: "#3c4239",
  base: "#f2efe4",
};

/** Dark plate: deep ink, accents pulled well back so the copy still wins. */
const DARK = {
  lime: "#a8c400",
  deep: "#6f8a10",
  graphite: "#0b120e",
  base: "#0f1613",
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export function TeacherRibbons({
  className,
  speed = 0.16,
}: {
  className?: string;
  speed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    // No WebGL: the container keeps its CSS gradient, so the section still reads.
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const program = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!program || !vs || !fs) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const locs = {
      res: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      dark: gl.getUniformLocation(program, "u_dark"),
      lime: gl.getUniformLocation(program, "u_lime"),
      deep: gl.getUniformLocation(program, "u_deep"),
      graphite: gl.getUniformLocation(program, "u_graphite"),
      base: gl.getUniformLocation(program, "u_base"),
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.floor(container.clientWidth * dpr));
      const height = Math.max(1, Math.floor(container.clientHeight * dpr));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const readDark = () => document.documentElement.getAttribute("data-theme") === "dark";

    let raf = 0;
    let start = 0;
    let onScreen = true;

    const render = (now: number) => {
      if (!start) start = now;
      const elapsed = reduceMotion ? 0 : ((now - start) / 1000) * speed;
      const dark = readDark();
      const palette = dark ? DARK : LIGHT;

      gl.uniform2f(locs.res, canvas.width, canvas.height);
      gl.uniform1f(locs.time, elapsed);
      gl.uniform1f(locs.dark, dark ? 1 : 0);
      gl.uniform3fv(locs.lime, new Float32Array(hexToRgb(palette.lime)));
      gl.uniform3fv(locs.deep, new Float32Array(hexToRgb(palette.deep)));
      gl.uniform3fv(locs.graphite, new Float32Array(hexToRgb(palette.graphite)));
      gl.uniform3fv(locs.base, new Float32Array(hexToRgb(palette.base)));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (!reduceMotion && onScreen) raf = requestAnimationFrame(render);
    };

    /* Decoration should not hold a rAF loop open while it is scrolled away. */
    const io = new IntersectionObserver(
      ([entry]) => {
        const next = entry?.isIntersecting ?? true;
        const wasOff = !onScreen;
        onScreen = next;
        if (next && wasOff && !reduceMotion) {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(render);
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(container);

    raf = requestAnimationFrame(render);

    // Theme is a paint-only change; redraw once when the loop is not running.
    const themeObserver = new MutationObserver(() => {
      if (reduceMotion || !onScreen) render(performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      cancelAnimationFrame(raf);
      gl.deleteBuffer(buffer);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(program);
    };
  }, [reduceMotion, speed]);

  return (
    <div ref={containerRef} className={cn("origin-teacher-ribbon-field", className)} aria-hidden="true">
      <canvas ref={canvasRef} className="origin-teacher-ribbon-canvas" />
    </div>
  );
}
