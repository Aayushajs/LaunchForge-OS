import { Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/utils/api";

type PermissionMap = Record<string, string[]>;

interface EditorState {
	mode: "create" | "edit";
	role: string;
	permissions: PermissionMap;
}

const countPermissions = (permissions: PermissionMap) =>
	Object.values(permissions).reduce((sum, actions) => sum + actions.length, 0);

const toggle = (
	permissions: PermissionMap,
	resource: string,
	action: string,
	enabled: boolean,
): PermissionMap => {
	const current = new Set(permissions[resource] ?? []);
	if (enabled) current.add(action);
	else current.delete(action);
	const next = { ...permissions };
	if (current.size === 0) delete next[resource];
	else next[resource] = [...current];
	return next;
};

export const ManageCustomRoles = () => {
	const utils = api.useUtils();
	const { data: roles, isPending } = api.customRole.all.useQuery();
	const { data: statements } = api.customRole.getStatements.useQuery();
	const createRole = api.customRole.create.useMutation();
	const updateRole = api.customRole.update.useMutation();
	const removeRole = api.customRole.remove.useMutation();
	const [editor, setEditor] = useState<EditorState | null>(null);

	useEffect(() => {
		if (!editor) {
			createRole.reset();
			updateRole.reset();
		}
	}, [editor, createRole.reset, updateRole.reset]);

	const saving = createRole.isPending || updateRole.isPending;
	const saveError = createRole.error ?? updateRole.error;

	const onSave = async () => {
		if (!editor) return;
		const payload = { role: editor.role, permissions: editor.permissions };
		if (editor.mode === "create") await createRole.mutateAsync(payload);
		else await updateRole.mutateAsync(payload);
		await utils.customRole.all.invalidate();
		toast.success(editor.mode === "create" ? "Role created" : "Role updated");
		setEditor(null);
	};

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl max-w-5xl mx-auto">
				<div className="rounded-xl bg-background shadow-md">
					<CardHeader className="flex flex-row items-start justify-between gap-4">
						<div className="space-y-1.5">
							<CardTitle className="text-xl flex flex-row gap-2">
								<ShieldCheck className="size-6 text-muted-foreground self-center" />
								Custom Roles
							</CardTitle>
							<CardDescription>
								Define roles with exactly the permissions a member needs.
							</CardDescription>
						</div>
						<Button
							onClick={() =>
								setEditor({ mode: "create", role: "", permissions: {} })
							}
						>
							<Plus className="size-4" />
							New role
						</Button>
					</CardHeader>
					<CardContent className="space-y-2 py-6 border-t">
						{isPending ? (
							<div className="flex gap-2 items-center justify-center text-sm text-muted-foreground min-h-[15vh]">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : roles?.length === 0 ? (
							<p className="text-sm text-muted-foreground text-center py-8">
								No custom roles yet. Members use the built-in Owner, Admin and
								Member roles.
							</p>
						) : (
							<div className="divide-y rounded-lg border">
								{roles?.map((role) => (
									<div
										key={role.id}
										className="flex items-center justify-between gap-4 p-3"
									>
										<div className="flex items-center gap-3">
											<span className="font-medium">{role.role}</span>
											<Badge variant="secondary">
												{countPermissions(role.permissions)} permissions
											</Badge>
										</div>
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="icon"
												onClick={() =>
													setEditor({
														mode: "edit",
														role: role.role,
														permissions: role.permissions,
													})
												}
											>
												<Pencil className="size-4" />
											</Button>
											<DialogAction
												title="Delete role"
												description={`Delete the "${role.role}" role? Members must be moved to another role first.`}
												type="destructive"
												onClick={async () => {
													await removeRole
														.mutateAsync({ role: role.role })
														.then(() => {
															toast.success("Role deleted");
															return utils.customRole.all.invalidate();
														})
														.catch((error) => toast.error(error.message));
												}}
											>
												<Button variant="ghost" size="icon">
													<Trash2 className="size-4 text-destructive" />
												</Button>
											</DialogAction>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</div>
			</Card>

			<Dialog open={!!editor} onOpenChange={(open) => !open && setEditor(null)}>
				<DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editor?.mode === "create" ? "New role" : `Edit ${editor?.role}`}
						</DialogTitle>
						<DialogDescription>
							Pick the actions this role may perform on each resource.
						</DialogDescription>
					</DialogHeader>
					{editor && (
						<div className="space-y-4">
							{editor.mode === "create" && (
								<div className="space-y-2">
									<Label htmlFor="role-name">Role name</Label>
									<Input
										id="role-name"
										placeholder="e.g. deployer"
										value={editor.role}
										onChange={(e) =>
											setEditor({ ...editor, role: e.target.value })
										}
									/>
								</div>
							)}
							<div className="grid gap-3 sm:grid-cols-2">
								{Object.entries(statements ?? {}).map(([resource, actions]) => (
									<div
										key={resource}
										className="rounded-lg border p-3 space-y-2"
									>
										<p className="text-sm font-medium">{resource}</p>
										<div className="flex flex-wrap gap-x-4 gap-y-2">
											{(actions as readonly string[]).map((action) => {
												const id = `${resource}-${action}`;
												return (
													<div key={id} className="flex items-center gap-1.5">
														<Checkbox
															id={id}
															checked={
																editor.permissions[resource]?.includes(
																	action,
																) ?? false
															}
															onCheckedChange={(checked) =>
																setEditor({
																	...editor,
																	permissions: toggle(
																		editor.permissions,
																		resource,
																		action,
																		checked === true,
																	),
																})
															}
														/>
														<Label htmlFor={id} className="text-xs font-normal">
															{action}
														</Label>
													</div>
												);
											})}
										</div>
									</div>
								))}
							</div>
							{saveError && (
								<p className="text-sm text-destructive">{saveError.message}</p>
							)}
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditor(null)}>
							Cancel
						</Button>
						<Button
							onClick={onSave}
							disabled={saving || !editor?.role}
							isLoading={saving}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};
