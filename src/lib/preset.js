export const SPECIAL_PRESET = Object.freeze({ ALL: "__all__", NONE: "__none__" });

export function normalizeIds(ids) {
  return [...new Set(ids)].sort();
}

export function idsEqual(left, right) {
  const a = normalizeIds(left);
  const b = normalizeIds(right);
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function findActivePreset(calendars, presets) {
  const selectedIds = calendars.filter((calendar) => calendar.selected).map((calendar) => calendar.id);
  const allIds = calendars.map((calendar) => calendar.id);

  const match = presets.find((preset) => idsEqual(selectedIds, preset.calendarIds));
  if (match) return match.id;
  if (idsEqual(selectedIds, allIds)) return SPECIAL_PRESET.ALL;
  if (selectedIds.length === 0) return SPECIAL_PRESET.NONE;
  return null;
}

export function createPreset(name, calendarIds, id = crypto.randomUUID()) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("プリセット名を入力してください。");
  return { id, name: cleanName, icon: "📅", calendarIds: normalizeIds(calendarIds) };
}
