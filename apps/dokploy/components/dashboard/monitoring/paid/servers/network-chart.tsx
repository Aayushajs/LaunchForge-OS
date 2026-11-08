import { useTranslation } from "@/lib/i18n";
import { formatTimestamp } from "@/lib/utils";
import { MetricChart } from "../../metric-chart";

interface NetworkChartProps {
	data: any[];
}

// The agent reports cumulative megabytes since boot.
const formatGB = (valueInMB: number) =>
	Number.isNaN(valueInMB) ? "0 GB" : `${(valueInMB / 1024).toFixed(1)} GB`;

export function NetworkChart({ data }: NetworkChartProps) {
	const { t } = useTranslation();

	return (
		<MetricChart
			title={t("Network since boot")}
			data={data}
			series={[
				{
					key: "networkIn",
					label: t("Received"),
					color: "hsl(var(--chart-3))",
				},
				{ key: "networkOut", label: t("Sent"), color: "hsl(var(--chart-4))" },
			]}
			formatValue={formatGB}
			formatX={formatTimestamp}
			domain={["auto", "auto"]}
		/>
	);
}
