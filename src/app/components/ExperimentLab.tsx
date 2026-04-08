import { type ReactNode, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, BarChart3, CheckCircle2, Database, FileSpreadsheet, Layers3, ListFilter, ShieldAlert, TrendingUp, Upload } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ResponsiveContainer, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

type SampleDataSource = {
  id: string;
  label: string;
  filename: string;
};

type HistogramBin = {
  label: string;
  count: number;
};

type NumericColumnSummary = {
  name: string;
  type: "numeric";
  count: number;
  missingCount: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  histogram: HistogramBin[];
};

type CategoryValue = {
  value: string;
  count: number;
};

type CategoricalColumnSummary = {
  name: string;
  type: "categorical";
  count: number;
  missingCount: number;
  uniqueValues: number;
  topValues: CategoryValue[];
};

type ColumnSummary = NumericColumnSummary | CategoricalColumnSummary;

type DatasetProfile = {
  sourceType: "sample" | "upload";
  sourceLabel: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnSummary[];
  abAnalysis?: ABAnalysis;
  previewRows: Array<Record<string, string>>;
};

type ChartDatum = {
  name: string;
  value: number;
};

type CohortSizeProgress = {
  name: string;
  actual: number;
  required: number;
  remaining: number;
  progressPct: number;
  isEnough: boolean;
};

type SeriesChartDatum = {
  label: string;
  [key: string]: string | number;
};

type SeriesChart = {
  title: string;
  xKey: "label";
  data: SeriesChartDatum[];
};

type CohortSummary = {
  name: string;
  size: number;
  conversions: number;
  conversionRate: number;
};

type ABAnalysis =
  | {
      status: "ready";
      summary: string;
      groupColumn: string;
      metricColumn: string;
      cohorts: CohortSummary[];
      upliftPercent: number;
      pValue: number | null;
      confidence: number | null;
      isSignificant: boolean;
      confidenceIntervalPctPoints: {
        lower: number | null;
        upper: number | null;
      };
      requiredSampleSizePerCohort: number;
      isSampleSizeEnough: boolean;
      cohortSizeProgress: CohortSizeProgress[];
      sampleRatioMismatch: {
        pValue: number | null;
        isMismatch: boolean;
      };
      quality: {
        rawRows: number;
        analyzedRows: number;
        removedRows: number;
        duplicateUsersRemoved: number;
        incompatibleRowsRemoved: number;
      };
      interpretation: string;
      charts: {
        cohortSizes: ChartDatum[];
        conversionRates: ChartDatum[];
        trendChart?: SeriesChart;
        segmentChart?: SeriesChart;
      };
      recommendations: string[];
    }
  | {
      status: "not_ready";
      summary: string;
      recommendations: string[];
    };

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

export function ExperimentLab() {
  const [samples, setSamples] = useState<SampleDataSource[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState("");
  const [dataset, setDataset] = useState<DatasetProfile | null>(null);
  const [activeView, setActiveView] = useState<"overview" | "results">("overview");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isLoadingDataset, setIsLoadingDataset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadDataSources();
  }, []);

  const loadDataSources = async () => {
    setIsLoadingSources(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/data-sources`);
      const payload = await parseJsonResponse<{ samples: SampleDataSource[] }>(response);
      setSamples(payload.samples);

      if (payload.samples.length > 0) {
        const firstSampleId = payload.samples[0].id;
        setSelectedSampleId(firstSampleId);
        await loadSampleDataset(firstSampleId);
      } else {
        setDataset(null);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load sample datasets."));
    } finally {
      setIsLoadingSources(false);
    }
  };

  const loadSampleDataset = async (sampleId: string) => {
    setIsLoadingDataset(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/data-sources/${sampleId}`);
      const payload = await parseJsonResponse<DatasetProfile>(response);
      setDataset(payload);
      setActiveView("overview");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load the selected sample dataset."));
    } finally {
      setIsLoadingDataset(false);
    }
  };

  const handleSampleChange = async (sampleId: string) => {
    setSelectedSampleId(sampleId);
    await loadSampleDataset(sampleId);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsLoadingDataset(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/upload-csv`, {
        method: "POST",
        body: formData,
      });
      const payload = await parseJsonResponse<DatasetProfile>(response);
      setDataset(payload);
      setActiveView("overview");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to upload that CSV file."));
    } finally {
      setIsLoadingDataset(false);
    }
  };

  const numericColumns = dataset?.columns.filter(
    (column): column is NumericColumnSummary => column.type === "numeric",
  ) ?? [];
  const categoricalColumns = dataset?.columns.filter(
    (column): column is CategoricalColumnSummary => column.type === "categorical",
  ) ?? [];
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-100">
                <Database className="size-6 text-cyan-700" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">A/B Test Lab</h1>
                <p className="mt-1 text-slate-600">
                  Choose a sample dataset or upload your own CSV to profile the data before analysis.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-[260px]">
                <Select
                  disabled={isLoadingSources || samples.length === 0}
                  value={selectedSampleId}
                  onValueChange={(value) => {
                    void handleSampleChange(value);
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select sample data" />
                  </SelectTrigger>
                  <SelectContent>
                    {samples.map((sample) => (
                      <SelectItem key={sample.id} value={sample.id}>
                        {sample.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleUploadClick}>
                <Upload className="mr-2 size-4" />
                Upload CSV Data
              </Button>
              {dataset ? (
                <Button
                  variant={activeView === "results" ? "secondary" : "outline"}
                  onClick={() => setActiveView("results")}
                >
                  <BarChart3 className="mr-2 size-4" />
                  Go To Result
                </Button>
              ) : null}
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <Card className="mb-6 border-rose-200 bg-rose-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 text-rose-600" />
                <div>
                  <div className="font-medium text-rose-900">Something went wrong</div>
                  <div className="mt-1 text-sm text-rose-700">{error}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoadingSources || isLoadingDataset ? (
          <LoadingState />
        ) : !dataset ? (
          <EmptyState />
        ) : activeView === "results" ? (
          <ResultsView
            dataset={dataset}
            onBack={() => setActiveView("overview")}
          />
        ) : (
          <div className="space-y-6">
            <SourceSummary dataset={dataset} numericColumns={numericColumns.length} categoricalColumns={categoricalColumns.length} />

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <OverviewStat
                icon={<FileSpreadsheet className="size-5 text-cyan-700" />}
                label="Rows"
                value={dataset.rowCount.toLocaleString()}
              />
              <OverviewStat
                icon={<Layers3 className="size-5 text-cyan-700" />}
                label="Columns"
                value={dataset.columnCount.toLocaleString()}
              />
              <OverviewStat
                icon={<BarChart3 className="size-5 text-cyan-700" />}
                label="Numeric Columns"
                value={numericColumns.length.toLocaleString()}
              />
              <OverviewStat
                icon={<ListFilter className="size-5 text-cyan-700" />}
                label="Categorical Columns"
                value={categoricalColumns.length.toLocaleString()}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Numerical Columns</CardTitle>
                <CardDescription>
                  Mean, median, counts, missing values, and a compact histogram for each numeric field.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {numericColumns.length === 0 ? (
                  <EmptySection message="No numerical columns were detected in this dataset." />
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {numericColumns.map((column) => (
                      <NumericColumnCard key={column.name} column={column} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Categorical Columns</CardTitle>
                <CardDescription>
                  Unique values, populated row counts, and the most common values for each categorical field.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoricalColumns.length === 0 ? (
                  <EmptySection message="No categorical columns were detected in this dataset." />
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {categoricalColumns.map((column) => (
                      <CategoricalColumnCard key={column.name} column={column} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Preview</CardTitle>
                <CardDescription>First {dataset.previewRows.length} rows from the selected data source.</CardDescription>
              </CardHeader>
              <CardContent>
                <PreviewTable rows={dataset.previewRows} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultsView({
  dataset,
  onBack,
}: {
  dataset: DatasetProfile;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Experiment Results</h2>
          <p className="mt-1 text-slate-600">
            Statistical test results and decision charts for {dataset.sourceLabel}.
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 size-4" />
          Back To Overview
        </Button>
      </div>

      <ABAnalysisSection analysis={dataset.abAnalysis} />
    </div>
  );
}

function SourceSummary({
  dataset,
  numericColumns,
  categoricalColumns,
}: {
  dataset: DatasetProfile;
  numericColumns: number;
  categoricalColumns: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-2xl">{dataset.sourceLabel}</CardTitle>
            <CardDescription className="mt-1">
              Data overview for the currently selected source.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-cyan-100 text-cyan-900 hover:bg-cyan-100">
              {dataset.sourceType === "sample" ? "Sample data" : "Uploaded CSV"}
            </Badge>
            <Badge variant="outline">{numericColumns} numeric</Badge>
            <Badge variant="outline">{categoricalColumns} categorical</Badge>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function OverviewStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">{value}</div>
      </CardContent>
    </Card>
  );
}

function NumericColumnCard({ column }: { column: NumericColumnSummary }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-slate-900">{column.name}</div>
          <div className="mt-1 text-sm text-slate-500">Numeric column</div>
        </div>
        <Badge variant="outline">{column.count.toLocaleString()} values</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <StatChip label="Mean" value={formatNumber(column.mean)} />
        <StatChip label="Median" value={formatNumber(column.median)} />
        <StatChip label="Count" value={column.count.toLocaleString()} />
        <StatChip label="Missing" value={column.missingCount.toLocaleString()} />
        <StatChip label="Min" value={formatNumber(column.min)} />
        <StatChip label="Max" value={formatNumber(column.max)} />
      </div>

      <div className="mt-5">
        <div className="mb-2 text-sm font-medium text-slate-700">Distribution</div>
        <MiniHistogram bins={column.histogram} />
      </div>
    </div>
  );
}

function CategoricalColumnCard({ column }: { column: CategoricalColumnSummary }) {
  const maxCount = Math.max(...column.topValues.map((item) => item.count), 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-slate-900">{column.name}</div>
          <div className="mt-1 text-sm text-slate-500">Categorical column</div>
        </div>
        <Badge variant="outline">{column.uniqueValues.toLocaleString()} unique</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <StatChip label="Count" value={column.count.toLocaleString()} />
        <StatChip label="Missing" value={column.missingCount.toLocaleString()} />
        <StatChip label="Unique Values" value={column.uniqueValues.toLocaleString()} />
      </div>

      <div className="mt-5 space-y-3">
        <div className="text-sm font-medium text-slate-700">Top values</div>
        {column.topValues.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
            No populated values in this column.
          </div>
        ) : (
          column.topValues.map((item) => (
            <div key={`${column.name}-${item.value}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-slate-700">{item.value}</span>
                <span className="text-slate-500">{item.count.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-cyan-500"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function MiniHistogram({ bins }: { bins: HistogramBin[] }) {
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);

  if (bins.length === 0) {
    return <div className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">No numeric values to chart.</div>;
  }

  return (
    <div>
      <div className="flex h-24 items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {bins.map((bin) => (
          <div key={bin.label} className="flex h-full min-w-0 flex-1 items-end">
            <div
              className="w-full self-end rounded-t-md bg-cyan-500/85"
              style={{ height: `${Math.max((bin.count / maxCount) * 100, 4)}%` }}
              title={`${bin.label}: ${bin.count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-4 text-xs text-slate-500">
        <span>{bins[0]?.label}</span>
        <span>{bins[bins.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function ABAnalysisSection({ analysis }: { analysis?: ABAnalysis }) {
  if (!analysis) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Experiment Results</CardTitle>
        <CardDescription>{analysis.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {analysis.status === "ready" ? (
          <>
            <Card className="border-cyan-200 bg-cyan-50">
              <CardContent className="pt-6">
                <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-cyan-900">
                      <TrendingUp className="size-4" />
                      Relative Result Summary
                    </div>
                    <div className="text-3xl font-bold text-slate-900">
                      {analysis.upliftPercent >= 0 ? "+" : ""}
                      {analysis.upliftPercent.toFixed(2)}% relative lift
                    </div>
                    <div className="text-sm text-slate-700">{analysis.interpretation}</div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <StatChip
                        label="Absolute Lift"
                        value={`${analysis.absoluteLiftPctPoints >= 0 ? "+" : ""}${analysis.absoluteLiftPctPoints.toFixed(2)} pts`}
                      />
                      <StatChip
                        label="95% CI"
                        value={`${formatSignedMetric(analysis.confidenceIntervalPctPoints.lower, 2)} to ${formatSignedMetric(analysis.confidenceIntervalPctPoints.upper, 2)} pts`}
                      />
                      <StatChip
                        label="Required / Cohort"
                        value={analysis.requiredSampleSizePerCohort.toLocaleString()}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <ResultBadge
                      title="Significance"
                      tone={analysis.isSignificant ? "success" : "warning"}
                      text={analysis.isSignificant ? "Statistically significant" : "Not significant yet"}
                    />
                    <ResultBadge
                      title="Sample Ratio"
                      tone={analysis.sampleRatioMismatch.isMismatch ? "danger" : "neutral"}
                      text={analysis.sampleRatioMismatch.isMismatch ? "Mismatch detected" : "No SRM detected"}
                    />
                    <ResultBadge
                      title="Cohort Size"
                      tone={analysis.isSampleSizeEnough ? "success" : "warning"}
                      text={analysis.isSampleSizeEnough ? "Large enough" : "Need more traffic"}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <OverviewStat
                icon={<BarChart3 className="size-5 text-cyan-700" />}
                label="P-value"
                value={analysis.pValue === null ? "N/A" : analysis.pValue.toFixed(4)}
              />
              <OverviewStat
                icon={<CheckCircle2 className="size-5 text-cyan-700" />}
                label="Confidence"
                value={analysis.confidence === null ? "N/A" : `${analysis.confidence.toFixed(2)}%`}
              />
              <OverviewStat
                icon={<Layers3 className="size-5 text-cyan-700" />}
                label="Uplift"
                value={`${analysis.upliftPercent >= 0 ? "+" : ""}${analysis.upliftPercent.toFixed(2)}%`}
              />
              <OverviewStat
                icon={<ShieldAlert className="size-5 text-cyan-700" />}
                label="SRM Check"
                value={analysis.sampleRatioMismatch.isMismatch ? "Mismatch" : "Healthy"}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">Cohort Summary</CardTitle>
                  <CardDescription>
                    Cohort column: {analysis.groupColumn} | Metric column: {analysis.metricColumn}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.cohorts.map((cohort) => (
                      <div key={cohort.name} className="rounded-xl bg-slate-50 p-4">
                        <div className="font-semibold text-slate-900">{cohort.name}</div>
                        <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                          <StatChip label="Size" value={cohort.size.toLocaleString()} />
                          <StatChip label="Conversions" value={cohort.conversions.toLocaleString()} />
                          <StatChip label="Rate" value={`${cohort.conversionRate.toFixed(2)}%`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">Decision Notes</CardTitle>
                  <CardDescription>
                    Required sample size per cohort for a 10% relative MDE: {analysis.requiredSampleSizePerCohort.toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    {analysis.interpretation}
                  </div>
                  <div className={`rounded-xl border p-4 text-sm ${analysis.isSignificant ? "border-teal-200 bg-teal-50 text-teal-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                    {analysis.isSignificant
                      ? "The z-test is significant at the 95% threshold, so you can move into decision-making and rollout planning."
                      : "The z-test is not yet significant at the 95% threshold, so the result should be treated as inconclusive."}
                  </div>
                  <div className={`rounded-xl border p-4 text-sm ${analysis.isSampleSizeEnough ? "border-cyan-200 bg-cyan-50 text-cyan-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
                    {analysis.isSampleSizeEnough
                      ? "Each cohort has enough observations for a basic sample-size sufficiency check."
                      : "At least one cohort is still below the estimated sample-size target, so keep collecting traffic before locking a decision."}
                  </div>
                  <div className={`rounded-xl border p-4 text-sm ${analysis.sampleRatioMismatch.isMismatch ? "border-rose-200 bg-rose-50 text-rose-900" : "border-slate-200 bg-white text-slate-700"}`}>
                    Sample ratio mismatch p-value: {formatMetric(analysis.sampleRatioMismatch.pValue, 4)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <MetricBarChart title="Cohort Sizes" data={analysis.charts.cohortSizes} valueSuffix="" />
              <MetricBarChart title="Conversion Rates" data={analysis.charts.conversionRates} valueSuffix="%" />
            </div>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Is The Cohort Size Big Enough?</CardTitle>
                <CardDescription>
                  We compare each cohort's current size against the estimated target needed for a 10% relative MDE at the 95% confidence level.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <CohortSizeProgressChart data={analysis.cohortSizeProgress} />
                <div className="grid gap-4 md:grid-cols-2">
                  {analysis.cohortSizeProgress.map((cohort) => (
                    <div key={cohort.name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-900">{cohort.name}</div>
                        <Badge variant={cohort.isEnough ? "secondary" : "outline"} className={cohort.isEnough ? "bg-teal-100 text-teal-900 hover:bg-teal-100" : ""}>
                          {cohort.isEnough ? "Enough" : `${cohort.remaining.toLocaleString()} more needed`}
                        </Badge>
                      </div>
                      <div className="mt-3 h-3 rounded-full bg-slate-200">
                        <div
                          className={`h-3 rounded-full ${cohort.isEnough ? "bg-teal-500" : "bg-amber-500"}`}
                          style={{ width: `${cohort.progressPct}%` }}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                        <StatChip label="Actual" value={cohort.actual.toLocaleString()} />
                        <StatChip label="Target" value={cohort.required.toLocaleString()} />
                        <StatChip label="Progress" value={`${cohort.progressPct.toFixed(1)}%`} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              {analysis.charts.trendChart ? (
                <MultiSeriesLineChart chart={analysis.charts.trendChart} cohorts={analysis.cohorts.map((cohort) => cohort.name)} />
              ) : null}
              {analysis.charts.segmentChart ? (
                <MultiSeriesLineChart chart={analysis.charts.segmentChart} cohorts={analysis.cohorts.map((cohort) => cohort.name)} />
              ) : null}
            </div>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Analysis Hygiene</CardTitle>
                <CardDescription>
                  Rows retained for testing after cleanup and validation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatChip label="Raw Rows" value={analysis.quality.rawRows.toLocaleString()} />
                  <StatChip label="Analyzed Rows" value={analysis.quality.analyzedRows.toLocaleString()} />
                  <StatChip label="Duplicates Removed" value={analysis.quality.duplicateUsersRemoved.toLocaleString()} />
                  <StatChip label="Conflicts Removed" value={analysis.quality.incompatibleRowsRemoved.toLocaleString()} />
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}

      </CardContent>
    </Card>
  );
}

function ResultBadge({
  title,
  text,
  tone,
}: {
  title: string;
  text: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const toneClasses = {
    success: "border-teal-200 bg-teal-50 text-teal-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
    neutral: "border-slate-200 bg-white text-slate-700",
  };

  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-[0.12em]">{title}</div>
      <div className="mt-1 text-sm font-semibold">{text}</div>
    </div>
  );
}

function MetricBarChart({
  title,
  data,
  valueSuffix,
}: {
  title: string;
  data: ChartDatum[];
  valueSuffix: string;
}) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip
              formatter={(value: number) => `${value.toLocaleString()}${valueSuffix}`}
              contentStyle={{ backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "0.5rem" }}
            />
            <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function MultiSeriesLineChart({
  chart,
  cohorts,
}: {
  chart: SeriesChart;
  cohorts: string[];
}) {
  const colors = ["#06b6d4", "#0f766e", "#7c3aed", "#ea580c"];

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-lg">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={chart.xKey} stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip
              formatter={(value: number) => `${value.toFixed(2)}%`}
              contentStyle={{ backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "0.5rem" }}
            />
            <Legend />
            {cohorts.map((cohort, index) => (
              <Line
                key={cohort}
                type="monotone"
                dataKey={cohort}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function CohortSizeProgressChart({ data }: { data: CohortSizeProgress[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" stroke="#64748b" />
        <YAxis stroke="#64748b" />
        <Tooltip
          formatter={(value: number, name: string) => {
            const label = name === "actual" ? "Actual size" : "Required size";
            return [`${value.toLocaleString()}`, label];
          }}
          contentStyle={{ backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "0.5rem" }}
        />
        <Legend />
        <Bar dataKey="actual" fill="#06b6d4" radius={[8, 8, 0, 0]} />
        <Bar dataKey="required" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PreviewTable({ rows }: { rows: Array<Record<string, string>> }) {
  if (rows.length === 0) {
    return <EmptySection message="This dataset has headers but no data rows." />;
  }

  const headers = Object.keys(rows[0]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((header) => (
            <TableHead key={header}>{header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow key={`row-${rowIndex}`}>
            {headers.map((header) => (
              <TableCell key={`${rowIndex}-${header}`} className="max-w-[220px] truncate">
                {row[header] || <span className="text-slate-400">empty</span>}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LoadingState() {
  return (
    <Card>
      <CardContent className="py-16">
        <div className="text-center">
          <div className="mx-auto size-14 animate-pulse rounded-full bg-cyan-100" />
          <div className="mt-4 text-lg font-semibold text-slate-900">Loading dataset overview</div>
          <div className="mt-1 text-sm text-slate-600">Preparing your column summaries and preview.</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed border-slate-300">
      <CardContent className="py-16">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-cyan-100">
            <Upload className="size-8 text-cyan-600" />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-slate-900">No dataset selected</h3>
          <p className="mt-2 text-slate-600">
            Pick one of the sample CSV files from the dropdown or upload your own CSV file to generate a data overview.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptySection({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">{message}</div>;
}

function formatMetric(value: number | null, digits = 2) {
  if (value === null) {
    return "N/A";
  }
  return value.toFixed(digits);
}

function formatSignedMetric(value: number | null, digits = 2) {
  if (value === null) {
    return "N/A";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
        ? payload.detail
        : "Request failed.";
    throw new Error(detail);
  }
  return payload as T;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatNumber(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}
