import { useTranslation } from "@/lib/i18n";
import { formatTimestamp } from "@/lib/utils";
import { MetricChart } from "../../metric-chart";

interface CPUChartProps {
	data: any[];
}

export function CPUChart({ data }: CPUChartProps) {
	const { t } = useTranslation();
	const latest = data[data.length - 1];

	return (
		<MetricChart
			title={t("CPU")}
			value={latest ? `${latest.cpu}%` : undefined}
			data={data}
			series={[{ key: "cpu", label: t("CPU"), color: "hsl(var(--chart-1))" }]}
			formatValue={(v) => `${Math.round(v)}%`}
			formatX={formatTimestamp}
			domain={[0, 100]}
			changeUnit={t("pts")}
		/>
	);
}
