from __future__ import annotations

import csv
import io
import math
import statistics
import tempfile
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any


MISSING_TOKENS = {"", "na", "n/a", "nan", "null", "none"}
NUMERIC_HISTOGRAM_BINS = 10
PREVIEW_ROW_COUNT = 8
TOP_CATEGORY_COUNT = 6
DEFAULT_RELATIVE_MDE = 0.1
DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
LARGE_UPLOAD_BYTES = 12 * 1024 * 1024
LARGE_UPLOAD_ROW_THRESHOLD = 400_000


def list_sample_datasets(artifact_dir: Path) -> list[dict[str, str]]:
    samples: list[dict[str, str]] = []
    for csv_file in sorted(artifact_dir.glob("*.csv")):
        samples.append(
            {
                "id": csv_file.stem,
                "label": csv_file.stem.replace("_", " ").title(),
                "filename": csv_file.name,
            }
        )
    return samples


def profile_csv_file(csv_path: Path, source_type: str, source_label: str) -> dict[str, Any]:
    fieldnames, preview_rows, column_meta = inspect_csv_file(csv_path)
    if not fieldnames:
        raise ValueError("CSV must include a header row.")

    file_size = csv_path.stat().st_size
    compact_overview = source_type == "upload" and (
        file_size >= LARGE_UPLOAD_BYTES or column_meta["rowCount"] >= LARGE_UPLOAD_ROW_THRESHOLD
    )
    columns = summarize_csv_columns(
        csv_path,
        fieldnames,
        column_meta,
        compact_overview=compact_overview,
    )
    profile_notice = None
    if compact_overview:
        profile_notice = (
            "Large upload mode is active. To keep analysis responsive, the overview omits some expensive "
            "column details such as full medians and histograms."
        )

    return {
        "sourceType": source_type,
        "sourceLabel": source_label,
        "rowCount": column_meta["rowCount"],
        "columnCount": len(fieldnames),
        "columns": columns,
        "abAnalysis": infer_ab_analysis_from_file(csv_path, columns, column_meta["rowCount"]),
        "previewRows": preview_rows,
        "profileNotice": profile_notice,
    }


def profile_csv_text(csv_text: str, source_type: str, source_label: str) -> dict[str, Any]:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="w", encoding="utf-8-sig") as temp_file:
        temp_file.write(csv_text)
        temp_path = Path(temp_file.name)
    try:
        return profile_csv_file(temp_path, source_type=source_type, source_label=source_label)
    finally:
        temp_path.unlink(missing_ok=True)


def normalize_row(row: dict[str, Any], fieldnames: list[str]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for fieldname in fieldnames:
        value = row.get(fieldname, "")
        normalized[fieldname] = "" if value is None else str(value).strip()
    return normalized


def summarize_column(column_name: str, rows: list[dict[str, str]]) -> dict[str, Any]:
    values = [row.get(column_name, "") for row in rows]
    non_missing_values = [value for value in values if not is_missing(value)]
    missing_count = len(values) - len(non_missing_values)

    if is_numeric_column(non_missing_values):
        numeric_values = [float(value) for value in non_missing_values]
        return {
            "name": column_name,
            "type": "numeric",
            "count": len(numeric_values),
            "missingCount": missing_count,
            "mean": round(statistics.fmean(numeric_values), 4) if numeric_values else None,
            "median": round(statistics.median(numeric_values), 4) if numeric_values else None,
            "min": round(min(numeric_values), 4) if numeric_values else None,
            "max": round(max(numeric_values), 4) if numeric_values else None,
            "histogram": build_histogram(numeric_values),
        }

    category_counter = Counter(non_missing_values)
    return {
        "name": column_name,
        "type": "categorical",
        "count": len(non_missing_values),
        "missingCount": missing_count,
        "uniqueValues": len(category_counter),
        "topValues": [
            {"value": value, "count": count}
            for value, count in category_counter.most_common(TOP_CATEGORY_COUNT)
        ],
    }


def inspect_csv_file(csv_path: Path) -> tuple[list[str], list[dict[str, str]], dict[str, Any]]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as file_obj:
        reader = csv.DictReader(file_obj)
        fieldnames = reader.fieldnames or []
        if not fieldnames:
            return [], [], {"rowCount": 0, "columns": {}}

        preview_rows: list[dict[str, str]] = []
        column_meta = {
            fieldname: {"count": 0, "missingCount": 0, "numericPossible": True}
            for fieldname in fieldnames
        }
        row_count = 0

        for raw_row in reader:
            row = normalize_row(raw_row, fieldnames)
            row_count += 1
            if len(preview_rows) < PREVIEW_ROW_COUNT:
                preview_rows.append(row)

            for fieldname in fieldnames:
                value = row[fieldname]
                meta = column_meta[fieldname]
                if is_missing(value):
                    meta["missingCount"] += 1
                    continue
                meta["count"] += 1
                if meta["numericPossible"]:
                    lowered = value.lower()
                    if lowered in {"true", "false"}:
                        meta["numericPossible"] = False
                    else:
                        try:
                            float(value)
                        except ValueError:
                            meta["numericPossible"] = False

        return fieldnames, preview_rows, {"rowCount": row_count, "columns": column_meta}


def summarize_csv_columns(
    csv_path: Path,
    fieldnames: list[str],
    column_meta_container: dict[str, Any],
    compact_overview: bool = False,
) -> list[dict[str, Any]]:
    column_meta = column_meta_container["columns"]
    numeric_columns = [name for name in fieldnames if column_meta[name]["numericPossible"] and column_meta[name]["count"] > 0]
    categorical_columns = [name for name in fieldnames if name not in numeric_columns]

    numeric_values: dict[str, list[float]] = {name: [] for name in numeric_columns} if not compact_overview else {}
    numeric_stats: dict[str, dict[str, float | None]] = (
        {
            name: {
                "sum": 0.0,
                "min": None,
                "max": None,
            }
            for name in numeric_columns
        }
        if compact_overview
        else {}
    )
    categorical_counters: dict[str, Counter[str]] = {name: Counter() for name in categorical_columns}

    with csv_path.open("r", encoding="utf-8-sig", newline="") as file_obj:
        reader = csv.DictReader(file_obj)
        for raw_row in reader:
            row = normalize_row(raw_row, fieldnames)
            for fieldname in numeric_columns:
                value = row[fieldname]
                if is_missing(value):
                    continue
                numeric_value = float(value)
                if compact_overview:
                    stats = numeric_stats[fieldname]
                    stats["sum"] += numeric_value
                    stats["min"] = numeric_value if stats["min"] is None else min(stats["min"], numeric_value)
                    stats["max"] = numeric_value if stats["max"] is None else max(stats["max"], numeric_value)
                else:
                    numeric_values[fieldname].append(numeric_value)
            for fieldname in categorical_columns:
                value = row[fieldname]
                if is_missing(value):
                    continue
                categorical_counters[fieldname][value] += 1

    columns: list[dict[str, Any]] = []
    for fieldname in fieldnames:
        meta = column_meta[fieldname]
        if fieldname in numeric_columns:
            if compact_overview:
                stats = numeric_stats[fieldname]
                mean = round(stats["sum"] / meta["count"], 4) if meta["count"] else None
                min_value = round(stats["min"], 4) if stats["min"] is not None else None
                max_value = round(stats["max"], 4) if stats["max"] is not None else None
                median = None
                histogram: list[dict[str, Any]] = []
            else:
                values = numeric_values[fieldname]
                mean = round(statistics.fmean(values), 4) if values else None
                median = round(statistics.median(values), 4) if values else None
                min_value = round(min(values), 4) if values else None
                max_value = round(max(values), 4) if values else None
                histogram = build_histogram(values)
            columns.append(
                {
                    "name": fieldname,
                    "type": "numeric",
                    "count": meta["count"],
                    "missingCount": meta["missingCount"],
                    "mean": mean,
                    "median": median,
                    "min": min_value,
                    "max": max_value,
                    "histogram": histogram,
                }
            )
        else:
            counter = categorical_counters[fieldname]
            columns.append(
                {
                    "name": fieldname,
                    "type": "categorical",
                    "count": meta["count"],
                    "missingCount": meta["missingCount"],
                    "uniqueValues": len(counter),
                    "topValues": [
                        {"value": value, "count": count}
                        for value, count in counter.most_common(TOP_CATEGORY_COUNT)
                    ],
                }
            )
    return columns


def is_missing(value: str) -> bool:
    return value.strip().lower() in MISSING_TOKENS


def is_numeric_column(values: list[str]) -> bool:
    if not values:
        return False

    for value in values:
        lowered = value.lower()
        if lowered in {"true", "false"}:
            return False
        try:
            float(value)
        except ValueError:
            return False
    return True


def build_histogram(values: list[float]) -> list[dict[str, Any]]:
    if not values:
        return []

    min_value = min(values)
    max_value = max(values)

    if math.isclose(min_value, max_value):
        return [
            {
                "label": format_range_label(min_value, max_value),
                "count": len(values),
            }
        ]

    bin_count = min(NUMERIC_HISTOGRAM_BINS, max(1, len(set(values))))
    bin_width = (max_value - min_value) / bin_count
    bins = [0] * bin_count

    for value in values:
        if math.isclose(value, max_value):
            index = bin_count - 1
        else:
            index = int((value - min_value) / bin_width)
        bins[index] += 1

    histogram: list[dict[str, Any]] = []
    for index, count in enumerate(bins):
        start = min_value + index * bin_width
        end = max_value if index == bin_count - 1 else start + bin_width
        histogram.append(
            {
                "label": format_range_label(start, end),
                "count": count,
            }
        )
    return histogram


def format_range_label(start: float, end: float) -> str:
    return f"{format_number(start)}-{format_number(end)}"


def format_number(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def infer_ab_analysis_from_file(csv_path: Path, columns: list[dict[str, Any]], row_count: int) -> dict[str, Any]:
    if row_count == 0:
        return {
            "status": "not_ready",
            "summary": "No data rows are available yet.",
            "recommendations": [
                "Upload or select a dataset with experiment rows before running A/B analysis.",
            ],
        }

    group_column = detect_group_column_from_summaries(columns)
    conversion_column = detect_conversion_column_from_summaries(columns)

    if group_column is None or conversion_column is None:
        recommendations = []
        if group_column is None:
            recommendations.append("Add or map a cohort column with two variants, such as control and treatment.")
        if conversion_column is None:
            recommendations.append("Add or map a binary outcome column with values like 0/1 or true/false.")
        recommendations.append("Once both columns are present, compute conversion rates, p-value, confidence, and sample-size sufficiency.")
        return {
            "status": "not_ready",
            "summary": "This dataset is not yet structured like a two-cohort A/B test table.",
            "recommendations": recommendations,
        }

    user_id_column = detect_user_id_column(columns)
    compatibility_column = detect_compatibility_column(columns, group_column)
    timestamp_column = detect_timestamp_column(columns)
    day_column = next((column["name"] for column in columns if column["name"].lower() == "most ads day"), None)
    hour_column = next((column["name"] for column in columns if "hour" in column["name"].lower()), None)
    compatibility_map = infer_group_compatibility_map_from_columns(columns, group_column, compatibility_column)

    selected_fields = {
        field
        for field in [group_column, conversion_column, user_id_column, compatibility_column, timestamp_column, day_column, hour_column]
        if field is not None
    }

    quality = {
        "rawRows": row_count,
        "analyzedRows": 0,
        "removedRows": 0,
        "duplicateUsersRemoved": 0,
        "incompatibleRowsRemoved": 0,
    }

    seen_users: set[str] = set()
    group_counts: Counter[str] = Counter()
    conversions_by_group: Counter[str] = Counter()
    trend_totals: dict[str, Counter[str]] = {}
    trend_conversions: dict[str, Counter[str]] = {}
    segment_totals: dict[str, Counter[str]] = {}
    segment_conversions: dict[str, Counter[str]] = {}

    with csv_path.open("r", encoding="utf-8-sig", newline="") as file_obj:
        reader = csv.DictReader(file_obj)
        fieldnames = reader.fieldnames or []
        for raw_row in reader:
            normalized = normalize_row(raw_row, fieldnames)
            row = {field: normalized.get(field, "") for field in selected_fields}

            if compatibility_column is not None and compatibility_map:
                group_value = row.get(group_column, "")
                compatibility_value = row.get(compatibility_column, "")
                if (
                    not is_missing(group_value)
                    and not is_missing(compatibility_value)
                    and compatibility_map.get(group_value) != compatibility_value
                ):
                    quality["incompatibleRowsRemoved"] += 1
                    continue

            if user_id_column is not None:
                user_id = row.get(user_id_column, "")
                if not is_missing(user_id):
                    if user_id in seen_users:
                        quality["duplicateUsersRemoved"] += 1
                        continue
                    seen_users.add(user_id)

            group_value = row.get(group_column, "")
            metric_value = row.get(conversion_column, "")
            if is_missing(group_value) or is_missing(metric_value):
                continue

            outcome = parse_binary_value(metric_value)
            group_counts[group_value] += 1
            conversions_by_group[group_value] += outcome
            quality["analyzedRows"] += 1

            trend_bucket = get_trend_bucket(row, timestamp_column, day_column)
            if trend_bucket is not None:
                trend_totals.setdefault(trend_bucket, Counter())[group_value] += 1
                trend_conversions.setdefault(trend_bucket, Counter())[group_value] += outcome

            segment_bucket = get_segment_bucket(row, hour_column)
            if segment_bucket is not None:
                segment_totals.setdefault(segment_bucket, Counter())[group_value] += 1
                segment_conversions.setdefault(segment_bucket, Counter())[group_value] += outcome

    quality["removedRows"] = quality["rawRows"] - quality["analyzedRows"]

    if len(group_counts) != 2:
        return {
            "status": "not_ready",
            "summary": "A/B analysis currently expects exactly two populated cohorts.",
            "recommendations": [
                f"Column '{group_column}' currently has {len(group_counts)} populated cohorts.",
                "Filter or remap the data so only control and one variant remain before significance testing.",
            ],
        }

    ordered_groups = choose_group_order(group_counts)
    group_metrics: list[dict[str, Any]] = []
    for group_name in ordered_groups:
        total = group_counts[group_name]
        successes = conversions_by_group[group_name]
        rate = successes / total if total else 0.0
        group_metrics.append(
            {
                "name": group_name,
                "size": total,
                "conversions": successes,
                "conversionRate": round(rate * 100, 4),
            }
        )

    control = group_metrics[0]
    variant = group_metrics[1]
    significance = calculate_significance(
        control["conversions"],
        control["size"],
        variant["conversions"],
        variant["size"],
    )
    confidence_interval = calculate_difference_confidence_interval(
        control["conversions"],
        control["size"],
        variant["conversions"],
        variant["size"],
    )
    sample_size = estimate_required_sample_size(
        baseline_rate=control["conversionRate"] / 100,
        relative_mde=DEFAULT_RELATIVE_MDE,
    )
    is_sample_size_enough = control["size"] >= sample_size and variant["size"] >= sample_size
    cohort_size_progress = build_cohort_size_progress(group_metrics, sample_size)
    uplift = calculate_uplift(control["conversionRate"], variant["conversionRate"])
    absolute_lift = variant["conversionRate"] - control["conversionRate"]
    sample_ratio_mismatch = calculate_sample_ratio_mismatch([control["size"], variant["size"]])

    charts: dict[str, Any] = {
        "cohortSizes": [{"name": cohort["name"], "value": cohort["size"]} for cohort in group_metrics],
        "conversionRates": [{"name": cohort["name"], "value": cohort["conversionRate"]} for cohort in group_metrics],
    }
    trend_chart = build_series_chart_from_aggregates(
        title="Conversion Rate Over Time" if timestamp_column is not None else "Conversion Rate By Day",
        totals=trend_totals,
        conversions=trend_conversions,
        order=None if timestamp_column is not None else DAY_ORDER,
    )
    if trend_chart is not None:
        charts["trendChart"] = trend_chart
    segment_chart = build_series_chart_from_aggregates(
        title="Conversion Rate By Hour",
        totals=segment_totals,
        conversions=segment_conversions,
        order=[str(hour) for hour in range(24)] if hour_column is not None else None,
    )
    if segment_chart is not None:
        charts["segmentChart"] = segment_chart

    interpretation = build_interpretation(
        control_name=control["name"],
        variant_name=variant["name"],
        is_significant=significance["isSignificant"],
        relative_lift=uplift,
        p_value=significance["pValue"],
        is_sample_size_enough=is_sample_size_enough,
        has_srm=sample_ratio_mismatch["isMismatch"],
    )

    recommendations = [
        f"Use '{group_column}' as the cohort column and '{conversion_column}' as the binary outcome.",
        "Show conversion-rate lift, p-value, confidence interval, and sample ratio checks together in the results header.",
        "Use the trend and segment charts to see whether the result is stable over time or concentrated in one slice.",
    ]
    if quality["incompatibleRowsRemoved"] > 0:
        recommendations.append(
            f"Excluded {quality['incompatibleRowsRemoved']:,} rows where cohort and experience assignment conflicted."
        )
    if quality["duplicateUsersRemoved"] > 0:
        recommendations.append(
            f"Deduplicated {quality['duplicateUsersRemoved']:,} repeated user records before testing."
        )
    if not is_sample_size_enough:
        recommendations.append(
            f"Keep collecting data until each cohort reaches about {sample_size:,} observations for a 10% relative MDE check."
        )
    if sample_ratio_mismatch["isMismatch"]:
        recommendations.append("Investigate sample ratio mismatch before trusting the treatment effect at face value.")
    if significance["isSignificant"]:
        recommendations.append("This result is statistically significant at the 95% level, so the variant is ready for decisioning.")
    else:
        recommendations.append("The current p-value is above 0.05, so treat the result as inconclusive for now.")

    return {
        "status": "ready",
        "summary": "This dataset is ready for a basic binary-outcome A/B test analysis.",
        "groupColumn": group_column,
        "metricColumn": conversion_column,
        "quality": quality,
        "cohorts": group_metrics,
        "absoluteLiftPctPoints": round(absolute_lift, 4),
        "upliftPercent": round(uplift, 4),
        "pValue": significance["pValue"],
        "confidence": significance["confidence"],
        "isSignificant": significance["isSignificant"],
        "confidenceIntervalPctPoints": confidence_interval,
        "requiredSampleSizePerCohort": sample_size,
        "isSampleSizeEnough": is_sample_size_enough,
        "cohortSizeProgress": cohort_size_progress,
        "sampleRatioMismatch": sample_ratio_mismatch,
        "interpretation": interpretation,
        "charts": charts,
        "recommendations": recommendations,
    }


def detect_group_column_from_summaries(columns: list[dict[str, Any]]) -> str | None:
    categorical_candidates = [column for column in columns if column["type"] == "categorical"]
    group_column = next(
        (
            column["name"]
            for column in categorical_candidates
            if 2 <= column.get("uniqueValues", 0) <= 4 and "group" in column["name"].lower()
        ),
        None,
    )
    if group_column is not None:
        return group_column
    return next(
        (column["name"] for column in categorical_candidates if 2 <= column.get("uniqueValues", 0) <= 4),
        None,
    )


def detect_conversion_column_from_summaries(columns: list[dict[str, Any]]) -> str | None:
    binary_candidates = [column for column in columns if is_binary_summary_column(column)]
    conversion_column = next(
        (
            column["name"]
            for column in binary_candidates
            if any(token in column["name"].lower() for token in ("convert", "conversion", "clicked", "purchase", "signup"))
        ),
        None,
    )
    if conversion_column is not None:
        return conversion_column
    return next((column["name"] for column in binary_candidates), None)


def is_binary_summary_column(column: dict[str, Any]) -> bool:
    if column["type"] == "numeric":
        return column.get("min") in {0, 0.0} and column.get("max") in {1, 1.0}
    if column["type"] == "categorical" and column.get("uniqueValues") == 2:
        values = {item["value"].strip().lower() for item in column.get("topValues", [])}
        return values.issubset({"0", "1", "true", "false"}) and bool(values)
    return False


def infer_ab_analysis(rows: list[dict[str, str]], columns: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        return {
            "status": "not_ready",
            "summary": "No data rows are available yet.",
            "recommendations": [
                "Upload or select a dataset with experiment rows before running A/B analysis.",
            ],
        }

    categorical_candidates = [column for column in columns if column["type"] == "categorical"]
    numeric_candidates = [column for column in columns if column["type"] == "numeric"]

    group_column = next(
        (
            column
            for column in categorical_candidates
            if 2 <= column["uniqueValues"] <= 4 and "group" in column["name"].lower()
        ),
        None,
    )
    if group_column is None:
        group_column = next(
            (column for column in categorical_candidates if 2 <= column["uniqueValues"] <= 4),
            None,
        )

    binary_metric_candidates = [
        column
        for column in (numeric_candidates + categorical_candidates)
        if is_binary_metric_column(rows, column["name"])
    ]

    conversion_column = next(
        (
            column
            for column in binary_metric_candidates
            if any(token in column["name"].lower() for token in ("convert", "conversion", "clicked", "purchase", "signup"))
        ),
        None,
    )
    if conversion_column is None:
        conversion_column = next(
            (column for column in binary_metric_candidates),
            None,
        )

    if group_column is None or conversion_column is None:
        recommendations = []
        if group_column is None:
            recommendations.append("Add or map a cohort column with two variants, such as control and treatment.")
        if conversion_column is None:
            recommendations.append("Add or map a binary outcome column with values like 0/1 or true/false.")
        recommendations.append("Once both columns are present, compute conversion rates, p-value, confidence, and sample-size sufficiency.")
        return {
            "status": "not_ready",
            "summary": "This dataset is not yet structured like a two-cohort A/B test table.",
            "recommendations": recommendations,
        }

    user_id_column = detect_user_id_column(columns)
    quality = {
        "rawRows": len(rows),
        "analyzedRows": 0,
        "removedRows": 0,
        "duplicateUsersRemoved": 0,
        "incompatibleRowsRemoved": 0,
    }

    prepared_rows = rows
    compatibility_column = detect_compatibility_column(columns, group_column["name"])
    if compatibility_column is not None:
        compatible_rows, removed_count = filter_compatible_rows(prepared_rows, group_column["name"], compatibility_column)
        prepared_rows = compatible_rows
        quality["incompatibleRowsRemoved"] = removed_count

    if user_id_column is not None:
        deduped_rows, removed_duplicates = deduplicate_rows(prepared_rows, user_id_column)
        prepared_rows = deduped_rows
        quality["duplicateUsersRemoved"] = removed_duplicates

    cleaned_rows = [
        row
        for row in prepared_rows
        if not is_missing(row.get(group_column["name"], "")) and not is_missing(row.get(conversion_column["name"], ""))
    ]
    quality["analyzedRows"] = len(cleaned_rows)
    quality["removedRows"] = quality["rawRows"] - quality["analyzedRows"]

    group_counts = Counter(row[group_column["name"]] for row in cleaned_rows)
    if len(group_counts) != 2:
        return {
            "status": "not_ready",
            "summary": "A/B analysis currently expects exactly two populated cohorts.",
            "recommendations": [
                f"Column '{group_column['name']}' currently has {len(group_counts)} populated cohorts.",
                "Filter or remap the data so only control and one variant remain before significance testing.",
            ],
        }

    ordered_groups = choose_group_order(group_counts)
    group_metrics: list[dict[str, Any]] = []
    for group_name in ordered_groups:
        group_rows = [row for row in cleaned_rows if row[group_column["name"]] == group_name]
        successes = sum(parse_binary_value(row[conversion_column["name"]]) for row in group_rows)
        total = len(group_rows)
        rate = successes / total if total else 0.0
        group_metrics.append(
            {
                "name": group_name,
                "size": total,
                "conversions": successes,
                "conversionRate": round(rate * 100, 4),
            }
        )

    control = group_metrics[0]
    variant = group_metrics[1]
    significance = calculate_significance(
        control["conversions"],
        control["size"],
        variant["conversions"],
        variant["size"],
    )
    confidence_interval = calculate_difference_confidence_interval(
        control["conversions"],
        control["size"],
        variant["conversions"],
        variant["size"],
    )
    sample_size = estimate_required_sample_size(
        baseline_rate=control["conversionRate"] / 100,
        relative_mde=DEFAULT_RELATIVE_MDE,
    )
    is_sample_size_enough = control["size"] >= sample_size and variant["size"] >= sample_size
    cohort_size_progress = build_cohort_size_progress(group_metrics, sample_size)
    uplift = calculate_uplift(control["conversionRate"], variant["conversionRate"])
    absolute_lift = variant["conversionRate"] - control["conversionRate"]
    sample_ratio_mismatch = calculate_sample_ratio_mismatch([control["size"], variant["size"]])

    charts = build_ab_charts(cleaned_rows, columns, group_column["name"], conversion_column["name"])
    interpretation = build_interpretation(
        control_name=control["name"],
        variant_name=variant["name"],
        is_significant=significance["isSignificant"],
        relative_lift=uplift,
        p_value=significance["pValue"],
        is_sample_size_enough=is_sample_size_enough,
        has_srm=sample_ratio_mismatch["isMismatch"],
    )

    recommendations = [
        f"Use '{group_column['name']}' as the cohort column and '{conversion_column['name']}' as the binary outcome.",
        "Show conversion-rate lift, p-value, confidence interval, and sample ratio checks together in the results header.",
        "Use the trend and segment charts to see whether the result is stable over time or concentrated in one slice.",
    ]
    if quality["incompatibleRowsRemoved"] > 0:
        recommendations.append(
            f"Excluded {quality['incompatibleRowsRemoved']:,} rows where cohort and experience assignment conflicted."
        )
    if quality["duplicateUsersRemoved"] > 0:
        recommendations.append(
            f"Deduplicated {quality['duplicateUsersRemoved']:,} repeated user records before testing."
        )
    if not is_sample_size_enough:
        recommendations.append(
            f"Keep collecting data until each cohort reaches about {sample_size:,} observations for a 10% relative MDE check."
        )
    if sample_ratio_mismatch["isMismatch"]:
        recommendations.append("Investigate sample ratio mismatch before trusting the treatment effect at face value.")
    if significance["isSignificant"]:
        recommendations.append("This result is statistically significant at the 95% level, so the variant is ready for decisioning.")
    else:
        recommendations.append("The current p-value is above 0.05, so treat the result as inconclusive for now.")

    return {
        "status": "ready",
        "summary": "This dataset is ready for a basic binary-outcome A/B test analysis.",
        "groupColumn": group_column["name"],
        "metricColumn": conversion_column["name"],
        "quality": quality,
        "cohorts": group_metrics,
        "absoluteLiftPctPoints": round(absolute_lift, 4),
        "upliftPercent": round(uplift, 4),
        "pValue": significance["pValue"],
        "confidence": significance["confidence"],
        "isSignificant": significance["isSignificant"],
        "confidenceIntervalPctPoints": confidence_interval,
        "requiredSampleSizePerCohort": sample_size,
        "isSampleSizeEnough": is_sample_size_enough,
        "cohortSizeProgress": cohort_size_progress,
        "sampleRatioMismatch": sample_ratio_mismatch,
        "interpretation": interpretation,
        "charts": charts,
        "recommendations": recommendations,
    }


def infer_group_compatibility_map_from_columns(
    columns: list[dict[str, Any]],
    group_column: str,
    compatibility_column: str | None,
) -> dict[str, str]:
    if compatibility_column is None:
        return {}

    group_summary = next((column for column in columns if column["name"] == group_column), None)
    compatibility_summary = next((column for column in columns if column["name"] == compatibility_column), None)
    if group_summary is None or compatibility_summary is None:
        return {}
    if group_summary["type"] != "categorical" or compatibility_summary["type"] != "categorical":
        return {}

    group_values = [item["value"] for item in group_summary.get("topValues", [])]
    compatibility_values = [item["value"] for item in compatibility_summary.get("topValues", [])]
    if len(group_values) < 2 or len(compatibility_values) < 2:
        return {}

    lower_group_values = {value.lower(): value for value in group_values}
    lower_compatibility_values = {value.lower(): value for value in compatibility_values}
    if {"control", "treatment"}.issubset(lower_group_values.keys()) and {"old_page", "new_page"}.issubset(lower_compatibility_values.keys()):
        return {
            lower_group_values["control"]: lower_compatibility_values["old_page"],
            lower_group_values["treatment"]: lower_compatibility_values["new_page"],
        }
    return {}


def get_trend_bucket(row: dict[str, str], timestamp_column: str | None, day_column: str | None) -> str | None:
    if timestamp_column is not None:
        timestamp_value = row.get(timestamp_column, "")
        if not is_missing(timestamp_value):
            return parse_date_bucket(timestamp_value)
    if day_column is not None:
        day_value = row.get(day_column, "")
        if not is_missing(day_value):
            return day_value
    return None


def get_segment_bucket(row: dict[str, str], hour_column: str | None) -> str | None:
    if hour_column is None:
        return None
    hour_value = row.get(hour_column, "")
    if is_missing(hour_value):
        return None
    return hour_value


def build_series_chart_from_aggregates(
    title: str,
    totals: dict[str, Counter[str]],
    conversions: dict[str, Counter[str]],
    order: list[str] | None,
) -> dict[str, Any] | None:
    if not totals:
        return None

    labels = order if order is not None else sorted(totals.keys())
    data: list[dict[str, Any]] = []
    for label in labels:
        if label not in totals:
            continue
        row: dict[str, Any] = {"label": label}
        for group_name, total in totals[label].items():
            converted = conversions.get(label, Counter()).get(group_name, 0)
            row[group_name] = round((converted / total) * 100, 4) if total else 0.0
        data.append(row)

    if not data:
        return None
    return {"title": title, "xKey": "label", "data": data}


def is_binary_metric_column(rows: list[dict[str, str]], column_name: str) -> bool:
    populated_values = {
        row[column_name].strip().lower()
        for row in rows
        if not is_missing(row.get(column_name, ""))
    }
    return populated_values.issubset({"0", "1", "true", "false"}) and bool(populated_values)


def parse_binary_value(value: str) -> int:
    lowered = value.strip().lower()
    return 1 if lowered in {"1", "true"} else 0


def calculate_significance(conversions_a: int, total_a: int, conversions_b: int, total_b: int) -> dict[str, Any]:
    if total_a == 0 or total_b == 0:
        return {"pValue": None, "confidence": None, "isSignificant": False}

    p_a = conversions_a / total_a
    p_b = conversions_b / total_b
    pooled_p = (conversions_a + conversions_b) / (total_a + total_b)
    standard_error = math.sqrt(pooled_p * (1 - pooled_p) * ((1 / total_a) + (1 / total_b)))

    if math.isclose(standard_error, 0.0):
        return {"pValue": 1.0, "confidence": 0.0, "isSignificant": False}

    z_score = abs((p_b - p_a) / standard_error)
    p_value = 2 * (1 - normal_cdf(z_score))
    confidence = (1 - p_value) * 100
    return {
        "pValue": round(p_value, 6),
        "confidence": round(confidence, 4),
        "isSignificant": p_value < 0.05,
    }


def calculate_difference_confidence_interval(
    conversions_a: int,
    total_a: int,
    conversions_b: int,
    total_b: int,
) -> dict[str, float | None]:
    if total_a == 0 or total_b == 0:
        return {"lower": None, "upper": None}

    p_a = conversions_a / total_a
    p_b = conversions_b / total_b
    difference = p_b - p_a
    standard_error = math.sqrt((p_a * (1 - p_a) / total_a) + (p_b * (1 - p_b) / total_b))
    margin = 1.96 * standard_error
    return {
        "lower": round((difference - margin) * 100, 4),
        "upper": round((difference + margin) * 100, 4),
    }


def normal_cdf(z_score: float) -> float:
    return 0.5 * (1 + math.erf(z_score / math.sqrt(2)))


def estimate_required_sample_size(baseline_rate: float, relative_mde: float) -> int:
    baseline_rate = min(max(baseline_rate, 0.001), 0.999)
    absolute_mde = max(baseline_rate * relative_mde, 0.001)
    z_alpha = 1.96
    z_beta = 0.84
    pooled_variance = 2 * baseline_rate * (1 - baseline_rate)
    required = ((z_alpha + z_beta) ** 2 * pooled_variance) / (absolute_mde ** 2)
    return math.ceil(required)


def calculate_uplift(control_rate_percent: float, variant_rate_percent: float) -> float:
    if math.isclose(control_rate_percent, 0.0):
        return 0.0
    return ((variant_rate_percent - control_rate_percent) / control_rate_percent) * 100


def calculate_sample_ratio_mismatch(group_sizes: list[int]) -> dict[str, Any]:
    total = sum(group_sizes)
    if total == 0 or len(group_sizes) != 2:
        return {"pValue": None, "isMismatch": False}

    expected = total / 2
    chi_square = sum(((observed - expected) ** 2) / expected for observed in group_sizes)
    p_value = math.erfc(math.sqrt(chi_square / 2))
    return {
        "pValue": round(p_value, 6),
        "isMismatch": p_value < 0.01,
    }


def build_cohort_size_progress(group_metrics: list[dict[str, Any]], required_size: int) -> list[dict[str, Any]]:
    progress: list[dict[str, Any]] = []
    for cohort in group_metrics:
        actual_size = cohort["size"]
        progress.append(
            {
                "name": cohort["name"],
                "actual": actual_size,
                "required": required_size,
                "remaining": max(required_size - actual_size, 0),
                "progressPct": round(min(actual_size / required_size, 1) * 100, 2) if required_size else 100.0,
                "isEnough": actual_size >= required_size,
            }
        )
    return progress


def build_ab_charts(
    rows: list[dict[str, str]],
    columns: list[dict[str, Any]],
    group_column: str,
    metric_column: str,
) -> dict[str, Any]:
    cohorts = Counter(row[group_column] for row in rows if not is_missing(row.get(group_column, "")))
    conversion_by_cohort: dict[str, int] = {cohort: 0 for cohort in cohorts}
    for row in rows:
        group_value = row.get(group_column, "")
        metric_value = row.get(metric_column, "")
        if is_missing(group_value) or is_missing(metric_value):
            continue
        conversion_by_cohort[group_value] += parse_binary_value(metric_value)

    cohort_names = list(cohorts.keys())
    charts: dict[str, Any] = {
        "cohortSizes": [{"name": cohort, "value": cohorts[cohort]} for cohort in cohort_names],
        "conversionRates": [
            {
                "name": cohort,
                "value": round((conversion_by_cohort[cohort] / cohorts[cohort]) * 100, 4) if cohorts[cohort] else 0.0,
            }
            for cohort in cohort_names
        ],
    }
    trend_chart = build_trend_chart(rows, columns, group_column, metric_column)
    if trend_chart is not None:
        charts["trendChart"] = trend_chart
    segment_chart = build_segment_chart(rows, columns, group_column, metric_column)
    if segment_chart is not None:
        charts["segmentChart"] = segment_chart
    return charts


def detect_user_id_column(columns: list[dict[str, Any]]) -> str | None:
    for column in columns:
        name = column["name"].lower()
        if name in {"user_id", "user id"}:
            return column["name"]
    return None


def detect_compatibility_column(columns: list[dict[str, Any]], group_column: str) -> str | None:
    for column in columns:
        name = column["name"]
        lowered = name.lower()
        if name == group_column:
            continue
        if "page" in lowered or "variant" in lowered or "experience" in lowered:
            return name
    return None


def filter_compatible_rows(
    rows: list[dict[str, str]],
    group_column: str,
    compatibility_column: str,
) -> tuple[list[dict[str, str]], int]:
    compatibility_map = infer_group_compatibility_map(rows, group_column, compatibility_column)
    if not compatibility_map:
        return rows, 0

    filtered_rows = [
        row for row in rows
        if is_missing(row.get(group_column, ""))
        or is_missing(row.get(compatibility_column, ""))
        or compatibility_map.get(row[group_column]) == row[compatibility_column]
    ]
    return filtered_rows, len(rows) - len(filtered_rows)


def infer_group_compatibility_map(
    rows: list[dict[str, str]],
    group_column: str,
    compatibility_column: str,
) -> dict[str, str]:
    group_values = sorted(
        {
            row[group_column]
            for row in rows
            if not is_missing(row.get(group_column, "")) and not is_missing(row.get(compatibility_column, ""))
        }
    )
    compatibility_values = sorted(
        {
            row[compatibility_column]
            for row in rows
            if not is_missing(row.get(group_column, "")) and not is_missing(row.get(compatibility_column, ""))
        }
    )
    if len(group_values) != 2 or len(compatibility_values) != 2:
        return {}

    lower_group_values = [value.lower() for value in group_values]
    lower_compatibility_values = [value.lower() for value in compatibility_values]
    if {"control", "treatment"}.issubset(set(lower_group_values)) and {"old_page", "new_page"}.issubset(set(lower_compatibility_values)):
        original_group = {value.lower(): value for value in group_values}
        original_compatibility = {value.lower(): value for value in compatibility_values}
        return {
            original_group["control"]: original_compatibility["old_page"],
            original_group["treatment"]: original_compatibility["new_page"],
        }
    return {}


def deduplicate_rows(rows: list[dict[str, str]], user_id_column: str) -> tuple[list[dict[str, str]], int]:
    seen_users: set[str] = set()
    deduped_rows: list[dict[str, str]] = []
    removed = 0
    for row in rows:
        user_id = row.get(user_id_column, "")
        if is_missing(user_id):
            deduped_rows.append(row)
            continue
        if user_id in seen_users:
            removed += 1
            continue
        seen_users.add(user_id)
        deduped_rows.append(row)
    return deduped_rows, removed


def choose_group_order(group_counts: Counter[str]) -> list[str]:
    groups = list(group_counts.keys())
    scored_groups = sorted(groups, key=group_sort_key)
    return scored_groups


def group_sort_key(group_name: str) -> tuple[int, str]:
    lowered = group_name.lower()
    if lowered in {"control", "old_page", "psa"}:
        return (0, lowered)
    if lowered in {"treatment", "variant", "new_page", "ad"}:
        return (1, lowered)
    return (2, lowered)


def build_trend_chart(
    rows: list[dict[str, str]],
    columns: list[dict[str, Any]],
    group_column: str,
    metric_column: str,
) -> dict[str, Any] | None:
    timestamp_column = detect_timestamp_column(columns)
    if timestamp_column is not None:
        grouped: dict[str, dict[str, list[int]]] = {}
        for row in rows:
            timestamp = row.get(timestamp_column, "")
            group_value = row.get(group_column, "")
            metric_value = row.get(metric_column, "")
            if is_missing(timestamp) or is_missing(group_value) or is_missing(metric_value):
                continue
            parsed_date = parse_date_bucket(timestamp)
            if parsed_date is None:
                continue
            bucket = grouped.setdefault(parsed_date, {})
            bucket.setdefault(group_value, []).append(parse_binary_value(metric_value))

        data = build_group_rate_series(grouped)
        if data:
            return {"title": "Conversion Rate Over Time", "xKey": "label", "data": data}

    day_column = next((column["name"] for column in columns if column["name"].lower() == "most ads day"), None)
    if day_column is not None:
        grouped = {}
        for row in rows:
            day_value = row.get(day_column, "")
            group_value = row.get(group_column, "")
            metric_value = row.get(metric_column, "")
            if is_missing(day_value) or is_missing(group_value) or is_missing(metric_value):
                continue
            bucket = grouped.setdefault(day_value, {})
            bucket.setdefault(group_value, []).append(parse_binary_value(metric_value))
        data = build_group_rate_series(grouped, order=DAY_ORDER)
        if data:
            return {"title": "Conversion Rate By Day", "xKey": "label", "data": data}
    return None


def build_segment_chart(
    rows: list[dict[str, str]],
    columns: list[dict[str, Any]],
    group_column: str,
    metric_column: str,
) -> dict[str, Any] | None:
    hour_column = next((column["name"] for column in columns if "hour" in column["name"].lower()), None)
    if hour_column is not None:
        grouped: dict[str, dict[str, list[int]]] = {}
        for row in rows:
            hour_value = row.get(hour_column, "")
            group_value = row.get(group_column, "")
            metric_value = row.get(metric_column, "")
            if is_missing(hour_value) or is_missing(group_value) or is_missing(metric_value):
                continue
            grouped.setdefault(hour_value, {}).setdefault(group_value, []).append(parse_binary_value(metric_value))
        ordered_hours = [str(hour) for hour in range(24)]
        data = build_group_rate_series(grouped, order=ordered_hours)
        if data:
            return {"title": "Conversion Rate By Hour", "xKey": "label", "data": data}
    return None


def build_group_rate_series(
    grouped: dict[str, dict[str, list[int]]],
    order: list[str] | None = None,
) -> list[dict[str, Any]]:
    labels = order if order is not None else sorted(grouped.keys())
    series: list[dict[str, Any]] = []
    for label in labels:
        if label not in grouped:
            continue
        row = {"label": label}
        for group_name, outcomes in grouped[label].items():
            row[group_name] = round((sum(outcomes) / len(outcomes)) * 100, 4) if outcomes else 0.0
        series.append(row)
    return series


def detect_timestamp_column(columns: list[dict[str, Any]]) -> str | None:
    for column in columns:
        lowered = column["name"].lower()
        if "timestamp" in lowered or lowered == "date":
            return column["name"]
    return None


def parse_date_bucket(value: str) -> str | None:
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def build_interpretation(
    control_name: str,
    variant_name: str,
    is_significant: bool,
    relative_lift: float,
    p_value: float | None,
    is_sample_size_enough: bool,
    has_srm: bool,
) -> str:
    direction = "improvement" if relative_lift >= 0 else "decline"
    strength = "statistically significant" if is_significant else "not statistically significant"
    sample_note = "Sample size is sufficient." if is_sample_size_enough else "Sample size is still a constraint."
    srm_note = " Sample ratio mismatch is present." if has_srm else ""
    p_value_text = f" (p={p_value:.4f})" if p_value is not None else ""
    return (
        f"{variant_name} shows a {abs(relative_lift):.2f}% {direction} versus {control_name}, "
        f"and the result is {strength}{p_value_text}. {sample_note}{srm_note}"
    )
