// BMI & Mortgage & Compound Interest Calculator Core for ToolKnit
export interface BmiResult {
  bmi: number;
  status: string;
  color: string;
}

export function calculateBmi(heightCm: number, weightKg: number): BmiResult {
  if (heightCm <= 0 || weightKg <= 0) return { bmi: 0, status: '请输入有效数值', color: 'text-slate-400' };
  const heightM = heightCm / 100;
  const bmi = Number((weightKg / (heightM * heightM)).toFixed(1));
  let status = '正常';
  let color = 'text-green-500';
  if (bmi < 18.5) {
    status = '偏瘦';
    color = 'text-blue-500';
  } else if (bmi >= 24 && bmi < 28) {
    status = '过重';
    color = 'text-yellow-500';
  } else if (bmi >= 28) {
    status = '肥胖';
    color = 'text-red-500';
  }
  return { bmi, status, color };
}

export interface MortgageResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
}

export function calculateMortgage(
  principal: number,
  annualRatePct: number,
  years: number,
  type: 'equal_installment' | 'equal_principal' = 'equal_installment'
): MortgageResult {
  if (principal <= 0 || annualRatePct <= 0 || years <= 0) {
    return { monthlyPayment: 0, totalPayment: 0, totalInterest: 0 };
  }
  const monthlyRate = annualRatePct / 100 / 12;
  const totalMonths = years * 12;

  if (type === 'equal_installment') {
    // 等额本息
    const monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
      (Math.pow(1 + monthlyRate, totalMonths) - 1);
    const totalPayment = monthlyPayment * totalMonths;
    const totalInterest = totalPayment - principal;
    return {
      monthlyPayment: Number(monthlyPayment.toFixed(2)),
      totalPayment: Number(totalPayment.toFixed(2)),
      totalInterest: Number(totalInterest.toFixed(2)),
    };
  } else {
    // 等额本金 (首月供款)
    const monthlyPrincipal = principal / totalMonths;
    const firstMonthPayment = monthlyPrincipal + principal * monthlyRate;
    const totalInterest = ((totalMonths + 1) * principal * monthlyRate) / 2;
    const totalPayment = principal + totalInterest;
    return {
      monthlyPayment: Number(firstMonthPayment.toFixed(2)),
      totalPayment: Number(totalPayment.toFixed(2)),
      totalInterest: Number(totalInterest.toFixed(2)),
    };
  }
}

export interface CompoundResult {
  finalAmount: number;
  totalInterest: number;
}

export function calculateCompoundInterest(
  principal: number,
  annualRatePct: number,
  years: number,
  compoundTimesPerYear: number = 1
): CompoundResult {
  if (principal <= 0 || annualRatePct <= 0 || years <= 0) {
    return { finalAmount: 0, totalInterest: 0 };
  }
  const r = annualRatePct / 100;
  const n = compoundTimesPerYear;
  const t = years;
  const finalAmount = principal * Math.pow(1 + r / n, n * t);
  const totalInterest = finalAmount - principal;
  return {
    finalAmount: Number(finalAmount.toFixed(2)),
    totalInterest: Number(totalInterest.toFixed(2)),
  };
}
export function convertUnits(value: number, from: string, to: string, category: 'length' | 'weight' | 'temperature'): number {
  if (category === 'length') {
    const toMeter: Record<string, number> = { m: 1, km: 1000, cm: 0.01, mm: 0.001, ft: 0.3048, in: 0.0254, mi: 1609.34 };
    const m = value * (toMeter[from] || 1);
    return m / (toMeter[to] || 1);
  }
  if (category === 'weight') {
    const toKg: Record<string, number> = { kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495 };
    const kg = value * (toKg[from] || 1);
    return kg / (toKg[to] || 1);
  }
  if (category === 'temperature') {
    let c = value;
    if (from === 'f') c = (value - 32) * 5 / 9;
    if (from === 'k') c = value - 273.15;
    if (to === 'c') return c;
    if (to === 'f') return (c * 9 / 5) + 32;
    if (to === 'k') return c + 273.15;
  }
  return value;
}
