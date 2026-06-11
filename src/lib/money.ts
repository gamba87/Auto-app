export type MoneyCents = number;

export function assertMoneyCents(value: number): MoneyCents {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Money values must be stored as non-negative integer cents.");
  }

  return value;
}

export function formatMoney(cents: MoneyCents, currency = "EUR") {
  assertMoneyCents(cents);
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

export function parseMoneyCents(input: string): MoneyCents {
  const normalized = input.trim().replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter money with no more than two decimal places.");
  }

  const [euros, cents = ""] = normalized.split(".");
  return assertMoneyCents(Number(euros) * 100 + Number(cents.padEnd(2, "0")));
}

export function calculateVatFromGross(
  grossCents: MoneyCents,
  vatRateBps: number,
): MoneyCents {
  assertMoneyCents(grossCents);

  if (!Number.isInteger(vatRateBps) || vatRateBps < 0) {
    throw new Error("VAT rate must be stored as non-negative basis points.");
  }

  return Math.round((grossCents * vatRateBps) / (10_000 + vatRateBps));
}
