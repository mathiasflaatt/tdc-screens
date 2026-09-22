const OSLO_TIME_ZONE = 'Europe/Oslo';

const osloPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: OSLO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** @param {number} year @param {number} month @param {number} day @param {number} hour @param {number} minute @param {number} second @param {number} millisecond */
function makeUtcDate(year, month, day, hour, minute, second, millisecond) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);
  return date;
}

/** Parse feed timestamps as Oslo wall time when they do not include an offset. */
/** @param {string} value @returns {number | null} */
export function parseSessionInstant(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(?:([zZ])|([+-])(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', fractionText = '0', zulu, offsetSign, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(fractionText.slice(0, 3).padEnd(3, '0'));
  const wallDate = makeUtcDate(year, month, day, hour, minute, second, millisecond);

  if (
    wallDate.getUTCFullYear() !== year ||
    wallDate.getUTCMonth() !== month - 1 ||
    wallDate.getUTCDate() !== day ||
    wallDate.getUTCHours() !== hour ||
    wallDate.getUTCMinutes() !== minute ||
    wallDate.getUTCSeconds() !== second ||
    month < 1 || month > 12 || day < 1 || day > 31 ||
    hour > 23 || minute > 59 || second > 59
  ) return null;

  if (zulu || offsetSign) {
    const offsetHour = Number(offsetHourText);
    const offsetMinute = Number(offsetMinuteText);
    if (offsetHour > 23 || offsetMinute > 59) return null;
    const fraction = `.${String(millisecond).padStart(3, '0')}`;
    const offset = zulu ? 'Z' : `${offsetSign}${offsetHourText}:${offsetMinuteText}`;
    const normalized = `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText.padStart(2, '0')}${fraction}${offset}`;
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const wallTime = wallDate.getTime();
  let instant = wallTime;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const values = Object.fromEntries(osloPartsFormatter.formatToParts(instant).map((part) => [part.type, part.value]));
    const representedAsUtc = makeUtcDate(
      Number(values.year),
      Number(values.month),
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
      millisecond,
    ).getTime();
    instant += wallTime - representedAsUtc;
  }

  const finalParts = Object.fromEntries(osloPartsFormatter.formatToParts(instant).map((part) => [part.type, part.value]));
  const matchesOsloWallTime =
    Number(finalParts.year) === year &&
    Number(finalParts.month) === month &&
    Number(finalParts.day) === day &&
    Number(finalParts.hour) === hour &&
    Number(finalParts.minute) === minute &&
    Number(finalParts.second) === second;

  return matchesOsloWallTime && Number.isFinite(instant) ? instant : null;
}
