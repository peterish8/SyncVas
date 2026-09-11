"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

import { SNOISE_2D_GLSL } from "@/lib/gl/noise";
import { cn } from "@/lib/utils";

const vertexShaderGLSL = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShaderGLSL = `
precision highp float;
varying vec2 vUv;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_grain;
uniform float u_dark;
uniform vec3  u_colors[3];
uniform vec3  u_base;

${SNOISE_2D_GLSL}

void main() {
  vec2 uv = vUv;
  float ratio = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = uv * vec2(ratio, 1.0);
  float t = u_time * 0.2;

  float n1 = snoise(p * 0.5 + t);
  float n2 = snoise(p * 0.9 - t * 0.5 + n1);
  /* Light: readable brand washes. Dark: quieter accent glow. */
  float light = pow(abs(n2), mix(2.15, 3.2, u_dark)) * mix(0.48, 0.28, u_dark);

  vec3 col = u_base;
  /* Lime ribbons */
  col += u_colors[0] * smoothstep(0.08, 0.95, n1) * mix(0.38, 0.2, u_dark);
  /* Coral blooms */
  col += u_colors[1] * light * mix(1.2, 0.7, u_dark);
  /* Sky shade bands */
  col += u_colors[2] * smoothstep(0.18, 0.92, n2) * mix(0.34, 0.14, u_dark);
  /* Extra lime edge lines so light theme keeps SyncVas structure */
  col += u_colors[0] * smoothstep(0.55, 0.85, abs(n1 - n2)) * mix(0.18, 0.06, u_dark);

  float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453 + u_time);
  col += (grain - 0.5) * u_grain * mix(0.2, 0.22, u_dark);

  float dist = length(uv - 0.5);
  /* Light keeps more field visible; dark keeps a deeper vignette. */
  col *= mix(smoothstep(1.6, 0.1, dist), smoothstep(1.25, 0.28, dist), u_dark);

  /* Keep dark mode calm without crushing the flowing lines into black. */
  col = mix(col, col * col, u_dark * 0.18);

  gl_FragColor = vec4(col, 1.0);
}
`;

export type AuralisFieldProps = {
  colors?: string[];
  speed?: number;
  grain?: number;
  className?: string;
};

/** SyncVas brand accents — lime / coral / sky. Light uses fuller chroma so washes read on paper. */
const LIGHT_COLORS = ["#d8f700", "#fa796c", "#6eacd8"];
const DARK_COLORS = ["#b5ca2b", "#e18476", "#70a3c1"];
const LIGHT_BASE: [number, number, number] = [0.955, 0.948, 0.925]; // warm cream paper
const DARK_BASE: [number, number, number] = [0.075, 0.079, 0.067]; // lifted ink, still calm

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/**
 * SyncVas-tuned WebGL field — warm paper / near-ink base with brand accents.
 * Used as an ambient landing backdrop (not a full-screen takeover).
 */
export function AuralisField({
  colors,
  speed = 0.09,
  grain = 0.12,
  className,
}: AuralisFieldProps) {
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
    if (!gl) return;

    const createShader = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("WebGL shader unavailable.");
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader) ?? "compile failed";
        gl.deleteShader(shader);
        throw new Error(info);
      }
      return shader;
    };

    const program = gl.createProgram();
    if (!program) return;
    const vs = createShader(gl.VERTEX_SHADER, vertexShaderGLSL);
    const fs = createShader(gl.FRAGMENT_SHADER, fragmentShaderGLSL);
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
      grain: gl.getUniformLocation(program, "u_grain"),
      dark: gl.getUniformLocation(program, "u_dark"),
      colors: gl.getUniformLocation(program, "u_colors"),
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

    const readTheme = () => document.documentElement.getAttribute("data-theme") === "dark";

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    let raf = 0;
    let frozenTime = 0;
    const render = (t: number) => {
      const dark = readTheme();
      const palette = colors?.slice(0, 3) ?? (dark ? DARK_COLORS : LIGHT_COLORS);
      const base = dark ? DARK_BASE : LIGHT_BASE;
      const time = reduceMotion ? frozenTime : t;
      if (reduceMotion && frozenTime === 0) frozenTime = t;

      gl.uniform2f(locs.res, canvas.width, canvas.height);
      gl.uniform1f(locs.time, time * 0.001 * (reduceMotion ? 0 : speed));
      gl.uniform1f(locs.grain, grain);
      gl.uniform1f(locs.dark, dark ? 1 : 0);
      gl.uniform3f(locs.base, base[0], base[1], base[2]);
      gl.uniform3fv(locs.colors, new Float32Array(palette.flatMap(hexToRgb)));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (!reduceMotion) raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    const onTheme = () => {
      if (reduceMotion) render(frozenTime || performance.now());
    };
    const observer = new MutationObserver(onTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      ro.disconnect();
      observer.disconnect();
      cancelAnimationFrame(raf);
      gl.deleteBuffer(buffer);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(program);
    };
  }, [colors, speed, grain, reduceMotion]);

  return (
    <div
      ref={containerRef}
      className={cn("origin-auralis pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
