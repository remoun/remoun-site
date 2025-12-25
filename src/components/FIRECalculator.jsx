import React, { useState, useMemo } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ComposedChart } from 'recharts';

const formatCurrency = (value) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatCompact = (value) => {
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toFixed(0);
};

const PRESETS = {
  earlyCareer: {
    name: "Early Career",
    description: "Just starting to invest seriously",
    values: { currentAge: 28, currentPortfolio: 100000, annualSavings: 30000, retirementAge: 45, annualSpending: 60000, annualGiving: 10000, sideIncome: 5000 }
  },
  midCareer: {
    name: "Mid-Career",
    description: "Established professional, solid savings",
    values: { currentAge: 38, currentPortfolio: 750000, annualSavings: 40000, retirementAge: 50, annualSpending: 80000, annualGiving: 15000, sideIncome: 10000 }
  },
  coastFire: {
    name: "Coast FIRE",
    description: "Enough invested, coasting to retirement",
    values: { currentAge: 42, currentPortfolio: 1200000, annualSavings: 10000, retirementAge: 50, annualSpending: 70000, annualGiving: 20000, sideIncome: 20000 }
  },
  leanFire: {
    name: "Lean FIRE",
    description: "Minimalist lifestyle, early freedom",
    values: { currentAge: 35, currentPortfolio: 400000, annualSavings: 25000, retirementAge: 42, annualSpending: 40000, annualGiving: 5000, sideIncome: 10000 }
  },
  fatFire: {
    name: "Fat FIRE",
    description: "High income, high lifestyle target",
    values: { currentAge: 40, currentPortfolio: 2000000, annualSavings: 80000, retirementAge: 50, annualSpending: 150000, annualGiving: 40000, sideIncome: 20000 }
  },
};

const Slider = ({ label, value, onChange, min, max, step, format = (v) => v, sublabel }) => (
  <div className="calc-slider">
    <div className="calc-slider__header">
      <div>
        <label className="calc-slider__label">{label}</label>
        {sublabel && <span className="calc-slider__sublabel">{sublabel}</span>}
      </div>
      <span className="calc-slider__value">{format(value)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="calc-slider__input"
    />
    <div className="calc-slider__range">
      <span>{format(min)}</span>
      <span>{format(max)}</span>
    </div>
  </div>
);

const calculateProjection = (params) => {
  const {
    currentAge, currentPortfolio, annualSavings, preReturnRate, retirementAge,
    postReturnRate, annualSpending, annualGiving, sideIncome, sideIncomeEndAge,
    ssIncome, ssHaircut, ssStartAge, inflationRate, lifeExpectancy, spendingSmile,
  } = params;

  const data = [];
  let portfolio = currentPortfolio;

  for (let age = currentAge; age <= lifeExpectancy; age++) {
    const yearsFromRetirement = age - retirementAge;

    if (age < retirementAge) {
      const growth = portfolio * preReturnRate;
      portfolio = portfolio + growth + annualSavings;
      data.push({ age, portfolio: Math.round(portfolio), phase: 'Accumulation', spending: 0, giving: 0, income: annualSavings });
    } else {
      const inflationMult = Math.pow(1 + inflationRate, yearsFromRetirement);

      let spendingMult = 1.0;
      if (spendingSmile) {
        if (age < 55) spendingMult = 1.0;
        else if (age < 70) spendingMult = 0.85;
        else if (age < 80) spendingMult = 0.75;
        else spendingMult = 1.1;
      }

      const baseSpending = annualSpending * inflationMult * spendingMult;

      let givingMult = 1.0;
      if (age >= 70) givingMult = 0.3;
      else if (age >= 55) givingMult = 0.7;
      const giving = annualGiving * inflationMult * givingMult;

      let income = 0;
      if (age < sideIncomeEndAge) income += sideIncome * inflationMult;
      if (age >= ssStartAge) income += ssIncome * (1 - ssHaircut) * inflationMult;

      const netWithdrawal = Math.max(0, baseSpending + giving - income);
      const growth = portfolio * postReturnRate;
      portfolio = portfolio + growth - netWithdrawal;

      data.push({
        age, portfolio: Math.round(portfolio),
        phase: age < 55 ? 'Active' : age < 70 ? 'Settling' : age < 80 ? 'Late' : 'Healthcare',
        spending: Math.round(baseSpending), giving: Math.round(giving),
        income: Math.round(income), withdrawal: Math.round(netWithdrawal),
      });
    }
  }
  return data;
};

export default function FIRECalculator() {
  // Starting situation
  const [currentAge, setCurrentAge] = useState(35);
  const [currentPortfolio, setCurrentPortfolio] = useState(500000);
  const [annualSavings, setAnnualSavings] = useState(25000);

  // Retirement parameters
  const [retirementAge, setRetirementAge] = useState(45);
  const [annualSpending, setAnnualSpending] = useState(70000);
  const [annualGiving, setAnnualGiving] = useState(15000);
  const [sideIncome, setSideIncome] = useState(10000);

  // Advanced parameters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [preReturnRate, setPreReturnRate] = useState(0.07);
  const [postReturnRate, setPostReturnRate] = useState(0.05);
  const [sideIncomeEndAge, setSideIncomeEndAge] = useState(55);
  const [ssIncome, setSsIncome] = useState(25000);
  const [ssHaircut, setSsHaircut] = useState(0.25);
  const [lifeExpectancy, setLifeExpectancy] = useState(95);

  const applyPreset = (presetKey) => {
    const preset = PRESETS[presetKey].values;
    setCurrentAge(preset.currentAge);
    setCurrentPortfolio(preset.currentPortfolio);
    setAnnualSavings(preset.annualSavings);
    setRetirementAge(preset.retirementAge);
    setAnnualSpending(preset.annualSpending);
    setAnnualGiving(preset.annualGiving);
    setSideIncome(preset.sideIncome);
  };

  const fixedParams = { ssStartAge: 67, inflationRate: 0.025, spendingSmile: true };

  const baseParams = {
    currentAge, currentPortfolio, annualSavings, preReturnRate, retirementAge,
    postReturnRate, annualSpending, annualGiving, sideIncome, sideIncomeEndAge,
    ssIncome, ssHaircut, lifeExpectancy, ...fixedParams,
  };

  const dwzProjection = useMemo(() => calculateProjection(baseParams),
    [currentAge, currentPortfolio, annualSavings, preReturnRate, retirementAge,
     postReturnRate, annualSpending, annualGiving, sideIncome, sideIncomeEndAge,
     ssIncome, ssHaircut, lifeExpectancy]);

  const traditionalProjection = useMemo(() => {
    const portfolioAtRetirement = dwzProjection.find(d => d.age === retirementAge)?.portfolio || currentPortfolio;
    const safeSpending = portfolioAtRetirement * 0.04;
    return calculateProjection({ ...baseParams, annualSpending: safeSpending, annualGiving: 5000 });
  }, [dwzProjection, retirementAge, currentPortfolio, baseParams]);

  const combinedData = useMemo(() => {
    return dwzProjection.map((d, i) => ({
      age: d.age, dwz: d.portfolio, traditional: traditionalProjection[i]?.portfolio || 0, phase: d.phase,
    }));
  }, [dwzProjection, traditionalProjection]);

  // Key metrics
  const portfolioAtRetirement = dwzProjection.find(d => d.age === retirementAge)?.portfolio || 0;
  const dwzAtEnd = dwzProjection.find(d => d.age === lifeExpectancy)?.portfolio || 0;
  const traditionalAtEnd = traditionalProjection.find(d => d.age === lifeExpectancy)?.portfolio || 0;
  const dwzDepletionAge = dwzProjection.find(d => d.portfolio < 0)?.age;

  const totalDeployment = annualSpending + annualGiving;
  const netWithdrawalYear1 = totalDeployment - sideIncome;
  const deploymentRate = portfolioAtRetirement > 0 ? (netWithdrawalYear1 / portfolioAtRetirement) * 100 : 0;

  const traditionalSpending = portfolioAtRetirement * 0.04;
  const lifetimeGivingDWZ = annualGiving * Math.max(0, 55 - retirementAge) + annualGiving * 0.7 * 15 + annualGiving * 0.3 * Math.max(0, lifeExpectancy - 70);
  const lifetimeGivingTraditional = 5000 * (lifeExpectancy - retirementAge);

  // Status
  let status, statusType;
  if (dwzDepletionAge && dwzDepletionAge < lifeExpectancy - 10) {
    status = `Runs out at age ${dwzDepletionAge}`;
    statusType = 'danger';
  } else if (dwzDepletionAge) {
    status = `Near zero at ${dwzDepletionAge}`;
    statusType = 'success';
  } else if (Math.abs(dwzAtEnd) < 200000) {
    status = `Dies with ~zero`;
    statusType = 'success';
  } else if (dwzAtEnd < 1000000) {
    status = `${formatCurrency(dwzAtEnd)} left - close`;
    statusType = 'warning';
  } else {
    status = `${formatCurrency(dwzAtEnd)} left - room to deploy more`;
    statusType = 'info';
  }

  return (
    <div className="calc">
      {/* Presets */}
      <div className="calc-presets">
        {Object.entries(PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            className="calc-preset-btn"
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="calc-layout">
        {/* Left Column - Inputs */}
        <div className="calc-inputs">

          <div className="calc-card">
            <h2 className="calc-card__title">
              <span>📍</span> Starting Point
            </h2>

            <Slider label="Current Age" value={currentAge} onChange={setCurrentAge}
              min={22} max={65} step={1} format={(v) => `${v}`} />

            <Slider label="Current Portfolio" value={currentPortfolio} onChange={setCurrentPortfolio}
              min={0} max={42000000} step={25000} format={formatCurrency} />

            <Slider label="Annual Savings" sublabel="until retirement" value={annualSavings}
              onChange={setAnnualSavings} min={0} max={150000} step={5000} format={formatCurrency} />
          </div>

          <div className="calc-card">
            <h2 className="calc-card__title">
              <span>🎯</span> Your Plan
            </h2>

            <Slider label="Retirement Age" value={retirementAge} onChange={setRetirementAge}
              min={Math.max(currentAge + 1, 30)} max={70} step={1} format={(v) => `Age ${v}`} />

            <Slider label="Annual Spending" value={annualSpending} onChange={setAnnualSpending}
              min={20000} max={250000} step={5000} format={(v) => `$${formatCompact(v)}`} />

            <Slider label="Annual Giving" value={annualGiving} onChange={setAnnualGiving}
              min={0} max={100000} step={2500} format={(v) => `$${formatCompact(v)}`} />

            <Slider label="Side Income" sublabel="consulting, projects" value={sideIncome}
              onChange={setSideIncome} min={0} max={100000} step={5000} format={(v) => `$${formatCompact(v)}`} />
          </div>

          <div className="calc-card">
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="calc-toggle">
              <h2 className="calc-card__title">
                <span>⚙️</span> Advanced
              </h2>
              <span className="calc-toggle__icon">{showAdvanced ? '▼' : '▶'}</span>
            </button>

            {showAdvanced && (
              <div className="calc-advanced">
                <Slider label="Pre-Retirement Return" value={preReturnRate} onChange={setPreReturnRate}
                  min={0.03} max={0.12} step={0.01} format={(v) => `${(v * 100).toFixed(0)}%`} />

                <Slider label="Post-Retirement Return" value={postReturnRate} onChange={setPostReturnRate}
                  min={0.02} max={0.08} step={0.005} format={(v) => `${(v * 100).toFixed(1)}%`} />

                <Slider label="Side Income Until" value={sideIncomeEndAge} onChange={setSideIncomeEndAge}
                  min={retirementAge} max={75} step={5} format={(v) => `Age ${v}`} />

                <Slider label="Social Security" sublabel="at age 67" value={ssIncome} onChange={setSsIncome}
                  min={0} max={50000} step={5000} format={(v) => `$${formatCompact(v)}`} />

                <Slider label="SS Haircut" sublabel="assume future cuts" value={ssHaircut} onChange={setSsHaircut}
                  min={0} max={0.5} step={0.05} format={(v) => `${(v * 100).toFixed(0)}%`} />

                <Slider label="Plan Until Age" value={lifeExpectancy} onChange={setLifeExpectancy}
                  min={80} max={250} step={5} format={(v) => `${v}`} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="calc-results">

          <div className="calc-status-row">
            <div className={`calc-status calc-status--${statusType}`}>
              <div className="calc-status__title">{status}</div>
              <div className="calc-status__detail">
                {deploymentRate.toFixed(1)}% deployment rate • {formatCurrency(portfolioAtRetirement)} at retirement
              </div>
            </div>

            <div className="calc-budget">
              <div className="calc-budget__label">Your Monthly Budget</div>
              <div className="calc-budget__row">
                <span className="calc-budget__amount">
                  ${Math.round(totalDeployment / 12).toLocaleString()}
                </span>
                <span className="calc-budget__breakdown">
                  ${Math.round(annualSpending/12).toLocaleString()} + ${Math.round(annualGiving/12).toLocaleString()} giving
                </span>
              </div>
            </div>
          </div>

          <div className="calc-card">
            <h2 className="calc-card__title">Portfolio Trajectory</h2>
            <div className="calc-chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={combinedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="age" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={(v) => v % 10 === 0 ? v : ''} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={formatCurrency} width={60} />
                  <Tooltip
                    formatter={(value, name) => [formatCurrency(value), name === 'dwz' ? 'Die With Zero' : 'Traditional FIRE']}
                    labelFormatter={(label) => `Age ${label}`}
                    contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  />
                  <Legend formatter={(value) => value === 'dwz' ? 'Die With Zero' : 'Traditional FIRE'} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
                  <ReferenceLine x={retirementAge} stroke="var(--text-secondary)" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="traditional" stroke="var(--text-secondary)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="traditional" />
                  <Line type="monotone" dataKey="dwz" stroke="var(--accent)" strokeWidth={3} dot={false} name="dwz" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="calc-comparison">
            <div className="calc-comparison__card calc-comparison__card--muted">
              <h3 className="calc-comparison__title">
                <span>📊</span> Traditional FIRE
              </h3>
              <div className="calc-comparison__rows">
                <div className="calc-comparison__row">
                  <span>4% Safe Withdrawal:</span>
                  <span className="calc-comparison__value">{formatCurrency(traditionalSpending)}/yr</span>
                </div>
                <div className="calc-comparison__row">
                  <span>Monthly Budget:</span>
                  <span className="calc-comparison__value">${Math.round((traditionalSpending + 5000)/12).toLocaleString()}</span>
                </div>
                <div className="calc-comparison__row">
                  <span>Lifetime Giving:</span>
                  <span className="calc-comparison__value">{formatCurrency(lifetimeGivingTraditional)}</span>
                </div>
                <div className="calc-comparison__row calc-comparison__row--total">
                  <span>Left at {lifeExpectancy}:</span>
                  <span className="calc-comparison__value calc-comparison__value--bold">{formatCurrency(traditionalAtEnd)}</span>
                </div>
              </div>
              <div className="calc-comparison__note">Optimizes for: Never running out</div>
            </div>

            <div className="calc-comparison__card calc-comparison__card--highlight">
              <h3 className="calc-comparison__title">
                <span>🎯</span> Die With Zero
              </h3>
              <div className="calc-comparison__rows">
                <div className="calc-comparison__row">
                  <span>Your Spending:</span>
                  <span className="calc-comparison__value">{formatCurrency(annualSpending)}/yr</span>
                </div>
                <div className="calc-comparison__row">
                  <span>Monthly Budget:</span>
                  <span className="calc-comparison__value">${Math.round(totalDeployment/12).toLocaleString()}</span>
                </div>
                <div className="calc-comparison__row">
                  <span>Lifetime Giving:</span>
                  <span className="calc-comparison__value">{formatCurrency(lifetimeGivingDWZ)}</span>
                </div>
                <div className="calc-comparison__row calc-comparison__row--total">
                  <span>Left at {lifeExpectancy}:</span>
                  <span className="calc-comparison__value calc-comparison__value--bold">{formatCurrency(dwzAtEnd)}</span>
                </div>
              </div>
              <div className="calc-comparison__note">Optimizes for: Experiences & impact now</div>
            </div>
          </div>

          <div className="calc-tradeoff">
            <h3 className="calc-tradeoff__title">💡 The Tradeoff</h3>
            <div className="calc-tradeoff__grid">
              <div className="calc-tradeoff__item">
                <div className="calc-tradeoff__value calc-tradeoff__value--spending">
                  {annualSpending > traditionalSpending ? '+' : ''}{formatCurrency(annualSpending - traditionalSpending)}
                </div>
                <div className="calc-tradeoff__label">spending per year</div>
              </div>
              <div className="calc-tradeoff__item">
                <div className="calc-tradeoff__value calc-tradeoff__value--giving">
                  +{formatCurrency(Math.max(0, lifetimeGivingDWZ - lifetimeGivingTraditional))}
                </div>
                <div className="calc-tradeoff__label">more lifetime giving</div>
              </div>
              <div className="calc-tradeoff__item">
                <div className="calc-tradeoff__value calc-tradeoff__value--leftover">
                  {formatCurrency(Math.max(0, traditionalAtEnd - dwzAtEnd))}
                </div>
                <div className="calc-tradeoff__label">less "left over"</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .calc {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .calc-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .calc-preset-btn {
          padding: 0.375rem 0.75rem;
          font-size: 0.875rem;
          font-family: var(--font-display);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 9999px;
          color: var(--text);
          cursor: pointer;
          transition: all 0.15s;
        }

        .calc-preset-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .calc-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        @media (min-width: 1024px) {
          .calc-layout {
            grid-template-columns: 1fr 2fr;
          }
        }

        .calc-inputs {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .calc-results {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .calc-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.25rem;
        }

        .calc-card__title {
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 600;
          color: var(--text);
          margin: 0 0 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .calc-slider {
          margin-bottom: 1rem;
        }

        .calc-slider:last-child {
          margin-bottom: 0;
        }

        .calc-slider__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.25rem;
        }

        .calc-slider__label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text);
        }

        .calc-slider__sublabel {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-left: 0.5rem;
        }

        .calc-slider__value {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--accent);
        }

        .calc-slider__input {
          width: 100%;
          height: 0.5rem;
          background: var(--border);
          border-radius: 0.5rem;
          appearance: none;
          cursor: pointer;
          accent-color: var(--accent);
        }

        .calc-slider__range {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
        }

        .calc-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
        }

        .calc-toggle .calc-card__title {
          margin: 0;
        }

        .calc-toggle__icon {
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .calc-advanced {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }

        .calc-status-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        @media (min-width: 768px) {
          .calc-status-row {
            grid-template-columns: 1fr 1fr;
          }
        }

        .calc-status {
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid var(--border);
        }

        .calc-status--danger {
          background: color-mix(in srgb, #ef4444 10%, var(--bg));
          border-color: color-mix(in srgb, #ef4444 30%, var(--border));
        }

        .calc-status--danger .calc-status__title {
          color: #ef4444;
        }

        .calc-status--success {
          background: color-mix(in srgb, #22c55e 10%, var(--bg));
          border-color: color-mix(in srgb, #22c55e 30%, var(--border));
        }

        .calc-status--success .calc-status__title {
          color: #22c55e;
        }

        .calc-status--warning {
          background: color-mix(in srgb, #eab308 10%, var(--bg));
          border-color: color-mix(in srgb, #eab308 30%, var(--border));
        }

        .calc-status--warning .calc-status__title {
          color: #eab308;
        }

        .calc-status--info {
          background: color-mix(in srgb, var(--accent) 10%, var(--bg));
          border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
        }

        .calc-status--info .calc-status__title {
          color: var(--accent);
        }

        .calc-status__title {
          font-size: 1.125rem;
          font-weight: 600;
        }

        .calc-status__detail {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
        }

        .calc-budget {
          background: color-mix(in srgb, var(--accent) 10%, var(--bg));
          border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
          border-radius: 12px;
          padding: 1rem;
        }

        .calc-budget__label {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 0.25rem;
        }

        .calc-budget__row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        .calc-budget__amount {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text);
        }

        .calc-budget__breakdown {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .calc-chart {
          height: 18rem;
        }

        .calc-comparison {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        @media (min-width: 768px) {
          .calc-comparison {
            grid-template-columns: 1fr 1fr;
          }
        }

        .calc-comparison__card {
          border-radius: 12px;
          padding: 1.25rem;
          border: 1px solid var(--border);
        }

        .calc-comparison__card--muted {
          background: var(--bg-secondary);
        }

        .calc-comparison__card--highlight {
          background: color-mix(in srgb, var(--accent) 10%, var(--bg));
          border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
        }

        .calc-comparison__title {
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 600;
          color: var(--text);
          margin: 0 0 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .calc-comparison__rows {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .calc-comparison__row {
          display: flex;
          justify-content: space-between;
          color: var(--text-secondary);
        }

        .calc-comparison__row--total {
          border-top: 1px solid var(--border);
          padding-top: 0.5rem;
          margin-top: 0.25rem;
        }

        .calc-comparison__value {
          font-weight: 500;
          color: var(--text);
        }

        .calc-comparison__value--bold {
          font-weight: 700;
        }

        .calc-comparison__note {
          margin-top: 0.75rem;
          font-size: 0.75rem;
          font-style: italic;
          color: var(--text-secondary);
        }

        .calc-tradeoff {
          background: color-mix(in srgb, var(--accent) 8%, var(--bg));
          border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border));
          border-radius: 12px;
          padding: 1.25rem;
        }

        .calc-tradeoff__title {
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 600;
          color: var(--text);
          margin: 0 0 0.75rem;
        }

        .calc-tradeoff__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          text-align: center;
        }

        .calc-tradeoff__value {
          font-size: 1.25rem;
          font-weight: 700;
        }

        @media (min-width: 768px) {
          .calc-tradeoff__value {
            font-size: 1.5rem;
          }
        }

        .calc-tradeoff__value--spending {
          color: var(--accent);
        }

        .calc-tradeoff__value--giving {
          color: #22c55e;
        }

        .calc-tradeoff__value--leftover {
          color: #f97316;
        }

        .calc-tradeoff__label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
