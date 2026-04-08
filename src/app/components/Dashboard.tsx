import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { mockABTests } from "../data/mockData";
import { TrendingUp, TrendingDown, Minus, Play, Pause, CheckCircle2, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export function Dashboard() {
  const runningTests = mockABTests.filter(test => test.status === 'running');
  const completedTests = mockABTests.filter(test => test.status === 'completed');
  const pausedTests = mockABTests.filter(test => test.status === 'paused');

  const totalVisitors = mockABTests.reduce((sum, test) => sum + test.control.visitors + test.variant.visitors, 0);
  const significantWins = mockABTests.filter(test => test.isSignificant && test.improvement > 0).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="size-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">A/B Test Dashboard</h1>
              <p className="text-gray-600">Monitor and analyze your experiments</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Tests</CardDescription>
              <CardTitle className="text-3xl">{runningTests.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Play className="size-4 text-green-600" />
                Currently running
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Visitors</CardDescription>
              <CardTitle className="text-3xl">{totalVisitors.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                Across all tests
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Significant Wins</CardDescription>
              <CardTitle className="text-3xl">{significantWins}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="size-4 text-green-600" />
                Confidence &gt; 95%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed Tests</CardDescription>
              <CardTitle className="text-3xl">{completedTests.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                {pausedTests.length} paused
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tests List */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">All Tests ({mockABTests.length})</TabsTrigger>
            <TabsTrigger value="running">Running ({runningTests.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedTests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {mockABTests.map(test => (
              <TestCard key={test.id} test={test} />
            ))}
          </TabsContent>

          <TabsContent value="running" className="space-y-4">
            {runningTests.map(test => (
              <TestCard key={test.id} test={test} />
            ))}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedTests.map(test => (
              <TestCard key={test.id} test={test} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function TestCard({ test }: { test: typeof mockABTests[0] }) {
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
    if (test.improvement > 0) return <TrendingUp className="size-4 text-green-600" />;
    if (test.improvement < 0) return <TrendingDown className="size-4 text-red-600" />;
    return <Minus className="size-4 text-gray-400" />;
  };

  const getImprovementColor = () => {
    if (test.improvement > 0) return 'text-green-600';
    if (test.improvement < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <Link to={`/test/${test.id}`} className="block">
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle>{test.name}</CardTitle>
                {getStatusBadge()}
              </div>
              <CardDescription>{test.description}</CardDescription>
              <div className="text-sm text-gray-500">
                Metric: {test.metric} • Started {new Date(test.startDate).toLocaleDateString()}
              </div>
            </div>
            <div className="text-right">
              <div className={`flex items-center gap-1 text-2xl font-bold ${getImprovementColor()}`}>
                {getImprovementIcon()}
                {test.improvement > 0 ? '+' : ''}{test.improvement.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">
                {test.confidence.toFixed(1)}% confidence
              </div>
              {test.isSignificant && (
                <Badge className="mt-1 bg-green-100 text-green-800 hover:bg-green-100">Significant</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            {/* Control */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Control: {test.control.name}</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Visitors</span>
                  <span className="font-medium">{test.control.visitors.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Conversions</span>
                  <span className="font-medium">{test.control.conversions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Conversion Rate</span>
                  <span className="text-lg font-bold text-gray-900">{test.control.conversionRate.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Variant */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Variant: {test.variant.name}</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Visitors</span>
                  <span className="font-medium">{test.variant.visitors.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Conversions</span>
                  <span className="font-medium">{test.variant.conversions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Conversion Rate</span>
                  <span className="text-lg font-bold text-blue-600">{test.variant.conversionRate.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
