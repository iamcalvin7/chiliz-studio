import { ImageResponse } from "next/og";
import { readBranding } from "@/lib/branding.server";

export const dynamic = "force-dynamic";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const branding = await readBranding();
  const letter = (branding.name.trim()[0] ?? "C").toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: branding.brandColor,
          color: branding.inkColor,
          borderRadius: 14,
          fontSize: 34,
        }}
      >
        {letter}
      </div>
    ),
    { ...size },
  );
}
