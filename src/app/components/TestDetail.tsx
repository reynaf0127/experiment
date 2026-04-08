import { useParams, Link } from "react-router";
import { mockABTests } from "../data/mockData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Play, Pause, CheckCircle2, Users, Target, BarChart3 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export function TestDetail() {
  const { testId } = useParams();
  const test = mockABTests.find(t => t.id === testId);

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Test not found</h2>
          <Link to="/">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = () => {
    switch (test.status) {
      case 'running':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><Play className="size-3 mr-1" />Running</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><CheckCircle2 className="size-3 mr-1" />Completed</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Pause className="size-3 mr-1" />Paused</Badge>;
    }
  };

  const getImprovementIcon = () => {
    if (test.improvement > 0) return <TrendingUp className="size-5 text-green-600" />;
    if (test.improvement < 0) return <TrendingDown className="size-5 text-red-600" />;
    return <Minus className="size-5 text-gray-400" />;
  };

  const getImprovementColor = () => {
    if (test.improvement > 0) return 'text-green-600';
    if (test.improvement < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // Chart data
  const conversionRateData = test.dailyData.map(day => ({
    date: day.date,
    control: ((day.controlConversions / day.controlVisitors) * 100).toFixed(2),
    variant: ((day.variantConversions / day.variantVisitors) * 100).toFixed(2),
  }));

  const dailyConversionsData = test.dailyData.map(day => ({
    date: day.date,
    control: day.controlConversions,
    variant: day.variantConversions,
  }));

  const pieData = [
    { name: test.control.name, value: test.control.visitors, color: '#6b7280' },
    { name: test.variant.name, value: test.variant.visitors, color: '#3b82f6' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="size-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{test.name}</h1>
                {getStatusBadge()}
              </div>
              <p className="text-gray-600">{test.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Started: {new Date(test.startDate).toLocaleDateString()}</span>
                {test.endDate && <span>• Ended: {new Date(test.endDate).toLocaleDateString()}</span>}
                <span>• Metric: {test.metric}</span>
              </div>
            </div>
            <div className="text-right">
              <div className={`flex items-center gap-2 text-4xl font-bold ${getImprovementColor()}`}>
                {getImprovementIcon()}
                {test.improvement > 0 ? '+' : ''}{test.improvement.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {test.confidence.toFixed(1)}% confidence
              </div>
              {test.isSignificant && (
                <Badge className="mt-2 bg-green-100 text-green-800 hover:bg-green-100">
                  <CheckCircle2 className="size-3 mr-1" />
                  Statistically Significant
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription>Total Visitors</CardDescription>
                <Users className="size-5 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {(test.control.visitors + test.variant.visitors).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Split evenly across variants
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription>Total Conversions</CardDescription>
                <Target className="size-5 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {(test.control.conversions + test.variant.conversions).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Across both variants
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription>Improvement</CardDescription>
                <BarChart3 className="size-5 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getImprovementColor()}`}>
                {test.improvement > 0 ? '+' : ''}{test.improvement.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Variant vs. Control
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Rate Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Control: {test.control.name}</CardTitle>
              <CardDescription>Baseline performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Visitors</span>
                  <span className="text-2xl font-bold">{test.control.visitors.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Conversions</span>
                  <span className="text-2xl font-bold">{test.control.conversions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-gray-600">Conversion Rate</span>
                  <span className="text-3xl font-bold text-gray-900">{test.control.conversionRate.toFixed(2)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Variant: {test.variant.name}</CardTitle>
              <CardDescription>Testing alternative</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Visitors</span>
                  <span className="text-2xl font-bold">{test.variant.visitors.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Conversions</span>
                  <span className="text-2xl font-bold">{test.variant.conversions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-gray-600">Conversion Rate</span>
                  <span className="text-3xl font-bold text-blue-600">{test.variant.conversionRate.toFixed(2)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Conversion Rate Over Time</CardTitle>
            <CardDescription>Daily conversion rate comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={conversionRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'Conversion Rate (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  formatter={(value: number) => `${value}%`}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="control" 
                  stroke="#6b7280" 
                  name={test.control.name}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="variant" 
                  stroke="#3b82f6" 
                  name={test.variant.name}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Conversions */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Conversions</CardTitle>
            <CardDescription>Number of conversions per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyConversionsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'Conversions', angle: -90, position: 'insideLeft' }} />
                <Tooltip labelStyle={{ color: '#000' }} />
                <Legend />
                <Bar dataKey="control" fill="#6b7280" name={test.control.name} />
                <Bar dataKey="variant" fill="#3b82f6" name={test.variant.name} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
                <Tooltip />
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
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">Confidence Level</div>
                  <div className="text-sm text-gray-600">How confident we are in the results</div>
                </div>
                <div className="text-3xl font-bold text-blue-600">{test.confidence.toFixed(1)}%</div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">Statistical Significance</div>
                  <div className="text-sm text-gray-600">Whether results are reliable (≥95% confidence)</div>
                </div>
                <div>
                  {test.isSignificant ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-lg px-3 py-1">
                      <CheckCircle2 className="size-4 mr-1" />
                      Significant
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-lg px-3 py-1">
                      Not Significant
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">Sample Size</div>
                  <div className="text-sm text-gray-600">Total visitors across both variants</div>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {(test.control.visitors + test.variant.visitors).toLocaleString()}
                </div>
              </div>

              {test.isSignificant && test.improvement > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-green-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-green-900">Recommended Action</div>
                      <div className="text-sm text-green-700 mt-1">
                        The variant "{test.variant.name}" shows a statistically significant improvement of {test.improvement.toFixed(1)}%. 
                        Consider implementing this variant.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!test.isSignificant && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Pause className="size-5 text-yellow-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-yellow-900">Need More Data</div>
                      <div className="text-sm text-yellow-700 mt-1">
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
    </div>
  );
}
