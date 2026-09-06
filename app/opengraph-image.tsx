import { ImageResponse } from "next/og";

export const alt = "Syncvas live classroom whiteboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "66px 76px",
        background: "#f5f4f0",
        color: "#171717",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", fontSize: 27, fontWeight: 700, letterSpacing: "-0.06em" }}>
        syncvas<span style={{ color: "#f47b68" }}>.</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
        <div style={{ display: "flex", color: "#6f6d66", fontSize: 18, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Live classroom whiteboard
        </div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 70, lineHeight: 1.02, fontWeight: 600, letterSpacing: "-0.07em" }}>
          Teach the idea<br />as it moves.
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 22, color: "#45443f" }}>
        <span style={{ display: "flex", width: 18, height: 18, borderRadius: 999, background: "#d7f500" }} />
        QR joining · Follow Teacher · Anonymous doubts
      </div>
    </div>,
    { ...size },
  );
}
