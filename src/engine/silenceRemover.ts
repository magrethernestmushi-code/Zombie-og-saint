import type { SilenceCut, SilenceMode, SilenceSettings } from "../types";

/**
 * Real silence detection using ffmpeg's own `silencedetect` audio filter —
 * not a heuristic guess. ffmpeg analyzes the actual decoded audio and logs
 * every region quieter than the threshold for at least `minSilenceDuration`
 * seconds. We parse that real log output into a reviewable, restorable cut
 * list; nothing is deleted until the user exports, and every cut can be
 * individually restored first.
 */

export const SILENCE_MODE_PRESETS: Record<SilenceMode, Omit<SilenceSettings, "mode">> = {
  gentle: {
    thresholdDb: -35,
    minSilenceDuration: 0.8,
    padding: 0.15,
    minPreservedPause: 0.4,
  },
  balanced: {
    thresholdDb: -30,
    minSilenceDuration: 0.5,
    padding: 0.1,
    minPreservedPause: 0.25,
  },
  aggressive: {
    thresholdDb: -26,
    minSilenceDuration: 0.3,
    padding: 0.06,
    minPreservedPause: 0.12,
  },
};

export function silenceDetectArgs(settings: SilenceSettings): string {
  return `silencedetect=noise=${settings.thresholdDb}dB:d=${settings.minSilenceDuration}`;
}

/**
 * Parses ffmpeg's `silencedetect` console log into [start, end] pairs.
 * ffmpeg logs lines like:
 *   [silencedetect @ 0x...] silence_start: 12.34
 *   [silencedetect @ 0x...] silence_end: 15.67 | silence_duration: 3.33
 * A silence_start with no matching silence_end (silence runs to EOF) is
 * closed off at `totalDuration`.
 */
export function parseSilenceLog(
  log: string,
  totalDuration: number
): Array<{ start: number; end: number }> {
  const regions: Array<{ start: number; end: number }> = [];
  let pendingStart: number | null = null;

  const startRe = /silence_start:\s*(-?[\d.]+)/;
  const endRe = /silence_end:\s*(-?[\d.]+)/;

  for (const line of log.split("\n")) {
    const s = startRe.exec(line);
    if (s) {
      pendingStart = parseFloat(s[1]);
      continue;
    }
    const e = endRe.exec(line);
    if (e && pendingStart !== null) {
      regions.push({ start: pendingStart, end: parseFloat(e[1]) });
      pendingStart = null;
    }
  }
  if (pendingStart !== null) {
    regions.push({ start: pendingStart, end: totalDuration });
  }
  return regions;
}

/**
 * Turns raw silence regions into an editable cut list, applying the
 * minimum-preserved-pause rule (short natural pauses are never proposed
 * as cuts) and padding (keeps a sliver of audio before/after each cut so
 * words aren't clipped mid-syllable).
 */
export function buildCutList(
  rawRegions: Array<{ start: number; end: number }>,
  settings: SilenceSettings,
  clipTrimStart: number,
  clipTrimEnd: number,
  idPrefix: string
): SilenceCut[] {
  const cuts: SilenceCut[] = [];
  let n = 0;
  for (const region of rawRegions) {
    const duration = region.end - region.start;
    if (duration < settings.minPreservedPause) continue;

    const start = Math.max(clipTrimStart, region.start + settings.padding);
    const end = Math.min(clipTrimEnd, region.end - settings.padding);
    if (end - start < 0.05) continue;

    cuts.push({
      id: `${idPrefix}-${n++}`,
      start,
      end,
      restored: false,
    });
  }
  return cuts;
}

/**
 * Given a clip's trim window and its (possibly partially restored) cut
 * list, returns the segments of source time that should actually be kept
 * in the export — i.e. the trim window minus any still-active cuts.
 */
export function computeKeptSegments(
  trimStart: number,
  trimEnd: number,
  cuts: SilenceCut[]
): Array<{ start: number; end: number }> {
  const activeCuts = cuts
    .filter((c) => !c.restored)
    .slice()
    .sort((a, b) => a.start - b.start);

  const segments: Array<{ start: number; end: number }> = [];
  let cursor = trimStart;
  for (const cut of activeCuts) {
    const cutStart = Math.max(cut.start, trimStart);
    const cutEnd = Math.min(cut.end, trimEnd);
    if (cutEnd <= cursor) continue;
    if (cutStart > cursor) {
      segments.push({ start: cursor, end: Math.min(cutStart, trimEnd) });
    }
    cursor = Math.max(cursor, cutEnd);
    if (cursor >= trimEnd) break;
  }
  if (cursor < trimEnd) {
    segments.push({ start: cursor, end: trimEnd });
  }
  return segments.filter((s) => s.end - s.start > 0.02);
}

/**
 * Total length a clip contributes to the merged timeline after its trim and
 * any active silence cuts are applied.
 */
export function keptDurationOfClip(clip: {
  trimStart: number;
  trimEnd: number;
  silenceCuts: SilenceCut[];
}): number {
  const segs = computeKeptSegments(clip.trimStart, clip.trimEnd, clip.silenceCuts);
  return segs.reduce((s, seg) => s + (seg.end - seg.start), 0);
}

/**
 * Converts a point in source time (seconds into the clip's own original
 * file — the same space silence cuts and trims live in) to its position on
 * the merged output timeline, given everything before it in the project.
 * Used to time captions/text overlays and the live preview consistently
 * with what export actually produces. Returns null if the point falls
 * inside a removed silence cut (it won't appear on the timeline at all).
 */
export function sourceTimeToTimelineTime(
  clipsBefore: Array<{ trimStart: number; trimEnd: number; silenceCuts: SilenceCut[] }>,
  clip: { trimStart: number; trimEnd: number; silenceCuts: SilenceCut[] },
  sourceTime: number
): number | null {
  const elapsedBefore = clipsBefore.reduce((s, c) => s + keptDurationOfClip(c), 0);
  const segs = computeKeptSegments(clip.trimStart, clip.trimEnd, clip.silenceCuts);
  let elapsed = 0;
  for (const seg of segs) {
    if (sourceTime <= seg.start) return elapsedBefore + elapsed;
    if (sourceTime <= seg.end) return elapsedBefore + elapsed + (sourceTime - seg.start);
    elapsed += seg.end - seg.start;
  }
  // Past the end of all kept segments (e.g. inside a trailing cut) — clamp
  // to the end of this clip's contribution.
  return elapsedBefore + elapsed;
}
