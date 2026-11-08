import { useTranslation } from "@/lib/i18n";
import { formatTimestamp } from "@/lib/utils";
import { MetricChart } from "../../metric-chart";

interface MemoryChartProps {
	data: any[];
}

export function MemoryChart({ data }: MemoryChartProps) {
	const { t } = useTranslation();
	const latest = data[data.length - 1];

	return (
		<MetricChart
			title={t("Memory")}
			value={latest ? `${latest.memUsedGB} GB` : undefined}
			caption={
				latest
					? t("of {total} GB ({percent}%)", {
							total: latest.memTotal,
							percent: latest.memUsed,
						})
					: undefined
			}
			data={data}
			series={[
				{ key: "memUsed", label: t("Memory"), color: "hsl(var(--chart-2))" },
			]}
			formatValue={(v) => `${Math.round(v)}%`}
			formatX={formatTimestamp}
			domain={[0, 100]}
			changeUnit={t("pts")}
		/>
	);
}
