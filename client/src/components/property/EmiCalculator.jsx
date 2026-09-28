import React, { useState, useMemo, useEffect } from 'react';

/**
 * Parses numeric property price from either numeric price or string display.
 */
const parseNumericPrice = (priceVal, priceDisplay = '') => {
  if (typeof priceVal === 'number' && priceVal > 0) {
    return priceVal;
  }
  const str = String(priceDisplay || priceVal || '').trim().toLowerCase();
  if (!str) return 0;

  const numMatch = str.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!numMatch) return 0;
  const num = parseFloat(numMatch[1]);
  if (isNaN(num) || num <= 0) return 0;

  if (str.includes('cr') || str.includes('crore')) {
    return Math.round(num * 10000000);
  }
  if (str.includes('l') || str.includes('lac') || str.includes('lakh')) {
    return Math.round(num * 100000);
  }
  if (str.includes('k') || str.includes('thousand')) {
    return Math.round(num * 1000);
  }
  if (num > 1000) {
    return Math.round(num);
  }
  return 0;
};

/**
 * Formats numbers into standard Indian Lakhs / Crores string or comma formatted.
 */
const formatIndianCurrency = (num) => {
  if (!num || isNaN(num) || num <= 0) return '₹ 0';
  const val = Math.round(num);
  if (val >= 10000000) {
    const cr = (val / 10000000).toFixed(2).replace(/\.00$/, '');
    return `₹ ${cr} Cr`;
  }
  if (val >= 100000) {
    const lakh = (val / 100000).toFixed(2).replace(/\.00$/, '');
    return `₹ ${lakh} L`;
  }
  return `₹ ${val.toLocaleString('en-IN')}`;
};

/**
 * Standard EMI Calculation: E = P * r * (1+r)^n / ((1+r)^n - 1)
 */
const calculateEmi = (principal, annualRate, tenureYears) => {
  if (!principal || principal <= 0 || !tenureYears || tenureYears <= 0) {
    return {
      emi: 0,
      totalPayment: 0,
      totalInterest: 0,
      principalRatio: 100,
      interestRatio: 0,
    };
  }

  const monthlyRate = annualRate / 12 / 100;
  const totalMonths = tenureYears * 12;

  if (monthlyRate === 0) {
    const emi = principal / totalMonths;
    return {
      emi: Math.round(emi),
      totalPayment: principal,
      totalInterest: 0,
      principalRatio: 100,
      interestRatio: 0,
    };
  }

  const factor = Math.pow(1 + monthlyRate, totalMonths);
  const emi = (principal * monthlyRate * factor) / (factor - 1);
  const totalPayment = emi * totalMonths;
  const totalInterest = Math.max(0, totalPayment - principal);

  const principalRatio = totalPayment > 0 ? (principal / totalPayment) * 100 : 100;
  const interestRatio = Math.max(0, 100 - principalRatio);

  return {
    emi: Math.round(emi),
    totalPayment: Math.round(totalPayment),
    totalInterest: Math.round(totalInterest),
    principalRatio,
    interestRatio,
  };
};

const EmiCalculator = ({ property }) => {
  const propertyPrice = useMemo(() => {
    if (!property) return 0;
    return parseNumericPrice(property.price, property.priceDisplay);
  }, [property]);

  // Determine dynamic loan limits based on property price
  // Strictly: Min loan amount is 20% of property/project price, Max loan amount is total price of property/project
  const { minLoan, maxLoan, defaultLoan } = useMemo(() => {
    if (propertyPrice && propertyPrice > 0) {
      const min = Math.round(propertyPrice * 0.2); // 20% of property/project price
      const max = Math.round(propertyPrice); // 100% of property/project price
      const standard80 = Math.round(propertyPrice * 0.8);
      const def = Math.min(max, Math.max(min, standard80));
      return { minLoan: min, maxLoan: max, defaultLoan: def };
    }
    const fallbackPrice = 5000000;
    return {
      minLoan: Math.round(fallbackPrice * 0.2),
      maxLoan: fallbackPrice,
      defaultLoan: Math.round(fallbackPrice * 0.8),
    };
  }, [propertyPrice]);

  const [loanAmount, setLoanAmount] = useState(defaultLoan);
  const [loanAmountInput, setLoanAmountInput] = useState(Number(defaultLoan).toLocaleString('en-IN'));
  const [loanError, setLoanError] = useState('');
  const [interestRate, setInterestRate] = useState(8.5);
  const [tenureYears, setTenureYears] = useState(20);

  // Sync loan amount when property price changes
  useEffect(() => {
    if (defaultLoan) {
      setLoanAmount(defaultLoan);
      setLoanAmountInput(Number(defaultLoan).toLocaleString('en-IN'));
      setLoanError('');
    }
  }, [defaultLoan]);

  const { emi, totalPayment, totalInterest, principalRatio, interestRatio } = useMemo(() => {
    return calculateEmi(loanAmount, interestRate, tenureYears);
  }, [loanAmount, interestRate, tenureYears]);

  // Loan Amount Slider Percentage (Linear mapped from minLoan to maxLoan)
  const loanPercent = maxLoan > minLoan
    ? Math.min(100, Math.max(0, ((loanAmount - minLoan) / (maxLoan - minLoan)) * 100))
    : 0;

  const handleLoanChange = (e) => {
    const pct = Number(e.target.value);
    if (pct <= 0) {
      setLoanAmount(minLoan);
      setLoanAmountInput(minLoan.toLocaleString('en-IN'));
      setLoanError('');
      return;
    }
    if (pct >= 100) {
      setLoanAmount(maxLoan);
      setLoanAmountInput(maxLoan.toLocaleString('en-IN'));
      setLoanError('');
      return;
    }
    const rawVal = minLoan + (pct / 100) * (maxLoan - minLoan);
    const span = maxLoan - minLoan;
    const step = span > 10000000 ? 100000 : span > 1000000 ? 50000 : 10000;
    const rounded = Math.round(rawVal / step) * step;
    const computedVal = Math.min(maxLoan, Math.max(minLoan, rounded));
    setLoanAmount(computedVal);
    setLoanAmountInput(computedVal.toLocaleString('en-IN'));
    setLoanError('');
  };

  // Interest Rate Slider (4.0% to 15.0%)
  const minRate = 4.0;
  const maxRate = 15.0;
  const ratePercent = Math.min(100, Math.max(0, ((interestRate - minRate) / (maxRate - minRate)) * 100));

  const handleRateChange = (e) => {
    const pct = Number(e.target.value);
    if (pct <= 0) {
      setInterestRate(minRate);
      return;
    }
    if (pct >= 100) {
      setInterestRate(maxRate);
      return;
    }
    const rawVal = minRate + (pct / 100) * (maxRate - minRate);
    setInterestRate(Number(rawVal.toFixed(1)));
  };

  // Tenure Slider (5 to 30 Years)
  const minTenure = 5;
  const maxTenure = 30;
  const tenurePercent = Math.min(100, Math.max(0, ((tenureYears - minTenure) / (maxTenure - minTenure)) * 100));

  const handleTenureChange = (e) => {
    const pct = Number(e.target.value);
    if (pct <= 0) {
      setTenureYears(minTenure);
      return;
    }
    if (pct >= 100) {
      setTenureYears(maxTenure);
      return;
    }
    const rawVal = minTenure + (pct / 100) * (maxTenure - minTenure);
    setTenureYears(Math.round(rawVal));
  };

  // Donut SVG Calculations
  // Radius = 62, viewBox = 160 x 160, center = (80, 80)
  // Circumference = 2 * PI * 62 ≈ 389.557
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  // Interest stroke dash length
  const interestStrokeLength = (interestRatio / 100) * circumference;

  return (
    <section
      id="emi-calculator"
      className="pd-card p-6 sm:p-8 bg-white border border-slate-200/90 rounded-2xl shadow-xs text-left mb-6"
    >
      {/* ── Title matching Image 2 ── */}
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-8">
        Home Loan EMI Estimate
      </h2>

      {/* ── 2-Column Responsive Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* ── Left Column: Sliders & 4-Row Breakdown Table (7 cols) ── */}
        <div className="lg:col-span-7 space-y-7">
          {/* Slider 1: Loan amount */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-sm font-medium text-slate-600 block">
                  Loan amount
                </label>
                <span className="text-[0.68rem] text-slate-400">Min ₹{minLoan.toLocaleString('en-IN')}</span>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="text"
                  value={loanAmountInput}
                  onChange={(e) => {
                    const rawVal = e.target.value.replace(/[^0-9]/g, '');
                    if (rawVal === '') {
                      setLoanAmountInput('');
                      setLoanError(`Loan amount cannot be ₹0 (Min: ₹${minLoan.toLocaleString('en-IN')})`);
                      return;
                    }
                    const cleanNum = Number(rawVal);
                    setLoanAmountInput(cleanNum.toLocaleString('en-IN'));
                    if (cleanNum <= 0) {
                      setLoanError(`Loan amount cannot be ₹0 (Min: ₹${minLoan.toLocaleString('en-IN')})`);
                    } else if (cleanNum < minLoan) {
                      setLoanError(`Minimum loan amount is ₹${minLoan.toLocaleString('en-IN')} (20% of price)`);
                      setLoanAmount(minLoan);
                    } else if (cleanNum > maxLoan) {
                      setLoanError(`Maximum loan amount is ₹${maxLoan.toLocaleString('en-IN')} (total price)`);
                      setLoanAmount(maxLoan);
                    } else {
                      setLoanError('');
                      setLoanAmount(cleanNum);
                    }
                  }}
                  onBlur={() => {
                    const cleanNum = Number(loanAmountInput.replace(/[^0-9]/g, ''));
                    if (!cleanNum || cleanNum < minLoan) {
                      setLoanAmount(minLoan);
                      setLoanAmountInput(minLoan.toLocaleString('en-IN'));
                      setLoanError('');
                    } else if (cleanNum > maxLoan) {
                      setLoanAmount(maxLoan);
                      setLoanAmountInput(maxLoan.toLocaleString('en-IN'));
                      setLoanError('');
                    } else {
                      setLoanAmount(cleanNum);
                      setLoanAmountInput(cleanNum.toLocaleString('en-IN'));
                      setLoanError('');
                    }
                  }}
                  className={`w-32 sm:w-36 text-right pr-3 pl-6 py-1 rounded-full bg-slate-50 border text-sm font-semibold text-slate-900 shadow-2xs focus:bg-white focus:outline-none transition-colors ${
                    loanError ? 'border-rose-500 focus:border-rose-500 text-rose-600' : 'border-slate-300 focus:border-blue-500'
                  }`}
                  placeholder="Loan Amount"
                  title={`Enter loan amount (Min ₹${minLoan.toLocaleString('en-IN')}, Max ₹${maxLoan.toLocaleString('en-IN')})`}
                />
              </div>
            </div>
            {loanError && (
              <p className="text-[0.72rem] font-semibold text-rose-500 text-right mb-1">
                {loanError}
              </p>
            )}
            <div className="relative flex items-center h-6">
              <div className="absolute inset-x-0 h-2 bg-slate-200 rounded-full" />
              <div
                className="absolute left-0 h-2 bg-slate-900 rounded-full pointer-events-none"
                style={{ width: `${loanPercent}%` }}
              />
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={loanPercent}
                onChange={handleLoanChange}
                className="emi-range-input relative z-10 w-full h-6 appearance-none bg-transparent cursor-pointer focus:outline-none"
              />
            </div>
          </div>

          {/* Slider 2: Rate of interest (p.a.) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-600">
                Rate of interest (p.a.)
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  step="0.1"
                  min={minRate}
                  max={maxRate}
                  value={interestRate}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setInterestRate(Math.min(maxRate, Math.max(minRate, Number(val.toFixed(1)))));
                    }
                  }}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val) || val < minRate) {
                      setInterestRate(minRate);
                    } else if (val > maxRate) {
                      setInterestRate(maxRate);
                    }
                  }}
                  className="w-20 text-center pr-4 pl-2 py-1 rounded-full bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 shadow-2xs focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                  title={`Directly enter interest rate (${minRate}% - ${maxRate}%)`}
                />
                <span className="absolute right-2.5 text-xs font-bold text-slate-400 pointer-events-none">%</span>
              </div>
            </div>
            <div className="relative flex items-center h-6">
              <div className="absolute inset-x-0 h-2 bg-slate-200 rounded-full" />
              <div
                className="absolute left-0 h-2 bg-slate-900 rounded-full pointer-events-none"
                style={{ width: `${ratePercent}%` }}
              />
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={ratePercent}
                onChange={handleRateChange}
                className="emi-range-input relative z-10 w-full h-6 appearance-none bg-transparent cursor-pointer focus:outline-none"
              />
            </div>
          </div>

          {/* Slider 3: Loan tenure */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-600">
                Loan tenure
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  step="1"
                  min={minTenure}
                  max={maxTenure}
                  value={tenureYears}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      setTenureYears(Math.min(maxTenure, Math.max(minTenure, val)));
                    }
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (isNaN(val) || val < minTenure) {
                      setTenureYears(minTenure);
                    } else if (val > maxTenure) {
                      setTenureYears(maxTenure);
                    }
                  }}
                  className="w-20 text-center pr-5 pl-2 py-1 rounded-full bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 shadow-2xs focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                  title={`Directly enter tenure in years (${minTenure} - ${maxTenure} Yr)`}
                />
                <span className="absolute right-2.5 text-xs font-bold text-slate-400 pointer-events-none">Yr</span>
              </div>
            </div>
            <div className="relative flex items-center h-6">
              <div className="absolute inset-x-0 h-2 bg-slate-200 rounded-full" />
              <div
                className="absolute left-0 h-2 bg-slate-900 rounded-full pointer-events-none"
                style={{ width: `${tenurePercent}%` }}
              />
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={tenurePercent}
                onChange={handleTenureChange}
                className="emi-range-input relative z-10 w-full h-6 appearance-none bg-transparent cursor-pointer focus:outline-none"
              />
            </div>
          </div>

          {/* 4-Row Metrics Summary matching Image 2 */}
          <div className="pt-5 border-t border-slate-100 space-y-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 font-normal">Monthly EMI</span>
              <span className="font-semibold text-slate-900 text-base">
                ₹ {emi.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 font-normal">Principal amount</span>
              <span className="font-semibold text-slate-900 text-base">
                {formatIndianCurrency(loanAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 font-normal">Total interest</span>
              <span className="font-semibold text-slate-900 text-base">
                ₹ {totalInterest.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 font-normal">Total amount</span>
              <span className="font-bold text-slate-900 text-base">
                ₹ {totalPayment.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* ── Right Column: Donut Chart with Center EMI and Legend (5 cols) ── */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center pt-2 lg:pt-0">
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 160 160"
            >
              {/* Background / Principal Circle (Light Slate Gray #e2e8f0) */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="#e2e8f0"
                strokeWidth="18"
                fill="none"
              />
              {/* Foreground / Interest Arc (Dark Navy #0b1528) */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="#0b1528"
                strokeWidth="18"
                fill="none"
                strokeDasharray={`${interestStrokeLength} ${circumference}`}
                strokeDashoffset="0"
                strokeLinecap="round"
                className="transition-all duration-300 ease-out"
              />
            </svg>

            {/* Centered EMI Content inside Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                MONTHLY EMI
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                ₹ {emi.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Legend below Donut matching Image 2 */}
          <div className="flex items-center justify-center gap-7 mt-5">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-slate-200 shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-slate-600">Principal</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#0b1528] shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-slate-600">Interest</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EmiCalculator;