// Маски ввода для клиентских полей: имя, телефон (ОАЭ), номер авто.
// Применяются прямо в onChange — пользователь видит уже отформатированное значение.

/** Имя: только буквы (лат/кир/араб), пробел, дефис, апостроф; без двойных пробелов. */
export function maskName(v: string): string {
  return v
    .replace(/[^\p{L}\s'’-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s+/, "")
    .slice(0, 40);
}

/** Только цифры. */
export function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

/** Локальная часть номера ОАЭ — 9 цифр без префикса +971/0. */
export function uaeLocalDigits(v: string): string {
  let d = digitsOnly(v);
  if (d.startsWith("971")) d = d.slice(3);
  d = d.replace(/^0+/, "");
  return d.slice(0, 9);
}

/** Телефон ОАЭ для отображения: «+971 50 123 4567». */
export function maskPhoneUAE(v: string): string {
  const d = uaeLocalDigits(v);
  if (!d) return "";
  const grouped = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(" ");
  return `+971 ${grouped}`;
}

/** Телефон ОАЭ в каноничном виде для отправки на бэкенд: «+9715XXXXXXXX». */
export function normalizePhoneUAE(v: string): string {
  const d = uaeLocalDigits(v);
  return d ? `+971${d}` : "";
}

/** Полный номер ОАЭ введён (9 локальных цифр). */
export function isPhoneComplete(v: string): boolean {
  return uaeLocalDigits(v).length === 9;
}

/** Номер авто ОАЭ: код (0–2 латинские буквы) + до 5 цифр, например «A 82741». */
export function maskPlate(v: string): string {
  const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const letters = clean.match(/^[A-Z]{0,2}/)?.[0] ?? "";
  const digits = clean.slice(letters.length).replace(/[^0-9]/g, "").slice(0, 5);
  return [letters, digits].filter(Boolean).join(" ");
}
