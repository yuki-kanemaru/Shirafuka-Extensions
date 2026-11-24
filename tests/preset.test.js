import test from "node:test";
import assert from "node:assert/strict";
import { createPreset, findActivePreset, idsEqual, SPECIAL_PRESET } from "../src/lib/preset.js";

test("Calendar IDの順序にかかわらず完全一致する", () => {
  assert.equal(idsEqual(["b", "a"], ["a", "b"]), true);
  assert.equal(idsEqual(["a", "b"], ["a"]), false);
});

test("追加の表示カレンダーがある場合はプリセット一致にしない", () => {
  const calendars = [{ id: "school", selected: true }, { id: "other", selected: true }];
  const presets = [{ id: "school", calendarIds: ["school"] }];
  assert.equal(findActivePreset(calendars, presets), SPECIAL_PRESET.ALL);
});

test("ユーザープリセットの完全一致を特殊プリセットより優先する", () => {
  const calendars = [{ id: "school", selected: true }, { id: "other", selected: false }];
  const presets = [{ id: "school-preset", calendarIds: ["school"] }];
  assert.equal(findActivePreset(calendars, presets), "school-preset");
});

test("空選択はNoneとして判定する", () => {
  assert.equal(findActivePreset([{ id: "a", selected: false }], []), SPECIAL_PRESET.NONE);
});

test("プリセット名を検証しIDを重複排除する", () => {
  assert.deepEqual(createPreset(" School ", ["b", "a", "a"], "id"), {
    id: "id", name: "School", icon: "📅", calendarIds: ["a", "b"]
  });
  assert.throws(() => createPreset("  ", [], "id"), /プリセット名/);
});
