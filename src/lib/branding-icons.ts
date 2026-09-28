import {
  Bot,
  Command,
  Compass,
  Flame,
  Hexagon,
  Layers,
  Orbit,
  Rocket,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { BRAND_ICON_KEYS } from "@/lib/branding";

export const BRANDING_ICONS: Record<string, LucideIcon> = {
  [BRAND_ICON_KEYS[0]]: Flame,
  [BRAND_ICON_KEYS[1]]: Zap,
  [BRAND_ICON_KEYS[2]]: Rocket,
  [BRAND_ICON_KEYS[3]]: Sparkles,
  [BRAND_ICON_KEYS[4]]: Bot,
  [BRAND_ICON_KEYS[5]]: Hexagon,
  [BRAND_ICON_KEYS[6]]: Command,
  [BRAND_ICON_KEYS[7]]: Layers,
  [BRAND_ICON_KEYS[8]]: Compass,
  [BRAND_ICON_KEYS[9]]: Orbit,
};

export function brandingIcon(key: string): LucideIcon {
  return BRANDING_ICONS[key] ?? Flame;
}
