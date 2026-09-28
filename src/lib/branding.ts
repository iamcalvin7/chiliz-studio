export interface BrandingConfig {
  name: string;
  tagline: string;
  description: string;
  icon: string;
  brandColor: string;
  textColor: string;
  inkColor: string;
  panelColor: string;
  edgeColor: string;
  fontFamily: string;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  name: "Chiliz Studio",
  tagline: "Your projects, without the terminal",
  description:
    "A friendly web interface for the Chiliz agent: chat, browse sessions and manage all your projects in one place.",
  icon: "flame",
  brandColor: "#FFD100",
  textColor: "#E4E4E7",
  inkColor: "#0A0A0C",
  panelColor: "#131318",
  edgeColor: "#24242C",
  fontFamily: "geist",
};

export const BRAND_ICON_KEYS = [
  "flame",
  "zap",
  "rocket",
  "sparkles",
  "bot",
  "hexagon",
  "command",
  "layers",
  "compass",
  "orbit",
] as const;

export const BRAND_FONTS = ["geist", "inter", "manrope", "space-grotesk"] as const;

export const FONT_CSS_VARS: Record<string, string> = {
  geist: "--font-geist-sans",
  inter: "--font-inter",
  manrope: "--font-manrope",
  "space-grotesk": "--font-space-grotesk",
};

export const FONT_LABELS: Record<string, string> = {
  geist: "Geist",
  inter: "Inter",
  manrope: "Manrope",
  "space-grotesk": "Space Grotesk",
};

export const BRAND_COLOR_PRESETS = [
  "#FFD100",
  "#FF5C00",
  "#EF4444",
  "#EC4899",
  "#A855F7",
  "#3B82F6",
  "#22D3EE",
  "#A3E635",
];

export const BRAND_TEXT_PRESETS = [
  "#E4E4E7",
  "#FFFFFF",
  "#C7D2FE",
  "#BBF7D0",
  "#FBCFE8",
  "#FDE68A",
];

export function normalizeHex(input: string): string | null {
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(input.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  return `#${hex.toUpperCase()}`;
}

function sanitizeText(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length === 0) return null;
  return text.slice(0, maxLength);
}

export function mergeBrandingLenient(
  current: BrandingConfig,
  data: Record<string, unknown>,
): BrandingConfig {
  const next: BrandingConfig = { ...current };
  const name = sanitizeText(data.name, 40);
  if (name) next.name = name;
  const tagline = sanitizeText(data.tagline, 80);
  if (tagline) next.tagline = tagline;
  const description = sanitizeText(data.description, 200);
  if (description) next.description = description;
  if (
    typeof data.icon === "string" &&
    BRAND_ICON_KEYS.includes(data.icon as (typeof BRAND_ICON_KEYS)[number])
  ) {
    next.icon = data.icon;
  }
  if (
    typeof data.fontFamily === "string" &&
    BRAND_FONTS.includes(data.fontFamily as (typeof BRAND_FONTS)[number])
  ) {
    next.fontFamily = data.fontFamily;
  }
  for (const key of [
    "brandColor",
    "textColor",
    "inkColor",
    "panelColor",
    "edgeColor",
  ] as const) {
    const normalized = normalizeHex(String(data[key] ?? ""));
    if (normalized) next[key] = normalized;
  }
  return next;
}

export function mergeBranding(
  current: BrandingConfig,
  input: Record<string, unknown>,
): { branding: BrandingConfig } | { error: string } {
  const next: BrandingConfig = { ...current };

  if (input.name !== undefined) {
    const name = sanitizeText(input.name, 40);
    if (!name) return { error: "name can't be empty" };
    next.name = name;
  }
  if (input.tagline !== undefined) {
    const tagline = sanitizeText(input.tagline, 80);
    if (!tagline) return { error: "tagline can't be empty" };
    next.tagline = tagline;
  }
  if (input.description !== undefined) {
    const description = sanitizeText(input.description, 200);
    if (!description) return { error: "description can't be empty" };
    next.description = description;
  }

  if (input.icon !== undefined) {
    if (
      typeof input.icon !== "string" ||
      !BRAND_ICON_KEYS.includes(input.icon as (typeof BRAND_ICON_KEYS)[number])
    ) {
      return { error: "unknown icon" };
    }
    next.icon = input.icon;
  }

  if (input.fontFamily !== undefined) {
    if (
      typeof input.fontFamily !== "string" ||
      !BRAND_FONTS.includes(input.fontFamily as (typeof BRAND_FONTS)[number])
    ) {
      return { error: "unknown font" };
    }
    next.fontFamily = input.fontFamily;
  }

  for (const key of [
    "brandColor",
    "textColor",
    "inkColor",
    "panelColor",
    "edgeColor",
  ] as const) {
    if (input[key] !== undefined) {
      const normalized = normalizeHex(String(input[key]));
      if (!normalized) {
        return { error: `${key} must be a hex color like #ff5500` };
      }
      next[key] = normalized;
    }
  }

  return { branding: next };
}
