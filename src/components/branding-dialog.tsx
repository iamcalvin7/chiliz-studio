"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@ark-ui/react";
import { Loader2, Palette, RotateCcw } from "lucide-react";
import {
  BRAND_COLOR_PRESETS,
  BRAND_FONTS,
  BRAND_ICON_KEYS,
  BRAND_TEXT_PRESETS,
  DEFAULT_BRANDING,
  FONT_CSS_VARS,
  FONT_LABELS,
  normalizeHex,
  type BrandingConfig,
} from "@/lib/branding";
import { BRANDING_ICONS } from "@/lib/branding-icons";

const HEX_INPUT_CLASS =
  "h-8 w-24 rounded-lg border border-edge bg-ink px-2 font-mono text-[11px] uppercase text-white outline-none transition-colors focus:border-brand/60";

function applyPreview(config: BrandingConfig) {
  const root = document.documentElement;
  root.style.setProperty("--brand", config.brandColor);
  root.style.setProperty("--ink", config.inkColor);
  root.style.setProperty("--panel", config.panelColor);
  root.style.setProperty("--edge", config.edgeColor);
  root.style.setProperty("--text", config.textColor);
  const fontVar = FONT_CSS_VARS[config.fontFamily] ?? FONT_CSS_VARS.geist;
  root.style.setProperty("--ui-font-sans", `var(${fontVar})`);
}

function ColorField({
  label,
  value,
  presets,
  onChange,
}: {
  label: string;
  value: string;
  presets?: string[];
  onChange: (value: string) => void;
}) {
  const normalized = normalizeHex(value);
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-xs font-medium text-zinc-400">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {presets?.map((preset) => {
          const selected = normalized === normalizeHex(preset);
          return (
            <button
              key={preset}
              type="button"
              aria-label={`${label} ${preset}`}
              onClick={() => onChange(preset)}
              style={{ background: preset }}
              className={`size-6 shrink-0 rounded-full transition-transform hover:scale-110 ${
                selected
                  ? "ring-2 ring-brand ring-offset-2 ring-offset-panel"
                  : ""
              }`}
            />
          );
        })}
        <input
          type="color"
          value={normalized ?? "#000000"}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={`Pick ${label}`}
          className="size-6 shrink-0 cursor-pointer rounded-md border border-edge bg-ink p-0.5"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-label={`${label} hex value`}
          className={HEX_INPUT_CLASS}
        />
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-xl border border-edge bg-ink px-4 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-brand/60 focus:ring-2 focus:ring-brand/20";

export function BrandingDialog({
  branding,
}: {
  branding: BrandingConfig;
}) {
  const router = useRouter();
  const savedRef = useRef(branding);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BrandingConfig>(branding);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(patch: Partial<BrandingConfig>) {
    const next = { ...form, ...patch };
    setForm(next);
    applyPreview(next);
  }

  function handleOpenChange(details: { open: boolean }) {
    if (details.open) {
      setForm(savedRef.current);
      setError("");
      applyPreview(savedRef.current);
    } else {
      applyPreview(savedRef.current);
    }
    setOpen(details.open);
  }

  function reset() {
    setForm(DEFAULT_BRANDING);
    applyPreview(DEFAULT_BRANDING);
  }

  async function save() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/branding", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as {
        branding?: BrandingConfig;
        error?: string;
      };
      if (!res.ok || !data.branding) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      savedRef.current = data.branding;
      applyPreview(data.branding);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        className="grid size-8 place-items-center rounded-full border border-edge bg-panel text-zinc-400 transition-colors hover:border-brand/40 hover:text-white"
        aria-label="Branding settings"
      >
        <Palette className="size-3.5" />
      </Dialog.Trigger>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70" />
      <Dialog.Positioner className="fixed inset-0 z-50 grid place-items-center p-4">
        <Dialog.Content className="w-full max-w-lg rounded-2xl border border-edge bg-panel p-6 shadow-2xl">
          <form
            className="flex max-h-[calc(100dvh-8rem)] flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Dialog.Title className="text-lg font-semibold text-white">
              Branding
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-zinc-400">
              Change the app name, icon and colors. Everything previews live
              and is saved when you confirm.
            </Dialog.Description>

            <div className="mt-5 flex flex-col gap-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-zinc-400">
                    App name
                  </span>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      update({ name: event.target.value })
                    }
                    placeholder="Chiliz Studio"
                    aria-label="App name"
                    className={`h-11 ${INPUT_CLASS}`}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-zinc-400">
                    Tagline
                  </span>
                  <input
                    value={form.tagline}
                    onChange={(event) =>
                      update({ tagline: event.target.value })
                    }
                    placeholder="Your projects, without the terminal"
                    aria-label="Tagline"
                    className={`h-11 ${INPUT_CLASS}`}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-zinc-400">
                  Description (browser tab)
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    update({ description: event.target.value })
                  }
                  rows={2}
                  aria-label="Description"
                  className={`${INPUT_CLASS} resize-none py-2.5`}
                />
              </label>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-zinc-400">
                  Logo icon
                </span>
                <div className="flex flex-wrap gap-2">
                  {BRAND_ICON_KEYS.map((key) => {
                    const Icon = BRANDING_ICONS[key];
                    const selected = form.icon === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-label={`Icon ${key}`}
                        aria-pressed={selected}
                        onClick={() => update({ icon: key })}
                        className={`grid size-10 place-items-center rounded-xl transition-colors ${
                          selected
                            ? "bg-brand text-ink"
                            : "border border-edge bg-ink text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Icon className="size-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <ColorField
                label="Brand color"
                value={form.brandColor}
                presets={BRAND_COLOR_PRESETS}
                onChange={(brandColor) => update({ brandColor })}
              />

              <ColorField
                label="Body text"
                value={form.textColor}
                presets={BRAND_TEXT_PRESETS}
                onChange={(textColor) => update({ textColor })}
              />

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-zinc-400">
                  Font
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {BRAND_FONTS.map((key) => {
                    const selected = form.fontFamily === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-label={`Font ${FONT_LABELS[key]}`}
                        aria-pressed={selected}
                        onClick={() => update({ fontFamily: key })}
                        style={{
                          fontFamily: `var(${FONT_CSS_VARS[key]})`,
                        }}
                        className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm transition-colors ${
                          selected
                            ? "bg-brand text-ink"
                            : "border border-edge bg-ink text-zinc-300 hover:text-white"
                        }`}
                      >
                        {FONT_LABELS[key]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-edge bg-ink/50 p-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Surfaces
                </span>
                <ColorField
                  label="Ink (background)"
                  value={form.inkColor}
                  onChange={(inkColor) => update({ inkColor })}
                />
                <ColorField
                  label="Panel (cards)"
                  value={form.panelColor}
                  onChange={(panelColor) => update({ panelColor })}
                />
                <ColorField
                  label="Edge (borders)"
                  value={form.edgeColor}
                  onChange={(edgeColor) => update({ edgeColor })}
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-edge px-4 text-sm text-zinc-300 transition-colors hover:text-white"
              >
                <RotateCcw className="size-3.5" />
                Reset to defaults
              </button>
              <div className="flex gap-2">
                <Dialog.CloseTrigger className="h-10 rounded-xl border border-edge px-4 text-sm text-zinc-300 transition-colors hover:text-white">
                  Cancel
                </Dialog.CloseTrigger>
                <button
                  type="submit"
                  disabled={loading || !form.name.trim()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
