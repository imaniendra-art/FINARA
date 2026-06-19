export function calculateBillStatus(remainingAmount: number, netAmount: number) {
  if (remainingAmount <= 0) {
    return "paid";
  }

  if (remainingAmount < netAmount) {
    return "partial";
  }

  return "unpaid";
}

export function calculateRemainingAmount(amount: number, discount: number, paidAmount: number) {
  return amount - discount - paidAmount;
}

export function createFinanceNumber(prefix: string) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toISOString().slice(11, 19).replaceAll(":", "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `${prefix}-${date}-${time}-${random}`;
}
