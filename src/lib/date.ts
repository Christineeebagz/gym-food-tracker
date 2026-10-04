// Always use these instead of `new Date().toISOString().slice(0, 10)`.
// toISOString() converts to UTC first, which silently shifts the date for
// anyone not in the UTC timezone. For the Philippines (UTC+8), any local
// time before 8am would get dated as the previous day. These use the
// browser's local date components instead, so "today" always means today
// wherever the person actually is.

export function dateToString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayString(): string {
  return dateToString(new Date());
}
