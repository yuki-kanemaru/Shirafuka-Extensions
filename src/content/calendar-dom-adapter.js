(() => {
  const CHECKBOX_SELECTOR = 'input[type="checkbox"][aria-label]';
  const ROW_SELECTOR = "[data-id]";

  function decodeCalendarId(encoded) {
    try {
      const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  }

  function getCalendars() {
    const seen = new Set();
    return [...document.querySelectorAll(CHECKBOX_SELECTOR)].flatMap((checkbox) => {
      const row = checkbox.closest(ROW_SELECTOR);
      const encodedId = row?.getAttribute("data-id");
      const id = encodedId ? decodeCalendarId(encodedId) : null;
      if (!id || seen.has(id)) return [];
      seen.add(id);
      return [{
        id,
        name: checkbox.getAttribute("aria-label") || row.textContent.trim() || id,
        selected: checkbox.checked,
        checkbox
      }];
    });
  }

  async function applySelection(targetIds) {
    const target = new Set(targetIds);
    const calendars = getCalendars();
    if (!calendars.length) throw new Error("カレンダー一覧が見つかりません。左サイドバーを開いてください。");

    const changes = calendars.filter((calendar) => calendar.selected !== target.has(calendar.id));
    for (const calendar of changes) {
      calendar.checkbox.click();
      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    const current = getCalendars();
    const failures = current
      .filter((calendar) => calendar.selected !== target.has(calendar.id))
      .map((calendar) => ({ id: calendar.id, name: calendar.name }));
    return { changed: changes.length - failures.length, failures, calendars: current.map(stripElement) };
  }

  function stripElement({ checkbox: _checkbox, ...calendar }) {
    return calendar;
  }

  function findSectionByHeading(pattern) {
    const headings = [...document.querySelectorAll("h1, h2, h3, [role='heading']")];
    return headings.find((element) => pattern.test(element.textContent || ""))?.parentElement ?? null;
  }

  function findBookingPagesSection() {
    return findSectionByHeading(/予約可能なページ|Booking pages|Appointment schedules/i);
  }

  function findInjectionAnchor() {
    return findBookingPagesSection()
      ?? findSectionByHeading(/カレンダー リスト|Calendar list/i);
  }

  function setBookingPagesVisible(visible) {
    const section = findBookingPagesSection();
    if (!section) return false;
    section.classList.toggle("cps-booking-pages-hidden", !visible);
    return true;
  }

  globalThis.CalendarDomAdapter = {
    getCalendars: () => getCalendars().map(stripElement),
    applySelection,
    findInjectionAnchor,
    setBookingPagesVisible
  };
})();
