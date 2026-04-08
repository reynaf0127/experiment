import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Upload, FlaskConical, TrendingUp, TrendingDown, Minus, CheckCircle2, Users, Target, BarChart3, AlertCircle, FileText } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface ABTestData {
  testName: string;
  metric: string;
  control: {
    name: string;
    visitors: number;
    conversions: number;
    conversionRate: number;
  };
  variant: {
    name: string;
    visitors: number;
    conversions: number;
    conversionRate: number;
  };
  improvement: number;
  confidence: number;
  isSignificant: boolean;
  dailyData?: Array<{
    date: string;
    controlConversions: number;
    variantConversions: number;
    controlVisitors: number;
    variantVisitors: number;
  }>;
}

export function ExperimentLab() {
  const [testData, setTestData] = useState<ABTestData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsedData = parseCSV(text);
        setTestData(parsedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      }
    };

    reader.readAsText(file);
  };

  const parseCSV = (text: string): ABTestData => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Expected format: variant,visitors,conversions
    // Or: date,control_visitors,control_conversions,variant_visitors,variant_conversions
    
    if (headers.includes('date')) {
      // Time series format
      return parseTimeSeriesCSV(lines);
    } else {
      // Summary format
      return parseSummaryCSV(lines);
    }
  };

  const parseSummaryCSV = (lines: string[]): ABTestData => {
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      return {
        variant: values[0],
        visitors: parseInt(values[1]),
        conversions: parseInt(values[2])
      };
    });

    if (data.length !== 2) {
      throw new Error('CSV must contain exactly 2 rows of data (control and variant)');
    }

    const control = data[0];
    const variant = data[1];

    const controlRate = (control.conversions / control.visitors) * 100;
    const variantRate = (variant.conversions / variant.visitors) * 100;
    const improvement = ((variantRate - controlRate) / controlRate) * 100;

    // Calculate statistical significance using z-test
    const { confidence, isSignificant } = calculateSignificance(
      control.conversions, control.visitors,
      variant.conversions, variant.visitors
    );

    return {
      testName: 'Uploaded A/B Test',
      metric: 'Conversion Rate',
      control: {
        name: control.variant,
        visitors: control.visitors,
        conversions: control.conversions,
        conversionRate: controlRate,
      },
      variant: {
        name: variant.variant,
        visitors: variant.visitors,
        conversions: variant.conversions,
        conversionRate: variantRate,
      },
      improvement,
      confidence,
      isSignificant,
    };
  };

  const parseTimeSeriesCSV = (lines: string[]): ABTestData => {
    const dailyData = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      return {
        date: values[0],
        controlVisitors: parseInt(values[1]),
        controlConversions: parseInt(values[2]),
        variantVisitors: parseInt(values[3]),
        variantConversions: parseInt(values[4]),
      };
    });

    const totals = dailyData.reduce((acc, day) => ({
      controlVisitors: acc.controlVisitors + day.controlVisitors,
      controlConversions: acc.controlConversions + day.controlConversions,
      variantVisitors: acc.variantVisitors + day.variantVisitors,
      variantConversions: acc.variantConversions + day.variantConversions,
    }), { controlVisitors: 0, controlConversions: 0, variantVisitors: 0, variantConversions: 0 });

    const controlRate = (totals.controlConversions / totals.controlVisitors) * 100;
    const variantRate = (totals.variantConversions / totals.variantVisitors) * 100;
    const improvement = ((variantRate - controlRate) / controlRate) * 100;

    const { confidence, isSignificant } = calculateSignificance(
      totals.controlConversions, totals.controlVisitors,
      totals.variantConversions, totals.variantVisitors
    );

    return {
      testName: 'Uploaded A/B Test',
      metric: 'Conversion Rate',
      control: {
        name: 'Control',
        visitors: totals.controlVisitors,
        conversions: totals.controlConversions,
        conversionRate: controlRate,
      },
      variant: {
        name: 'Variant',
        visitors: totals.variantVisitors,
        conversions: totals.variantConversions,
        conversionRate: variantRate,
      },
      improvement,
      confidence,
      isSignificant,
      dailyData,
    };
  };

  const calculateSignificance = (
    conversionsA: number, visitorsA: number,
    conversionsB: number, visitorsB: number
  ) => {
    const pA = conversionsA / visitorsA;
    const pB = conversionsB / visitorsB;
    const pooledP = (conversionsA + conversionsB) / (visitorsA + visitorsB);
    
    const sePooled = Math.sqrt(pooledP * (1 - pooledP) * (1 / visitorsA + 1 / visitorsB));
    const zScore = Math.abs((pB - pA) / sePooled);
    
    // Calculate p-value from z-score (two-tailed test)
    const pValue = 2 * (1 - normalCDF(zScore));
    const confidence = (1 - pValue) * 100;
    const isSignificant = confidence >= 95;

    return { confidence, isSignificant };
  };

  // Normal cumulative distribution function approximation
  const normalCDF = (z: number): number => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  };

  const loadSampleData = () => {
    const sampleData: ABTestData = {
      testName: 'Sample A/B Test',
      metric: 'Click-through Rate',
      control: {
        name: 'Control',
        visitors: 10000,
        conversions: 1500,
        conversionRate: 15.0,
      },
      variant: {
        name: 'Variant',
        visitors: 10000,
        conversions: 1750,
        conversionRate: 17.5,
      },
      improvement: 16.67,
      confidence: 99.8,
      isSignificant: true,
      dailyData: [
        { date: '03/20', controlConversions: 150, variantConversions: 175, controlVisitors: 1000, variantVisitors: 1000 },
        { date: '03/21', controlConversions: 145, variantConversions: 172, controlVisitors: 1000, variantVisitors: 1000 },
        { date: '03/22', controlConversions: 155, variantConversions: 180, controlVisitors: 1000, variantVisitors: 1000 },
        { date: '03/23', controlConversions: 148, variantConversions: 173, controlVisitors: 1000, variantVisitors: 1000 },
        { date: '03/24', controlConversions: 152, variantConversions: 178, controlVisitors: 1000, variantVisitors: 1000 },
        { date: '03/25', controlConversions: 150, variantConversions: 175, controlVisitors: 1000, variantVisitors: 1000 },
        { date: '03/26', controlConversions: 147, variantConversions: 174, controlVisitors: 1000, variantVisitors: 1000 },
        { date: '03/27', controlConversions: 153, variantConversions: 179, controlVisitors: 1000, variantVisitors: 1000 },
        { date: '03/28', controlConversions: 149, variantConversions: 176, controlVisitors: 1000, variantVisitors: 1000 },
        { date: '03/29', controlConversions: 151, variantConversions: 168, controlVisitors: 1000, variantVisitors: 1000 },
      ],
    };
    setTestData(sampleData);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FlaskConical className="size-8 text-cyan-600" />
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Experiment Lab</h1>
                <p className="text-slate-600">Analyze your A/B test results</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={loadSampleData}>
                <FileText className="size-4 mr-2" />
                Load Sample Data
              </Button>
              <label htmlFor="csv-upload">
                <Button asChild>
                  <span className="cursor-pointer">
                    <Upload className="size-4 mr-2" />
                    Upload CSV Data
                  </span>
                </Button>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Card className="mb-6 border-rose-200 bg-rose-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="size-5 text-rose-600 mt-0.5" />
                <div>
                  <div className="font-medium text-rose-900">Error parsing CSV</div>
                  <div className="text-sm text-rose-700 mt-1">{error}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!testData ? (
          <EmptyState />
        ) : (
          <TestResults data={testData} />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed border-2 border-slate-300">
      <CardContent className="py-16">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="size-16 bg-cyan-100 rounded-full flex items-center justify-center">
              <Upload className="size-8 text-cyan-600" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Upload Your A/B Test Data</h3>
            <p className="text-slate-600 max-w-md mx-auto">
              Upload a CSV file with your test results to see detailed analysis and statistical significance
            </p>
          </div>
          <div className="pt-4">
            <div className="bg-slate-50 rounded-lg p-4 max-w-xl mx-auto text-left border border-slate-200">
              <div className="font-medium text-slate-900 mb-2">CSV Format Options:</div>
              <div className="space-y-3 text-sm text-slate-700">
                <div>
                  <div className="font-medium text-slate-800">Summary Format:</div>
                  <code className="block bg-white p-2 rounded mt-1 text-xs border border-slate-200">
                    variant,visitors,conversions<br />
                    Control,10000,1500<br />
                    Variant,10000,1750
                  </code>
                </div>
                <div>
                  <div className="font-medium text-slate-800">Time Series Format:</div>
                  <code className="block bg-white p-2 rounded mt-1 text-xs border border-slate-200">
                    date,control_visitors,control_conversions,variant_visitors,variant_conversions<br />
                    03/20,1000,150,1000,175<br />
                    03/21,1000,145,1000,172
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TestResults({ data }: { data: ABTestData }) {
  const getImprovementIcon = () => {
    if (data.improvement > 0) return <TrendingUp className="size-5 text-teal-600" />;
    if (data.improvement < 0) return <TrendingDown className="size-5 text-rose-600" />;
    return <Minus className="size-5 text-slate-400" />;
  };

  const getImprovementColor = () => {
    if (data.improvement > 0) return 'text-teal-600';
    if (data.improvement < 0) return 'text-rose-600';
    return 'text-slate-600';
  };

  const pieData = [
    { name: data.control.name, value: data.control.visitors, color: '#64748b' },
    { name: data.variant.name, value: data.variant.visitors, color: '#0891b2' },
  ];

  const conversionRateData = data.dailyData?.map(day => ({
    date: day.date,
    control: ((day.controlConversions / day.controlVisitors) * 100).toFixed(2),
    variant: ((day.variantConversions / day.variantVisitors) * 100).toFixed(2),
  }));

  const dailyConversionsData = data.dailyData?.map(day => ({
    date: day.date,
    control: day.controlConversions,
    variant: day.variantConversions,
  }));

  return (
    <div className="space-y-6">
      {/* Test Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{data.testName}</CardTitle>
              <CardDescription>Metric: {data.metric}</CardDescription>
            </div>
            <div className="text-right">
              <div className={`flex items-center gap-2 text-4xl font-bold ${getImprovementColor()}`}>
                {getImprovementIcon()}
                {data.improvement > 0 ? '+' : ''}{data.improvement.toFixed(1)}%
              </div>
              <div className="text-sm text-slate-600 mt-1">
                {data.confidence.toFixed(1)}% confidence
              </div>
              {data.isSignificant && (
                <Badge className="mt-2 bg-teal-100 text-teal-800 hover:bg-teal-100">
                  <CheckCircle2 className="size-3 mr-1" />
                  Statistically Significant
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Total Visitors</CardDescription>
              <Users className="size-5 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {(data.control.visitors + data.variant.visitors).toLocaleString()}
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Split across variants
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Total Conversions</CardDescription>
              <Target className="size-5 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {(data.control.conversions + data.variant.conversions).toLocaleString()}
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Across both variants
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Improvement</CardDescription>
              <BarChart3 className="size-5 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getImprovementColor()}`}>
              {data.improvement > 0 ? '+' : ''}{data.improvement.toFixed(2)}%
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Variant vs. Control
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Rate Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Control: {data.control.name}</CardTitle>
            <CardDescription>Baseline performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Visitors</span>
                <span className="text-2xl font-bold">{data.control.visitors.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Conversions</span>
                <span className="text-2xl font-bold">{data.control.conversions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-sm text-slate-600">Conversion Rate</span>
                <span className="text-3xl font-bold text-slate-900">{data.control.conversionRate.toFixed(2)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variant: {data.variant.name}</CardTitle>
            <CardDescription>Testing alternative</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Visitors</span>
                <span className="text-2xl font-bold">{data.variant.visitors.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Conversions</span>
                <span className="text-2xl font-bold">{data.variant.conversions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-sm text-slate-600">Conversion Rate</span>
                <span className="text-3xl font-bold text-cyan-600">{data.variant.conversionRate.toFixed(2)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Series Charts - Only show if daily data exists */}
      {data.dailyData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Conversion Rate Over Time</CardTitle>
              <CardDescription>Daily conversion rate comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={conversionRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" />
                  <YAxis label={{ value: 'Conversion Rate (%)', angle: -90, position: 'insideLeft' }} stroke="#64748b" />
                  <Tooltip
                    formatter={(value: number) => `${value}%`}
                    labelStyle={{ color: '#000' }}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.5rem' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="control"
                    stroke="#64748b"
                    name={data.control.name}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="variant"
                    stroke="#0891b2"
                    name={data.variant.name}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Conversions</CardTitle>
              <CardDescription>Number of conversions per day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyConversionsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" />
                  <YAxis label={{ value: 'Conversions', angle: -90, position: 'insideLeft' }} stroke="#64748b" />
                  <Tooltip
                    labelStyle={{ color: '#000' }}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.5rem' }}
                  />
                  <Legend />
                  <Bar dataKey="control" fill="#64748b" name={data.control.name} />
                  <Bar dataKey="variant" fill="#0891b2" name={data.variant.name} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Traffic Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Traffic Distribution</CardTitle>
          <CardDescription>Visitor split between variants</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value.toLocaleString()} (${(percent * 100).toFixed(1)}%)`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.5rem' }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Statistical Significance */}
      <Card>
        <CardHeader>
          <CardTitle>Statistical Analysis</CardTitle>
          <CardDescription>Confidence and significance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <div className="font-medium text-slate-900">Confidence Level</div>
                <div className="text-sm text-slate-600">How confident we are in the results</div>
              </div>
              <div className="text-3xl font-bold text-cyan-600">{data.confidence.toFixed(1)}%</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <div className="font-medium text-slate-900">Statistical Significance</div>
                <div className="text-sm text-slate-600">Whether results are reliable (≥95% confidence)</div>
              </div>
              <div>
                {data.isSignificant ? (
                  <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100 text-lg px-3 py-1">
                    <CheckCircle2 className="size-4 mr-1" />
                    Significant
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-lg px-3 py-1">
                    Not Significant
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <div className="font-medium text-slate-900">Sample Size</div>
                <div className="text-sm text-slate-600">Total visitors across both variants</div>
              </div>
              <div className="text-3xl font-bold text-slate-900">
                {(data.control.visitors + data.variant.visitors).toLocaleString()}
              </div>
            </div>

            {data.isSignificant && data.improvement > 0 && (
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-teal-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-teal-900">Recommended Action</div>
                    <div className="text-sm text-teal-700 mt-1">
                      The variant "{data.variant.name}" shows a statistically significant improvement of {data.improvement.toFixed(1)}%.
                      Consider implementing this variant.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {data.isSignificant && data.improvement < 0 && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <TrendingDown className="size-5 text-rose-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-rose-900">Recommended Action</div>
                    <div className="text-sm text-rose-700 mt-1">
                      The variant "{data.variant.name}" shows a statistically significant decline of {Math.abs(data.improvement).toFixed(1)}%.
                      Keep the current control version.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!data.isSignificant && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="size-5 text-amber-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-amber-900">Need More Data</div>
                    <div className="text-sm text-amber-700 mt-1">
                      The results are not yet statistically significant. Continue running the test to gather more data
                      before making a decision.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
