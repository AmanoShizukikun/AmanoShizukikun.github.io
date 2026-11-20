// The lunar date of a day, from the browser's own calendar data (Intl, "chinese" calendar). Returns null where
// the browser has none, and the calendar then simply shows no second line.
let fmt = null;
try {
  fmt = new Intl.DateTimeFormat('zh-TW-u-ca-chinese', { month: 'long', day: 'numeric' });
  if (fmt.resolvedOptions().calendar !== 'chinese') fmt = null;
} catch { fmt = null; }

const TENS = ['初', '十', '廿', '三'], ONES = ['十', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const dayName = (d) => (d === 10 ? '初十' : d === 20 ? '二十' : d === 30 ? '三十' : TENS[Math.floor(d / 10)] + ONES[d % 10]);

/** { month: '十月', day: 9, name: '初九', text: '十月初九' } */
export function lunar(date) {
  if (!fmt) return null;
  try {
    const parts = fmt.formatToParts(date);
    const month = parts.find((x) => x.type === 'month')?.value, day = Number(parts.find((x) => x.type === 'day')?.value);
    if (!month || !(day >= 1 && day <= 30)) return null;
    return { month, day, name: dayName(day), text: month + dayName(day) };
  } catch { return null; }
}
