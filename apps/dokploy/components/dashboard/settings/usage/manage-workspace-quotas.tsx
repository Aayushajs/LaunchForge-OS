import { Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/utils/api";

type QuotaField =
	| "maxMemoryMb"
	| "maxCpu"
	| "maxApplications"
	| "maxDatabases"
	| "maxDomains";

const FIELDS: Array<{ key: QuotaField; label: string; step?: string }> = [
	{ key: "maxMemoryMb", label: "Memory (MB)" },
	{ key: "maxCpu", label: "CPU", step: "0.25" },
	{ key: "maxApplications", label: "Apps" },
	{ key: "maxDatabases", label: "Databases" },
	{ key: "maxDomains", label: "Domains" },
];

type Draft = Record<QuotaField, string>;

const toNumber = (value: string, integer: boolean) => {
	if (value.trim() === "") return null;
	const parsed = integer ? Number.parseInt(value, 10) : Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const WorkspaceRow = ({
	workspace,
}: {
	workspace: {
		id: string;
		name: string;
		quota: Partial<Record<QuotaField, number | null>> | null;
		allocation: {
			memoryMb: number;
			cpu: number;
			applications: number;
			databases: number;
		};
	};
}) => {
	const utils = api.useUtils();
	const setQuota = api.workspace.setQuota.useMutation();
	const [draft, setDraft] = useState<Draft>(
		() =>
			Object.fromEntries(
				FIELDS.map(({ key }) => [
					key,
					workspace.quota?.[key]?.toString() ?? "",
				]),
			) as Draft,
	);

	const save = async () => {
		await setQuota
			.mutateAsync({
				organizationId: workspace.id,
				maxMemoryMb: toNumber(draft.maxMemoryMb, true),
				maxCpu: toNumber(draft.maxCpu, false),
				maxApplications: toNumber(draft.maxApplications, true),
				maxDatabases: toNumber(draft.maxDatabases, true),
				maxDomains: toNumber(draft.maxDomains, true),
			})
			.then(() => {
				toast.success(`Quota saved for ${workspace.name}`);
				return utils.workspace.all.invalidate();
			})
			.catch((error) => toast.error(error.message));
	};

	return (
		<div className="rounded-lg border p-4 space-y-3">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<span className="font-medium">{workspace.name}</span>
				<span className="text-xs text-muted-foreground">
					{workspace.allocation.memoryMb} MB ·{" "}
					{workspace.allocation.cpu.toFixed(2)} CPU ·{" "}
					{workspace.allocation.applications} apps ·{" "}
					{workspace.allocation.databases} databases reserved
				</span>
			</div>
			<div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
				{FIELDS.map(({ key, label, step }) => (
					<div key={key} className="space-y-1">
						<Label htmlFor={`${workspace.id}-${key}`} className="text-xs">
							{label}
						</Label>
						<Input
							id={`${workspace.id}-${key}`}
							type="number"
							min={0}
							step={step ?? "1"}
							placeholder="unlimited"
							value={draft[key]}
							onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
						/>
					</div>
				))}
			</div>
			<div className="flex justify-end">
				<Button size="sm" onClick={save} isLoading={setQuota.isPending}>
					Save quota
				</Button>
			</div>
		</div>
	);
};

export const ManageWorkspaceQuotas = () => {
	const { data, isPending } = api.workspace.all.useQuery();

	return (
		<Card className="h-full bg-sidebar p-2.5 rounded-xl max-w-5xl mx-auto w-full">
			<div className="rounded-xl bg-background shadow-md">
				<CardHeader>
					<CardTitle className="text-xl flex flex-row gap-2">
						<Building2 className="size-6 text-muted-foreground self-center" />
						All workspaces
					</CardTitle>
					<CardDescription>
						Set per-workspace limits. Leave a field empty for no limit. Services
						without their own CPU/memory limits are counted at the default limit
						once a workspace has a quota.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 py-6 border-t">
					{isPending ? (
						<div className="flex gap-2 items-center justify-center text-sm text-muted-foreground min-h-[15vh]">
							<span>Loading...</span>
							<Loader2 className="animate-spin size-4" />
						</div>
					) : (
						data?.map((workspace) => (
							<WorkspaceRow key={workspace.id} workspace={workspace} />
						))
					)}
				</CardContent>
			</div>
		</Card>
	);
};
