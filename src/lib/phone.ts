// Client-side Ethiopian phone normalization/validation, mirroring the server's
// utils/ethioPhone.ts so the import UI can preview what will be accepted.

export type PhoneRow = { phone: string | null; password: string; hasToken: boolean };

export function normalizeEthiopianPhone(raw: unknown): string | null {
  if (raw == null) return null;
  let digits = String(raw).replace(/\D+/g, '');
  if (!digits) return null;
  while (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('251')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[79][0-9]{8}$/.test(digits)) return null;
  return '251' + digits;
}

export interface ParsedAccountFile {
  rows: PhoneRow[];
  valid: number;
  rejected: number;
}

// 9-digit local number for copying (strip +251 / leading 0 country prefix).
// Stored phones look like 2517…/2519…, so this returns the trailing 9 digits.
export function toLocalPhone(phone: unknown): string {
  const digits = String(phone ?? '').replace(/\D+/g, '');
  const withoutCountry = digits.startsWith('251') ? digits.slice(3) : digits.replace(/^0/, '');
  return withoutCountry.slice(-9);
}

// Parse .csv / .json text into normalized rows. CSV: phone,password[,token].
// JSON: {accounts:[{phone|number,password,token?}]} or array of the same.
export function parseAccountFile(text: string, filename: string): ParsedAccountFile {
  const rows: PhoneRow[] = [];
  let rejected = 0;
  const trimmed = text.trim();
  const isJson = /\.json$/i.test(filename) || trimmed.startsWith('[') || trimmed.startsWith('{');

  const push = (phone: unknown, password: unknown, token?: unknown) => {
    const norm = normalizeEthiopianPhone(phone);
    const pw = (password ?? '').toString().trim();
    if (!norm || !pw) { rejected++; return; }
    rows.push({ phone: norm, password: pw, hasToken: token != null && String(token).trim().length > 0 });
  };

  if (isJson) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : parsed?.accounts || [];
      for (const a of arr) {
        if (a) push(a.phone ?? a.number, a.password, a.token);
      }
    } catch {
      return { rows, valid: 0, rejected: 0 };
    }
  } else {
    for (const line of text.split(/\r?\n/)) {
      const cells = line.split(',').map((s) => s.trim());
      if (cells.length >= 2 && (cells[0] || cells[1] || cells[2])) {
        push(cells[0], cells[1], cells[2]);
      }
    }
  }

  return { rows, valid: rows.length, rejected };
}
