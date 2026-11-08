import { format } from "date-fns";
import { Gauge, Loader2 } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { api } from "@/utils/api";
import { MetricChart } from "../../monitoring/metric-chart";

const SAMPLE_SECONDS = 60;

const QuotaBar = ({
	label,
	used,
	max,
	unit,
}: {
	label: string;
	used: number;
	max: number | null | undefined;
	unit: string;
}) => {
	const percent = max ? Math.min(100, (used / max) * 100) : 0;
	return (
		<div className="space-y-1.5">
			<div className="flex justify-between text-sm">
				<span className="font-medium">{label}</span>
				<span className="text-muted-foreground">
					{Number.isInteger(used) ? used : used.toFixed(2)}
					{unit}
					{" / "}
					{max ? `${max}${unit}` : "unlimited"}
				</span>
			</div>
			<Progress value={max ? percent : 0} />
		</div>
	);
};

export const ShowWorkspaceUsage = () => {
	const { data, isPending } = api.workspace.usage.useQuery({ hours: 24 });
	const { t } = useTranslation();
	const hourly = (data?.usage ?? []).map((row) => ({
		hour: new Date(row.hour).toISOString(),
		cpu: row.samples ? row.cpuCoreSeconds / (row.samples * SAMPLE_SECONDS) : 0,
		avgMemory: row.avgMemoryMb,
		peakMemory: row.peakMemoryMb,
	}));
	const latest = hourly[hourly.length - 1];

	return (
		<Card className="h-full bg-sidebar p-2.5 rounded-xl max-w-5xl mx-auto w-full">
			<div className="rounded-xl bg-background shadow-md">
				<CardHeader>
					<CardTitle className="text-xl flex flex-row gap-2">
						<Gauge className="size-6 text-muted-foreground self-center" />
						Usage & Quotas
					</CardTitle>
					<CardDescription>
						Resources reserved by this workspace's services, and what they
						actually used over the last 24 hours.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-8 py-6 border-t">
					{isPending || !data ? (
						<div className="flex gap-2 items-center justify-center text-sm text-muted-foreground min-h-[20vh]">
							<span>Loading...</span>
							<Loader2 className="animate-spin size-4" />
						</div>
					) : (
						<>
							<div className="grid gap-6 sm:grid-cols-2">
								<QuotaBar
									label="Memory reserved"
									used={data.allocation.memoryMb}
									max={data.quota?.maxMemoryMb}
									unit=" MB"
								/>
								<QuotaBar
									label="CPU reserved"
									used={data.allocation.cpu}
									max={data.quota?.maxCpu}
									unit=" CPU"
								/>
								<QuotaBar
									label="Applications"
									used={data.allocation.applications}
									max={data.quota?.maxApplications}
									unit=""
								/>
								<QuotaBar
									label="Databases"
									used={data.allocation.databases}
									max={data.quota?.maxDatabases}
									unit=""
								/>
							</div>

							{data.usage.length === 0 ? (
								<p className="text-sm text-muted-foreground text-center">
									No usage recorded yet. Samples are taken every minute while
									services are running.
								</p>
							) : (
								<>
									<div className="grid gap-4 lg:grid-cols-2">
										<MetricChart
											title={t("Average CPU")}
											value={
												latest
													? t("{value} cores", { value: latest.cpu.toFixed(2) })
													: undefined
											}
											caption={t("Last 24 hours, per hour")}
											data={hourly}
											xKey="hour"
											formatX={(hour) => format(new Date(hour), "HH:mm")}
											series={[
												{
													key: "cpu",
													label: t("Average CPU"),
													color: "hsl(var(--chart-1))",
												},
											]}
											formatValue={(v) => v.toFixed(2)}
										/>
										<MetricChart
											title={t("Memory")}
											caption={t("Last 24 hours, per hour")}
											data={hourly}
											xKey="hour"
											formatX={(hour) => format(new Date(hour), "HH:mm")}
											series={[
												{
													key: "avgMemory",
													label: t("Average"),
													color: "hsl(var(--chart-2))",
												},
												{
													key: "peakMemory",
													label: t("Peak"),
													color: "hsl(var(--chart-3))",
												},
											]}
											formatValue={(v) => `${Math.round(v)} MB`}
										/>
									</div>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Hour</TableHead>
												<TableHead>Avg CPU</TableHead>
												<TableHead>Avg memory</TableHead>
												<TableHead>Peak memory</TableHead>
												<TableHead>Containers</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{[...data.usage].reverse().map((row) => (
												<TableRow key={new Date(row.hour).toISOString()}>
													<TableCell className="whitespace-nowrap">
														{format(new Date(row.hour), "PP HH:mm")}
													</TableCell>
													<TableCell>
														{row.samples
															? (
																	row.cpuCoreSeconds /
																	(row.samples * SAMPLE_SECONDS)
																).toFixed(2)
															: "0.00"}{" "}
														CPU
													</TableCell>
													<TableCell>
														{Math.round(row.avgMemoryMb)} MB
													</TableCell>
													<TableCell>
														{Math.round(row.peakMemoryMb)} MB
													</TableCell>
													<TableCell>{row.containers}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</>
							)}
						</>
					)}
				</CardContent>
			</div>
		</Card>
	);
};
