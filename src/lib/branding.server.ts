import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DEFAULT_BRANDING,
  mergeBranding,
  mergeBrandingLenient,
  type BrandingConfig,
} from "@/lib/branding";

const BRANDING_FILE = path.join(process.cwd(), "data", "branding.json");

export async function readBranding(): Promise<BrandingConfig> {
  try {
    const raw = await fs.readFile(BRANDING_FILE, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    return mergeBrandingLenient(DEFAULT_BRANDING, data);
  } catch {
    return DEFAULT_BRANDING;
  }
}

export async function saveBranding(
  input: Record<string, unknown>,
): Promise<{ branding: BrandingConfig } | { error: string }> {
  const current = await readBranding();
  const result = mergeBranding(current, input);
  if ("error" in result) return result;
  try {
    await fs.mkdir(path.dirname(BRANDING_FILE), { recursive: true });
    await fs.writeFile(
      BRANDING_FILE,
      JSON.stringify(result.branding, null, 2),
    );
  } catch {
    return { error: "failed to write branding file" };
  }
  return result;
}
