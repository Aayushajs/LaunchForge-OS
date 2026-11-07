import { db } from "@dokploy/server/db";
import { server, workspaceUsage } from "@dokploy/server/db/schema";
import { eq, lt, sql } from "drizzle-orm";
import { scheduleJob } from "node-schedule";
import { execAsync, execAsyncRemote } from "../process/execAsync";

const ORG_LABEL = "dokploy.organization.id";
export const SAMPLE_INTERVAL_SECONDS = 60;
const RETENTION_DAYS = 90;

const UNIT_MB: Record<string, number> = {
	b: 1 / (1024 * 1024),
	kib: 1 / 1024,
	kb: 1 / 1024,
	mib: 1,
	mb: 1,
	gib: 1024,
	gb: 1024,
	tib: 1024 * 1024,
	tb: 1024 * 1024,
};

/** Parses the used part of `docker stats` MemUsage, e.g. "123.4MiB / 1.9GiB". */
export const parseMemoryMb = (memUsage: string) => {
	const used = memUsage.split("/")[0]?.trim() ?? "";
	const match = used.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
	if (!match) return 0;
	const factor = UNIT_MB[match[2]?.toLowerCase() ?? ""] ?? 0;
	return Number(match[1]) * factor;
};

export const parseCpuCores = (cpuPerc: string) => {
	const value = Number.parseFloat(cpuPerc.replace("%", ""));
	return Number.isFinite(value) ? value / 100 : 0;
};

export interface OrganizationSample {
	organizationId: string;
	cpuCores: number;
	memoryMb: number;
	containers: number;
}

/**
 * Joins `docker ps` (container id -> organization label) with
 * `docker stats` lines and sums them per organization. Containers that do
 * not belong to a workspace (Traefik, the panel itself) are ignored.
 */
export const aggregateSamples = (
	psOutput: string,
	statsOutput: string,
): OrganizationSample[] => {
	const orgByContainer = new Map<string, string>();
	for (const line of psOutput.split("\n")) {
		const [id, organizationId] = line.trim().split(/\s+/);
		if (id && organizationId)
			orgByContainer.set(id.slice(0, 12), organizationId);
	}

	const totals = new Map<string, OrganizationSample>();
	for (const line of statsOutput.split("\n")) {
		if (!line.trim()) continue;
		let stat: { ID?: string; CPUPerc?: string; MemUsage?: string };
		try {
			stat = JSON.parse(line);
		} catch {
			continue;
		}
		const organizationId = orgByContainer.get((stat.ID ?? "").slice(0, 12));
		if (!organizationId) continue;
		const sample = totals.get(organizationId) ?? {
			organizationId,
			cpuCores: 0,
			memoryMb: 0,
			containers: 0,
		};
		sample.cpuCores += parseCpuCores(stat.CPUPerc ?? "");
		sample.memoryMb += parseMemoryMb(stat.MemUsage ?? "");
		sample.containers += 1;
		totals.set(organizationId, sample);
	}
	return [...totals.values()];
};

const PS_COMMAND = `docker ps --format '{{.ID}} {{.Label "${ORG_LABEL}"}}'`;
const STATS_COMMAND = `docker stats --no-stream --format '{{json .}}'`;

const sampleHost = async (serverId?: string) => {
	const run = (command: string) =>
		serverId ? execAsyncRemote(serverId, command) : execAsync(command);
	const [ps, stats] = await Promise.all([run(PS_COMMAND), run(STATS_COMMAND)]);
	return aggregateSamples(ps.stdout, stats.stdout);
};

export const startOfHour = (date: Date) => {
	const hour = new Date(date);
	hour.setUTCMinutes(0, 0, 0);
	return hour;
};

export const recordSamples = async (
	samples: OrganizationSample[],
	at = new Date(),
) => {
	const hour = startOfHour(at);
	for (const sample of samples) {
		const cpuCoreSeconds = sample.cpuCores * SAMPLE_INTERVAL_SECONDS;
		await db
			.insert(workspaceUsage)
			.values({
				organizationId: sample.organizationId,
				hour,
				samples: 1,
				cpuCoreSeconds,
				avgMemoryMb: sample.memoryMb,
				peakMemoryMb: sample.memoryMb,
				containers: sample.containers,
			})
			.onConflictDoUpdate({
				target: [workspaceUsage.organizationId, workspaceUsage.hour],
				set: {
					samples: sql`${workspaceUsage.samples} + 1`,
					cpuCoreSeconds: sql`${workspaceUsage.cpuCoreSeconds} + ${cpuCoreSeconds}`,
					avgMemoryMb: sql`(${workspaceUsage.avgMemoryMb} * ${workspaceUsage.samples} + ${sample.memoryMb}) / (${workspaceUsage.samples} + 1)`,
					peakMemoryMb: sql`greatest(${workspaceUsage.peakMemoryMb}, ${sample.memoryMb})`,
					containers: sql`greatest(${workspaceUsage.containers}, ${sample.containers})`,
				},
			});
	}
};

/** Samples the local host and every deploy server once. */
export const collectWorkspaceUsage = async () => {
	const remote = await db.query.server.findMany({
		where: eq(server.serverType, "deploy"),
		columns: { serverId: true, sshKeyId: true },
	});
	const hosts: Array<string | undefined> = [
		undefined,
		...remote.filter((s) => s.sshKeyId).map((s) => s.serverId),
	];
	const merged = new Map<string, OrganizationSample>();
	for (const serverId of hosts) {
		try {
			for (const sample of await sampleHost(serverId)) {
				const total = merged.get(sample.organizationId);
				merged.set(
					sample.organizationId,
					total
						? {
								organizationId: sample.organizationId,
								cpuCores: total.cpuCores + sample.cpuCores,
								memoryMb: total.memoryMb + sample.memoryMb,
								containers: total.containers + sample.containers,
							}
						: sample,
				);
			}
		} catch (error) {
			console.error(`[metering] sampling ${serverId ?? "local"} failed`, error);
		}
	}
	await recordSamples([...merged.values()]);
};

export const initWorkspaceMetering = () => {
	scheduleJob("workspace-metering", "* * * * *", () => {
		void collectWorkspaceUsage().catch((error) =>
			console.error("[metering] collection failed", error),
		);
	});
	scheduleJob("workspace-metering-retention", "17 3 * * *", async () => {
		const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);
		await db.delete(workspaceUsage).where(lt(workspaceUsage.hour, cutoff));
	});
};
