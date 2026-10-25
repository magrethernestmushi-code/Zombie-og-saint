import type { AudioChannelSettings, ColorGrade } from "../types";

/**
 * A free, no-cost command system: it recognizes a fixed set of common
 * editing phrases by matching real keywords and phrases against what you
 * type, and turns each match into a real action on your real project.
 *
 * Being upfront about what this is: it is pattern matching against known
 * phrases, not a language model that understands open-ended instructions.
 * Type something it doesn't recognize and it will say so, rather than
 * guessing. See COMMAND_EXAMPLES for the full list of what it understands.
 */

export type CommandAction =
  | { type: "autoEdit" }
  | { type: "detectSilence" }
  | { type: "autoGrade" }
  | { type: "generateCaptions" }
  | { type: "resetColor" }
  | { type: "applyPreset"; preset: string }
  | { type: "adjustColor"; patch: Partial<ColorGrade>; label: string }
  | { type: "adjustAudio"; patch: Partial<AudioChannelSettings>; label: string };

export type CommandRule = {
  pattern: RegExp;
  label: string;
  action: CommandAction;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export const COMMAND_RULES: CommandRule[] = [
  {
    pattern: /auto[\s-]?edit|edit (it|this) (automatically|for me)|do everything|one[\s-]?click edit/i,
    label: "Auto Edit (silence + color + audio + captions)",
    action: { type: "autoEdit" },
  },
  {
    pattern: /remove (the )?silence|cut (the )?silence|delete (the )?silence|trim (the )?(dead air|pauses)/i,
    label: "Remove silence",
    action: { type: "detectSilence" },
  },
  {
    pattern: /add captions|generate captions|auto[\s-]?caption|add subtitles|transcribe/i,
    label: "Add real captions from the audio",
    action: { type: "generateCaptions" },
  },
  {
    pattern: /auto[\s-]?grade|fix (the )?colou?r|auto colou?r/i,
    label: "Auto Grade the color",
    action: { type: "autoGrade" },
  },
  {
    pattern: /reset (the )?colou?r|undo (the )?colou?r|original colou?r/i,
    label: "Reset color to original",
    action: { type: "resetColor" },
  },
  {
    pattern: /black (and|&) white|grayscale|greyscale|\bb\s?&\s?w\b/i,
    label: "Apply Black & White Film preset",
    action: { type: "applyPreset", preset: "blackAndWhiteFilm" },
  },
  {
    pattern: /cinematic|movie look|film look|hollywood/i,
    label: "Apply Modern Hollywood preset",
    action: { type: "applyPreset", preset: "modernHollywood" },
  },
  {
    pattern: /teal and orange/i,
    label: "Apply Teal & Orange preset",
    action: { type: "applyPreset", preset: "tealAndOrange" },
  },
  {
    pattern: /vintage|old film|retro/i,
    label: "Apply Vintage 35mm preset",
    action: { type: "applyPreset", preset: "vintage35mm" },
  },
  {
    pattern: /moody|dramatic|dark (mood|look)/i,
    label: "Apply Moody Drama preset",
    action: { type: "applyPreset", preset: "moodyDrama" },
  },
  {
    pattern: /warmer|more warm|add warmth/i,
    label: "Make it warmer",
    action: { type: "adjustColor", patch: { temperature: 0.18 }, label: "warmer" },
  },
  {
    pattern: /cooler|more cool|add blue/i,
    label: "Make it cooler",
    action: { type: "adjustColor", patch: { temperature: -0.18 }, label: "cooler" },
  },
  {
    pattern: /brighter|brighten|more exposure/i,
    label: "Brighten the image",
    action: { type: "adjustColor", patch: { exposure: 0.12 }, label: "brighter" },
  },
  {
    pattern: /darker|darken|dim(mer)?|less exposure/i,
    label: "Darken the image",
    action: { type: "adjustColor", patch: { exposure: -0.12 }, label: "darker" },
  },
  {
    pattern: /more contrast|punchier|more punch/i,
    label: "Add contrast",
    action: { type: "adjustColor", patch: { contrast: 0.15 }, label: "more contrast" },
  },
  {
    pattern: /less contrast|flatter|flatten/i,
    label: "Reduce contrast",
    action: { type: "adjustColor", patch: { contrast: -0.15 }, label: "less contrast" },
  },
  {
    pattern: /clean (up )?(the )?audio|remove noise|denoise|clear(er)? sound|clean (the )?dialogue/i,
    label: "Clean up the audio (noise reduction + hum removal)",
    action: {
      type: "adjustAudio",
      patch: { denoise: true, denoiseStrength: 0.6, reduceHum: true },
      label: "cleaned the audio",
    },
  },
  {
    pattern: /louder|increase (the )?volume|turn (it|the volume) up/i,
    label: "Increase dialogue volume",
    action: { type: "adjustAudio", patch: {}, label: "louder" }, // handled specially (relative) below
  },
  {
    pattern: /quieter|decrease (the )?volume|turn (it|the volume) down/i,
    label: "Decrease dialogue volume",
    action: { type: "adjustAudio", patch: {}, label: "quieter" },
  },
];

export const COMMAND_EXAMPLES: string[] = [
  "auto edit this clip",
  "remove the silence",
  "add captions",
  "make it warmer",
  "more contrast",
  "cinematic look",
  "black and white",
  "clean up the audio",
  "reset the color",
];

export type CommandMatch = { label: string; action: CommandAction };

export function interpretCommand(text: string): CommandMatch[] {
  const matches: CommandMatch[] = [];
  for (const rule of COMMAND_RULES) {
    if (rule.pattern.test(text)) {
      matches.push({ label: rule.label, action: rule.action });
    }
  }
  return matches;
}

export function nudgeVolume(current: number, up: boolean): number {
  return clamp(current + (up ? 0.25 : -0.25), 0, 2);
}
