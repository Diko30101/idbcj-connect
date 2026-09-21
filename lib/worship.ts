// Iisang lugar para sa iskedyul ng Sunday worship. Ang home page, ang I'm New page, at ang footer ay dito kumukuha.
// (Ang Events page ay may sarili pa ring kopya ng mga numerong ito.)

export const WORSHIP = {
  title: "Sunday Worship",
  day: "Sunday",
  hour: 9, // oras sa Pilipinas, 24-hour clock
  minute: 0,
  displayTime: "9:00 AM",
  location: "Medina, Magallanes, Cavite, Philippines",
  streamUrl: "https://idbcj13708.online.church/",
};

const PH_OFFSET_HOURS = 8; // UTC+8 buong taon ang Pilipinas

// Ang susunod na Sunday worship bilang totoong sandali sa oras.
export function nextWorship(now: Date = new Date()) {
  const ph = new Date(now.getTime() + PH_OFFSET_HOURS * 3600 * 1000);
  const daysToSunday = (7 - ph.getUTCDay()) % 7;
  let start =
    Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate() + daysToSunday, WORSHIP.hour, WORSHIP.minute) -
    PH_OFFSET_HOURS * 3600 * 1000;
  if (start < now.getTime()) start += 7 * 24 * 3600 * 1000;
  return new Date(start);
}

function fmt(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// Halimbawa: { philippines: "Sunday 9:00 AM", alberta: "Saturday 7:00 PM" }
// Kusang sumusunod sa summer time / winter time ng Alberta (14 o 15 oras ang pagitan).
export function worshipTimes(now: Date = new Date()) {
  const start = nextWorship(now);
  const clean = (s: string) => s.replace(",", "");
  return {
    philippines: clean(fmt(start, "Asia/Manila")),
    alberta: clean(fmt(start, "America/Edmonton")),
  };
}
