export function formatLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pl", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
