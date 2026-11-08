import { formatMb, toMb } from "@dokploy/server/monitoring/units";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "@/lib/i18n";
import { api } from "@/utils/api";
import { MetricChart } from "../../metric-chart";
import { DockerDiskChart } from "./docker-disk-chart";
import { DockerDiskUsageChart } from "./docker-disk-usage-chart";

const formatTime = (time: string) =>
	time ? format(new Date(time), "HH:mm:ss") : "";

// Axis labels must stay short enough to fit on one line.
const formatMbAxis = (mb: number) =>
	mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;

const defaultData = {
	cpu: {
		value: "0%",
		time: "",
	},
	memory: {
		value: {
			used: 0,
			total: 0,
		},
		time: "",
	},
	block: {
		value: {
			readMb: 0,
			writeMb: 0,
		},
		time: "",
	},
	network: {
		value: {
			inputMb: 0,
			outputMb: 0,
		},
		time: "",
	},
	disk: {
		value: { diskTotal: 0, diskUsage: 0, diskUsedPercentage: 0, diskFree: 0 },
		time: "",
	},
};

interface Props {
	appName: string;
	appType?: "application" | "stack" | "docker-compose";
	serviceId?: string;
}
export interface DockerStats {
	cpu: {
		value: string;
		time: string;
	};
	memory: {
		value: {
			used: number;
			total: number;
		};
		time: string;
	};
	block: {
		value: {
			readMb: number;
			writeMb: number;
		};
		time: string;
	};
	network: {
		value: {
			inputMb: number;
			outputMb: number;
		};
		time: string;
	};
	disk: {
		value: {
			diskTotal: number;
			diskUsage: number;
			diskUsedPercentage: number;
			diskFree: number;
		};

		time: string;
	};
}

export type DockerStatsJSON = {
	cpu: DockerStats["cpu"][];
	memory: DockerStats["memory"][];
	block: DockerStats["block"][];
	network: DockerStats["network"][];
	disk: DockerStats["disk"][];
};

export const convertMemoryToBytes = (
	memoryString: string | undefined,
): number => {
	if (!memoryString || typeof memoryString !== "string") {
		return 0;
	}

	const value = Number.parseFloat(memoryString) || 0;
	const unit = memoryString.replace(/[0-9.]/g, "").trim();

	switch (unit) {
		case "KiB":
			return value * 1024;
		case "MiB":
			return value * 1024 * 1024;
		case "GiB":
			return value * 1024 * 1024 * 1024;
		case "TiB":
			return value * 1024 * 1024 * 1024 * 1024;
		default:
			return value;
	}
};

export const ContainerFreeMonitoring = ({
	appName,
	appType = "application",
	serviceId,
}: Props) => {
	const { t } = useTranslation();
	const { data } = api.application.readAppMonitoring.useQuery(
		{ appName },
		{
			refetchOnWindowFocus: false,
		},
	);
	const [accumulativeData, setAccumulativeData] = useState<DockerStatsJSON>({
		cpu: [],
		memory: [],
		block: [],
		network: [],
		disk: [],
	});
	const [currentData, setCurrentData] = useState<DockerStats>(defaultData);

	useEffect(() => {
		setCurrentData(defaultData);

		setAccumulativeData({
			cpu: [],
			memory: [],
			block: [],
			network: [],
			disk: [],
		});
	}, [appName]);

	useEffect(() => {
		if (!data) return;

		setCurrentData({
			cpu: data.cpu[data.cpu.length - 1] ?? currentData.cpu,
			memory: data.memory[data.memory.length - 1] ?? currentData.memory,
			block: data.block[data.block.length - 1] ?? currentData.block,
			network: data.network[data.network.length - 1] ?? currentData.network,
			disk: data.disk[data.disk.length - 1] ?? currentData.disk,
		});
		setAccumulativeData({
			block: data?.block || [],
			cpu: data?.cpu || [],
			disk: data?.disk || [],
			memory: data?.memory || [],
			network: data?.network || [],
		});
	}, [data]);

	useEffect(() => {
		if (!appName) return;

		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const params = new URLSearchParams({ appName, appType });
		if (serviceId) {
			params.append("serviceId", serviceId);
		}
		const wsUrl = `${protocol}//${window.location.host}/listen-docker-stats-monitoring?${params.toString()}`;
		const ws = new WebSocket(wsUrl);

		ws.onmessage = (e) => {
			const value = JSON.parse(e.data);
			if (!value) return;

			const data = {
				cpu: value.data.cpu ?? currentData.cpu,
				memory: value.data.memory ?? currentData.memory,
				block: value.data.block ?? currentData.block,
				disk: value.data.disk ?? currentData.disk,
				network: value.data.network ?? currentData.network,
			};

			setCurrentData(data);

			const MAX_DATA_POINTS = 300;
			setAccumulativeData((prevData) => ({
				cpu: [...prevData.cpu, data.cpu].slice(-MAX_DATA_POINTS),
				memory: [...prevData.memory, data.memory].slice(-MAX_DATA_POINTS),
				block: [...prevData.block, data.block].slice(-MAX_DATA_POINTS),
				network: [...prevData.network, data.network].slice(-MAX_DATA_POINTS),
				disk: [...prevData.disk, data.disk].slice(-MAX_DATA_POINTS),
			}));
		};

		ws.onclose = (e) => {
			if (e.reason) {
				toast.error(e.reason);
			}
		};

		return () => ws.close();
	}, [appName, serviceId]);

	return (
		<div className="rounded-xl bg-background flex flex-col gap-4">
			<header className="flex items-center justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">Monitoring</h1>
					<p className="text-sm text-muted-foreground">
						Watch the usage of your server in the current app
					</p>
				</div>
			</header>

			<div className="grid gap-6 lg:grid-cols-2">
				<MetricChart
					title={t("CPU")}
					value={String(currentData.cpu.value ?? "0%")}
					data={accumulativeData.cpu.map((item) => ({
						time: item.time,
						usage: Number.parseFloat(String(item.value)) || 0,
					}))}
					series={[
						{ key: "usage", label: t("CPU"), color: "hsl(var(--chart-1))" },
					]}
					formatValue={(v) => `${v.toFixed(1)}%`}
					xKey="time"
					formatX={formatTime}
					changeUnit={t("pts")}
				/>
				<MetricChart
					title={t("Memory")}
					value={String(currentData.memory.value.used || "0B")}
					caption={t("Limit {limit}", {
						limit: String(currentData.memory.value.total || "—"),
					})}
					data={accumulativeData.memory.map((item) => ({
						time: item.time,
						// @ts-expect-error the stats API types memory as numbers but sends "12MiB" strings
						usage: convertMemoryToBytes(item.value.used) / 1024 ** 2,
					}))}
					series={[
						{ key: "usage", label: t("Memory"), color: "hsl(var(--chart-2))" },
					]}
					formatValue={(v) => formatMb(v)}
					formatAxis={formatMbAxis}
					xKey="time"
					formatX={formatTime}
					changeUnit="MB"
				/>
				{appName === "dokploy" && (
					<Card className="bg-background">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Disk Space</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex flex-col gap-2 w-full">
								<span className="text-sm text-muted-foreground">
									{`Used:  ${currentData.disk.value.diskUsage} GB / Limit: ${currentData.disk.value.diskTotal} GB`}
								</span>
								<Progress
									value={currentData.disk.value.diskUsedPercentage}
									className="w-full"
								/>
								<DockerDiskChart
									accumulativeData={accumulativeData.disk}
									diskTotal={currentData.disk.value.diskTotal}
								/>
							</div>
						</CardContent>
					</Card>
				)}
				{appName === "dokploy" && (
					<Card className="bg-background">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Docker Disk Usage
							</CardTitle>
						</CardHeader>
						<CardContent>
							<DockerDiskUsageChart />
						</CardContent>
					</Card>
				)}

				<MetricChart
					title={t("Disk reads and writes")}
					data={accumulativeData.block.map((item) => ({
						time: item.time,
						read: toMb(item.value.readMb),
						write: toMb(item.value.writeMb),
					}))}
					series={[
						{ key: "read", label: t("Read"), color: "hsl(var(--chart-3))" },
						{ key: "write", label: t("Written"), color: "hsl(var(--chart-4))" },
					]}
					formatValue={(v) => formatMb(v)}
					formatAxis={formatMbAxis}
					xKey="time"
					formatX={formatTime}
				/>
				<MetricChart
					title={t("Network")}
					data={accumulativeData.network.map((item) => ({
						time: item.time,
						received: toMb(item.value.inputMb),
						sent: toMb(item.value.outputMb),
					}))}
					series={[
						{
							key: "received",
							label: t("Received"),
							color: "hsl(var(--chart-3))",
						},
						{ key: "sent", label: t("Sent"), color: "hsl(var(--chart-4))" },
					]}
					formatValue={(v) => formatMb(v)}
					formatAxis={formatMbAxis}
					xKey="time"
					formatX={formatTime}
				/>
			</div>
		</div>
	);
};
