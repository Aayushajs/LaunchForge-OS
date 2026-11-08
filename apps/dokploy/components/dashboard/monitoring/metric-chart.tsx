import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
} from "@/components/ui/chart";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface MetricSeries {
	key: string;
	label: string;
	/** A chart token such as `hsl(var(--chart-1))`, in categorical order. */
	color: string;
}

interface Props {
	title: string;
	data: Record<string, unknown>[];
	series: MetricSeries[];
	formatValue: (value: number) => string;
	/** Headline for single-series charts, usually the latest value. */
	value?: string;
	caption?: string;
	xKey?: string;
	formatX?: (value: string) => string;
	domain?: [number | "auto", number | "auto"];
	/** Units for the change badge, e.g. "pts" for percentages. */
	changeUnit?: string;
	height?: number;
	className?: string;
}

const toNumber = (value: unknown) => {
	const parsed =
		typeof value === "number" ? value : Number.parseFloat(String(value));
	return Number.isFinite(parsed) ? parsed : null;
};

const ChangeBadge = ({
	data,
	seriesKey,
	unit,
}: {
	data: Record<string, unknown>[];
	seriesKey: string;
	unit?: string;
}) => {
	const { t } = useTranslation();
	const first = toNumber(data[0]?.[seriesKey]);
	const last = toNumber(data[data.length - 1]?.[seriesKey]);
	if (first === null || last === null || data.length < 2) return null;

	const change = last - first;
	const Icon =
		change > 0.05 ? ArrowUpRight : change < -0.05 ? ArrowDownRight : Minus;
	const sign = change > 0 ? "+" : "";
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
			<Icon className="size-3.5" aria-hidden />
			{sign}
			{change.toFixed(1)}
			{unit ? ` ${unit}` : ""} {t("in view")}
		</span>
	);
};

/**
 * Time-series card in the product's chart style: headline value, change over
 * the visible window, area marks anchored to the baseline, a dashed
 * crosshair and one tooltip for every series at the hovered time.
 */
export const MetricChart = ({
	title,
	data,
	series,
	formatValue,
	value,
	caption,
	xKey = "timestamp",
	formatX = (x) => x,
	domain = [0, "auto"],
	changeUnit,
	height = 220,
	className,
}: Props) => {
	const { t } = useTranslation();
	const id = useId().replace(/:/g, "");
	const config = Object.fromEntries(
		series.map((s) => [s.key, { label: s.label, color: s.color }]),
	) satisfies ChartConfig;
	const latest = data[data.length - 1];
	const multi = series.length > 1;

	return (
		<Card className={cn("gap-0 overflow-hidden py-0", className)}>
			<CardHeader className="gap-1 px-5 pt-5 pb-2">
				<div className="flex items-center justify-between gap-3">
					<h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
					{!multi && series[0] && (
						<ChangeBadge
							data={data}
							seriesKey={series[0].key}
							unit={changeUnit}
						/>
					)}
				</div>
				{value && (
					<p className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight tabular-nums">
						{value}
					</p>
				)}
				{caption && <p className="text-xs text-muted-foreground">{caption}</p>}
				{multi && (
					<ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
						{series.map((s) => {
							const current = toNumber(latest?.[s.key]);
							return (
								<li key={s.key} className="flex items-center gap-2 text-sm">
									<span
										aria-hidden
										className="size-2.5 rounded-full"
										style={{ background: s.color }}
									/>
									<span className="text-muted-foreground">{s.label}</span>
									<span className="font-semibold tabular-nums">
										{current === null ? "—" : formatValue(current)}
									</span>
								</li>
							);
						})}
					</ul>
				)}
			</CardHeader>
			<CardContent className="px-2 pb-3">
				{data.length === 0 ? (
					<div
						className="grid place-items-center text-sm text-muted-foreground"
						style={{ height }}
					>
						{t("Waiting for the first data point")}
					</div>
				) : (
					<ChartContainer
						config={config}
						className="aspect-auto w-full"
						style={{ height }}
					>
						<AreaChart
							data={data}
							margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
						>
							<defs>
								{series.map((s) => (
									<linearGradient
										key={s.key}
										id={`${id}-${s.key}`}
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="0%"
											stopColor={s.color}
											stopOpacity={multi ? 0.18 : 0.32}
										/>
										<stop offset="100%" stopColor={s.color} stopOpacity={0} />
									</linearGradient>
								))}
							</defs>
							<CartesianGrid
								vertical={false}
								strokeDasharray="3 3"
								stroke="var(--border)"
							/>
							<XAxis
								dataKey={xKey}
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={48}
								tick={{ fontSize: 11 }}
								tickFormatter={formatX}
							/>
							<YAxis
								orientation="right"
								domain={domain}
								tickCount={4}
								width={56}
								tickLine={false}
								axisLine={false}
								tick={{ fontSize: 11 }}
								tickFormatter={(v: number) => formatValue(v)}
							/>
							<ChartTooltip
								cursor={{
									stroke: "var(--muted-foreground)",
									strokeDasharray: "4 4",
									strokeWidth: 1,
								}}
								content={({ active, payload, label }) => {
									if (!active || !payload?.length) return null;
									return (
										<div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
											<p className="mb-1.5 text-muted-foreground">
												{formatX(String(label))}
											</p>
											{series.map((s) => {
												const point = toNumber(payload[0]?.payload?.[s.key]);
												return (
													<div
														key={s.key}
														className="flex items-center gap-2 py-0.5"
													>
														<span
															aria-hidden
															className="size-2 rounded-full"
															style={{ background: s.color }}
														/>
														<span className="text-muted-foreground">
															{s.label}
														</span>
														<span className="ml-auto pl-4 font-semibold tabular-nums text-foreground">
															{point === null ? "—" : formatValue(point)}
														</span>
													</div>
												);
											})}
										</div>
									);
								}}
							/>
							{series.map((s) => (
								<Area
									key={s.key}
									name={s.label}
									dataKey={s.key}
									type="monotone"
									isAnimationActive={false}
									fill={`url(#${id}-${s.key})`}
									stroke={s.color}
									strokeWidth={2}
									dot={false}
									activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
								/>
							))}
						</AreaChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
};
