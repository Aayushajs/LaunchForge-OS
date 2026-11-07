import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, ScrollText } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/utils/api";

const PAGE_SIZE = 25;
const ALL = "all";

const ACTIONS = [
	"create",
	"update",
	"delete",
	"deploy",
	"redeploy",
	"cancel",
	"rebuild",
	"start",
	"stop",
	"reload",
	"restore",
	"download",
	"run",
	"move",
	"login",
	"logout",
] as const;

const actionVariant = (action: string) => {
	if (action === "delete" || action === "stop" || action === "cancel") {
		return "destructive" as const;
	}
	if (action === "create" || action === "deploy" || action === "redeploy") {
		return "default" as const;
	}
	return "secondary" as const;
};

export const ShowAuditLogs = () => {
	const [page, setPage] = useState(0);
	const [action, setAction] = useState<string>(ALL);
	const [userEmail, setUserEmail] = useState("");

	const { data, isPending } = api.auditLog.all.useQuery({
		limit: PAGE_SIZE,
		offset: page * PAGE_SIZE,
		action: action === ALL ? undefined : action,
		userEmail: userEmail.trim() || undefined,
	});

	const total = data?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl max-w-5xl mx-auto">
				<div className="rounded-xl bg-background shadow-md">
					<CardHeader>
						<CardTitle className="text-xl flex flex-row gap-2">
							<ScrollText className="size-6 text-muted-foreground self-center" />
							Audit Logs
						</CardTitle>
						<CardDescription>
							Every change made in this organization: who did what, and when.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4 py-6 border-t">
						<div className="flex flex-col sm:flex-row gap-2">
							<Input
								placeholder="Filter by user email"
								value={userEmail}
								onChange={(e) => {
									setUserEmail(e.target.value);
									setPage(0);
								}}
								className="sm:max-w-xs"
							/>
							<Select
								value={action}
								onValueChange={(value) => {
									setAction(value);
									setPage(0);
								}}
							>
								<SelectTrigger className="sm:w-48">
									<SelectValue placeholder="Action" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL}>All actions</SelectItem>
									{ACTIONS.map((a) => (
										<SelectItem key={a} value={a}>
											{a}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{isPending ? (
							<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[25vh]">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : data?.logs.length === 0 ? (
							<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
								<ScrollText className="size-8 text-muted-foreground" />
								<span className="text-base text-muted-foreground">
									No audit events match these filters
								</span>
							</div>
						) : (
							<>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Time</TableHead>
											<TableHead>User</TableHead>
											<TableHead>Action</TableHead>
											<TableHead>Resource</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{data?.logs.map((log) => (
											<TableRow key={log.id}>
												<TableCell className="whitespace-nowrap text-muted-foreground">
													{format(new Date(log.createdAt), "PP p")}
												</TableCell>
												<TableCell>
													<div className="flex flex-col">
														<span>{log.userEmail}</span>
														<span className="text-xs text-muted-foreground">
															{log.userRole}
														</span>
													</div>
												</TableCell>
												<TableCell>
													<Badge variant={actionVariant(log.action)}>
														{log.action}
													</Badge>
												</TableCell>
												<TableCell>
													<div className="flex flex-col">
														<span>
															{log.resourceName ?? log.resourceId ?? "—"}
														</span>
														<span className="text-xs text-muted-foreground">
															{log.resourceType}
														</span>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
								<div className="flex items-center justify-between text-sm text-muted-foreground">
									<span>
										{total} event{total === 1 ? "" : "s"} · page {page + 1} of{" "}
										{pageCount}
									</span>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="icon"
											disabled={page === 0}
											onClick={() => setPage((p) => p - 1)}
										>
											<ChevronLeft className="size-4" />
										</Button>
										<Button
											variant="outline"
											size="icon"
											disabled={page + 1 >= pageCount}
											onClick={() => setPage((p) => p + 1)}
										>
											<ChevronRight className="size-4" />
										</Button>
									</div>
								</div>
							</>
						)}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};
