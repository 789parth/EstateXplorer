import React, { useState, useMemo } from 'react';
import { Calculator, IndianRupee, ShieldCheck, CheckCircle2, TrendingUp, HelpCircle } from 'lucide-react';
import { formatIndianCurrency } from '../../utils/formatters';

const calculateEmi = (principal, annualRate, years) => {
  if (!principal || principal <= 0 || !years || years <= 0) {
    return {
      emi: 0,
      totalPayment: 0,
      totalInterest: 0,
      principalRatio: 0,
      interestRatio: 0,
    };
  }

  const monthlyRate = annualRate / (12 * 100);
  const totalMonths = years * 12;

  if (monthlyRate === 0) {
    const emi = Math.round(principal / totalMonths);
    return {
      emi,
      totalPayment: principal,
      totalInterest: 0,
      principalRatio: 100,
      interestRatio: 0,
    };
  }

  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths);
  const denominator = Math.pow(1 + monthlyRate, totalMonths) - 1;
  const emi = Math.round(numerator / denominator);
  const totalPayment = emi * totalMonths;
  const totalInterest = Math.max(0, totalPayment - principal);

  const principalRatio = totalPayment > 0 ? (principal / totalPayment) * 100 : 0;
  const interestRatio = totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 0;

  return {
    emi,
    totalPayment,
    totalInterest,
    principalRatio,
    interestRatio,
  };
};

const MIN_LOAN = 100000; // Strictly ₹1,00,000 minimum
const MAX_LOAN = 100000000; // ₹10 Crore

const HomeEmiCalculator = () => {
  const [loanAmount, setLoanAmount] = useState(3500000); // Default ₹35 Lakhs
  const [interestRate, setInterestRate] = useState(8.5);
  const [tenureYears, setTenureYears] = useState(20);
  const [validationError, setValidationError] = useState('');

  const { emi, totalPayment, totalInterest, principalRatio, interestRatio } = useMemo(() => {
    const validLoan = Math.max(MIN_LOAN, loanAmount || MIN_LOAN);
    return calculateEmi(validLoan, interestRate, tenureYears);
  }, [loanAmount, interestRate, tenureYears]);

  // Loan Amount Slider Percentage (Linear mapped from MIN_LOAN to MAX_LOAN)
  const loanPercent = Math.min(100, Math.max(0, ((loanAmount - MIN_LOAN) / (MAX_LOAN - MIN_LOAN)) * 100));

  const handleLoanChange = (e) => {
    const pct = Number(e.target.value);
    const rawVal = MIN_LOAN + (pct / 100) * (MAX_LOAN - MIN_LOAN);
    const step = 50000;
    const rounded = Math.max(MIN_LOAN, Math.round(rawVal / step) * step);
    setLoanAmount(rounded);
    setValidationError('');
  };

  const handleInputChange = (e) => {
    const rawDigits = e.target.value.replace(/[^0-9]/g, '');
    const cleanNum = Number(rawDigits);

    if (rawDigits === '' || cleanNum === 0) {
      setValidationError('Loan amount cannot be ₹0. Minimum is ₹1,00,000.');
      setLoanAmount(MIN_LOAN);
      return;
    }

    if (cleanNum < MIN_LOAN) {
      setValidationError('Minimum loan amount is ₹1,00,000.');
    } else {
      setValidationError('');
    }

    setLoanAmount(Math.min(MAX_LOAN, cleanNum));
  };

  const handleInputBlur = () => {
    if (!loanAmount || loanAmount < MIN_LOAN) {
      setLoanAmount(MIN_LOAN);
      setValidationError('');
    }
  };

  // Interest Rate Slider (6.0% to 15.0%)
  const minRate = 6.0;
  const maxRate = 15.0;
  const ratePercent = Math.min(100, Math.max(0, ((interestRate - minRate) / (maxRate - minRate)) * 100));

  // Tenure Slider (1 to 30 Years)
  const minTenure = 1;
  const maxTenure = 30;
  const tenurePercent = Math.min(100, Math.max(0, ((tenureYears - minTenure) / (maxTenure - minTenure)) * 100));

  // Donut SVG Calculations
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const interestStrokeLength = (interestRatio / 100) * circumference;

  return (
    <section className="py-16 bg-gradient-to-b from-slate-50 to-slate-100/70 border-t border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
            <Calculator size={13} className="text-blue-600" />
            <span>Financial Planning &amp; Mortgages</span>
          </div>
          <h2 className="font-display text-[clamp(1.8rem,3.2vw,2.4rem)] font-bold text-slate-900 tracking-tight mb-3">
            Home Loan EMI Calculator
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Plan your property investment with complete financial clarity. Estimate monthly installments, calculate total interest payable, and find tenure plans that fit your budget.
          </p>
        </div>

        {/* Calculator Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-10 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Sliders & Controls (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Slider 1: Loan Amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-sm font-bold text-slate-800 block">
                      Loan Amount
                    </label>
                    <span className="text-[0.72rem] text-slate-500 font-medium">Min ₹1,00,000 (Cannot be ₹0)</span>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="text"
                      value={loanAmount ? Number(loanAmount).toLocaleString('en-IN') : ''}
                      onChange={handleInputChange}
                      onBlur={handleInputBlur}
                      className={`w-36 sm:w-44 text-right pr-3 pl-7 py-1.5 rounded-xl bg-slate-50 border text-sm font-bold text-slate-900 focus:bg-white focus:outline-none transition-all ${
                        validationError ? 'border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-blue-600'
                      }`}
                      placeholder="Loan Amount"
                      title="Directly enter loan amount (Minimum ₹1,00,000)"
                    />
                  </div>
                </div>

                {validationError && (
                  <p className="text-[0.72rem] text-red-600 font-medium mb-1.5 animate-fade-in">
                    {validationError}
                  </p>
                )}

                {/* Range Slider */}
                <div className="relative flex items-center h-6">
                  <div className="absolute inset-x-0 h-2 bg-slate-100 rounded-full" />
                  <div
                    className="absolute left-0 h-2 bg-blue-600 rounded-full pointer-events-none transition-all"
                    style={{ width: `${loanPercent}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={loanPercent}
                    onChange={handleLoanChange}
                    className="relative z-10 w-full h-6 appearance-none bg-transparent cursor-pointer focus:outline-none accent-blue-600"
                  />
                </div>
                <div className="flex justify-between text-[0.7rem] text-slate-400 font-medium mt-1">
                  <span>₹1 Lakh</span>
                  <span>₹25 Lakh</span>
                  <span>₹50 Lakh</span>
                  <span>₹10 Crore</span>
                </div>
              </div>

              {/* Slider 2: Interest Rate */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-sm font-bold text-slate-800 block">
                      Interest Rate (% p.a.)
                    </label>
                    <span className="text-[0.72rem] text-slate-500 font-medium">Standard bank home loan rates</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step={0.1}
                      min={6}
                      max={15}
                      value={interestRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) {
                          setInterestRate(Math.min(15, Math.max(6, val)));
                        }
                      }}
                      className="w-24 text-right pr-6 pl-2 py-1.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
                    />
                    <span className="absolute right-2.5 text-xs font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="relative flex items-center h-6">
                  <div className="absolute inset-x-0 h-2 bg-slate-100 rounded-full" />
                  <div
                    className="absolute left-0 h-2 bg-blue-600 rounded-full pointer-events-none"
                    style={{ width: `${ratePercent}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={ratePercent}
                    onChange={(e) => {
                      const pct = Number(e.target.value);
                      const rawVal = minRate + (pct / 100) * (maxRate - minRate);
                      setInterestRate(Number(rawVal.toFixed(1)));
                    }}
                    className="relative z-10 w-full h-6 appearance-none bg-transparent cursor-pointer focus:outline-none accent-blue-600"
                  />
                </div>
                <div className="flex justify-between text-[0.7rem] text-slate-400 font-medium mt-1">
                  <span>6.0%</span>
                  <span>8.5%</span>
                  <span>11.0%</span>
                  <span>15.0%</span>
                </div>
              </div>

              {/* Slider 3: Loan Tenure */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-sm font-bold text-slate-800 block">
                      Loan Tenure (Years)
                    </label>
                    <span className="text-[0.72rem] text-slate-500 font-medium">{tenureYears * 12} monthly installments</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={tenureYears}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) {
                          setTenureYears(Math.min(30, Math.max(1, Math.round(val))));
                        }
                      }}
                      className="w-24 text-right pr-6 pl-2 py-1.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
                    />
                    <span className="absolute right-2 text-xs font-bold text-slate-500">Yr</span>
                  </div>
                </div>

                <div className="relative flex items-center h-6">
                  <div className="absolute inset-x-0 h-2 bg-slate-100 rounded-full" />
                  <div
                    className="absolute left-0 h-2 bg-blue-600 rounded-full pointer-events-none"
                    style={{ width: `${tenurePercent}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={tenurePercent}
                    onChange={(e) => {
                      const pct = Number(e.target.value);
                      const rawVal = minTenure + (pct / 100) * (maxTenure - minTenure);
                      setTenureYears(Math.round(rawVal));
                    }}
                    className="relative z-10 w-full h-6 appearance-none bg-transparent cursor-pointer focus:outline-none accent-blue-600"
                  />
                </div>
                <div className="flex justify-between text-[0.7rem] text-slate-400 font-medium mt-1">
                  <span>1 Year</span>
                  <span>10 Years</span>
                  <span>20 Years</span>
                  <span>30 Years</span>
                </div>
              </div>
            </div>

            {/* Right Column: Donut & Summary (5 Cols) */}
            <div className="lg:col-span-5 bg-slate-50 border border-slate-200/80 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center">
              {/* Donut Chart */}
              <div className="relative w-44 h-44 mb-6">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                  {/* Background track: Principal (Blue) */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="transparent"
                    stroke="#2563eb"
                    strokeWidth="16"
                  />
                  {/* Foreground stroke: Interest (Orange / Amber) */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="transparent"
                    stroke="#f97316"
                    strokeWidth="16"
                    strokeDasharray={`${interestStrokeLength} ${circumference}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    className="transition-all duration-300"
                  />
                </svg>

                {/* Centered EMI Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                    Monthly EMI
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                    ₹{emi.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[0.65rem] text-slate-500 font-medium">/ month</span>
                </div>
              </div>

              {/* Breakdown Rows */}
              <div className="w-full space-y-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                    <span className="text-slate-600 font-semibold">Principal Loan</span>
                  </div>
                  <span className="font-bold text-slate-900">{formatIndianCurrency(loanAmount)}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                    <span className="text-slate-600 font-semibold">Total Interest</span>
                  </div>
                  <span className="font-bold text-slate-900">{formatIndianCurrency(totalInterest)}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/70">
                  <span className="text-blue-900 font-bold">Total Amount Payable</span>
                  <span className="font-black text-blue-700">{formatIndianCurrency(totalPayment)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeEmiCalculator;
