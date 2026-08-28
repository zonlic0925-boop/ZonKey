/**
 * 计算器数学核心 — 按 ToolKnit 计算器的公式语义实现。
 * BMI/BMR/体脂率、房贷（等额本息/等额本金 + 逐期计划）、复利（单笔/定投）。
 */

export interface BmiResult {
  bmi: number;
  /** 中国成人标准: <18.5 偏瘦, <24 正常, <28 过重, ≥28 肥胖 */
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
}

export function calculateBmi(heightCm: number, weightKg: number): BmiResult {
  if (heightCm <= 0 || weightKg <= 0) throw new Error('calc:invalid-input');
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  let category: BmiResult['category'] = 'normal';
  if (bmi < 18.5) category = 'underweight';
  else if (bmi >= 28) category = 'obese';
  else if (bmi >= 24) category = 'overweight';
  return { bmi: round(bmi, 1), category };
}

/** Mifflin-St Jeor 公式 */
export function calculateBmr(weightKg: number, heightCm: number, age: number, gender: 'male' | 'female'): number {
  if (weightKg <= 0 || heightCm <= 0 || age <= 0) throw new Error('calc:invalid-input');
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(gender === 'male' ? base + 5 : base - 161);
}

/** Deurenberg 公式 */
export function calculateBodyFat(bmi: number, age: number, gender: 'male' | 'female'): number {
  if (age <= 0) throw new Error('calc:invalid-input');
  const sexFactor = gender === 'male' ? 1 : 0;
  const bodyFat = 1.2 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4;
  return round(Math.max(0, bodyFat), 1);
}

export type MortgageMethod = 'equal_payment' | 'equal_principal';

export interface MortgageSummary {
  method: MortgageMethod;
  /** 等额本息: 固定月供；等额本金: 首月月供 */
  firstMonthPayment: number;
  /** 等额本金: 末月月供 */
  lastMonthPayment: number | null;
  totalPayment: number;
  totalInterest: number;
}

export interface MortgageScheduleRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remaining: number;
}

export function calculateMortgage(
  principal: number,
  annualRatePct: number,
  years: number,
  method: MortgageMethod = 'equal_payment',
): MortgageSummary {
  if (principal <= 0 || annualRatePct < 0 || years <= 0) throw new Error('calc:invalid-input');
  const monthlyRate = annualRatePct / 100 / 12;
  const months = Math.round(years * 12);
  if (months <= 0) throw new Error('calc:invalid-input');

  if (method === 'equal_payment') {
    // 等额本息: M = P·r·(1+r)^n / ((1+r)^n − 1)；r=0 时为直线摊还
    const pow = Math.pow(1 + monthlyRate, months);
    const monthly = monthlyRate === 0 ? principal / months : (principal * monthlyRate * pow) / (pow - 1);
    const totalPayment = monthly * months;
    return {
      method,
      firstMonthPayment: round(monthly, 2),
      lastMonthPayment: null,
      totalPayment: round(totalPayment, 2),
      totalInterest: round(totalPayment - principal, 2),
    };
  }
  // 等额本金: 每月本金固定 P/n，利息按剩余本金计
  const monthlyPrincipal = principal / months;
  const first = monthlyPrincipal + principal * monthlyRate;
  const last = monthlyPrincipal + monthlyPrincipal * monthlyRate;
  const totalInterest = ((months + 1) * principal * monthlyRate) / 2;
  return {
    method,
    firstMonthPayment: round(first, 2),
    lastMonthPayment: round(last, 2),
    totalPayment: round(principal + totalInterest, 2),
    totalInterest: round(totalInterest, 2),
  };
}

export function buildMortgageSchedule(
  principal: number,
  annualRatePct: number,
  years: number,
  method: MortgageMethod,
): MortgageScheduleRow[] {
  const monthlyRate = annualRatePct / 100 / 12;
  const months = Math.round(years * 12);
  const rows: MortgageScheduleRow[] = [];
  let remaining = principal;

  if (method === 'equal_payment') {
    const pow = Math.pow(1 + monthlyRate, months);
    const monthly = monthlyRate === 0 ? principal / months : (principal * monthlyRate * pow) / (pow - 1);
    for (let month = 1; month <= months; month += 1) {
      const interest = remaining * monthlyRate;
      const principalPart = monthly - interest;
      remaining = Math.max(0, remaining - principalPart);
      rows.push({ month, payment: round(monthly, 2), principal: round(principalPart, 2), interest: round(interest, 2), remaining: round(remaining, 2) });
    }
    return rows;
  }
  const monthlyPrincipal = principal / months;
  for (let month = 1; month <= months; month += 1) {
    const interest = remaining * monthlyRate;
    const payment = monthlyPrincipal + interest;
    remaining = Math.max(0, remaining - monthlyPrincipal);
    rows.push({ month, payment: round(payment, 2), principal: round(monthlyPrincipal, 2), interest: round(interest, 2), remaining: round(remaining, 2) });
  }
  return rows;
}

export interface LumpSumResult {
  finalAmount: number;
  totalPrincipal: number;
  totalInterest: number;
}

/** 单笔复利: A = P × (1 + r/n)^(n×t) */
export function calculateLumpSumCompound(
  principal: number,
  annualRatePct: number,
  years: number,
  compoundsPerYear: number = 12,
): LumpSumResult {
  if (principal <= 0 || annualRatePct < 0 || years <= 0 || compoundsPerYear <= 0) throw new Error('calc:invalid-input');
  const r = annualRatePct / 100;
  const n = compoundsPerYear;
  const finalAmount = principal * Math.pow(1 + r / n, n * years);
  return {
    finalAmount: round(finalAmount, 2),
    totalPrincipal: round(principal, 2),
    totalInterest: round(finalAmount - principal, 2),
  };
}

export interface RecurringResult {
  finalAmount: number;
  totalPrincipal: number;
  totalInterest: number;
}

/** 定投复利: 每月投入 PMT，按月复利 FV = PMT × ((1+i)^m − 1)/i + 初始本金复利 */
export function calculateRecurringCompound(
  monthlyContribution: number,
  annualRatePct: number,
  years: number,
  initialPrincipal: number = 0,
): RecurringResult {
  if (monthlyContribution < 0 || annualRatePct < 0 || years <= 0 || initialPrincipal < 0) throw new Error('calc:invalid-input');
  const i = annualRatePct / 100 / 12;
  const m = Math.round(years * 12);
  const grownInitial = initialPrincipal * Math.pow(1 + i, m);
  const contributions = i === 0 ? monthlyContribution * m : monthlyContribution * ((Math.pow(1 + i, m) - 1) / i);
  const finalAmount = grownInitial + contributions;
  const totalPrincipal = initialPrincipal + monthlyContribution * m;
  return {
    finalAmount: round(finalAmount, 2),
    totalPrincipal: round(totalPrincipal, 2),
    totalInterest: round(finalAmount - totalPrincipal, 2),
  };
}

function round(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}
