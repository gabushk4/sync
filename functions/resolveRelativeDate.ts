import { DateTime } from "luxon";


export default function resolveDate({ jour, heure }: { jour: number; heure: string }): string {
  const [h, m] = heure.split(':').map(Number);
  const d = DateTime.now().set({hour: h, minute: m, second: 0, millisecond: 0});
  d.plus({day: jour})
  return d.toSQL(); // ou le format que ton SQLite local attend
}