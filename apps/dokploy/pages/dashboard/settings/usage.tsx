import { validateRequest } from "@dokploy/server";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { ManageWorkspaceQuotas } from "@/components/dashboard/settings/usage/manage-workspace-quotas";
import { ShowWorkspaceUsage } from "@/components/dashboard/settings/usage/show-workspace-usage";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";
import { api } from "@/utils/api";

const Page = () => {
	const { data: isOperator } = api.workspace.isOperator.useQuery();
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowWorkspaceUsage />
			{isOperator && <ManageWorkspaceQuotas />}
		</div>
	);
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="Usage & Quotas">{page}</DashboardLayout>;
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	const { req, res } = ctx;
	const { user, session } = await validateRequest(req);

	if (!user) {
		return { redirect: { destination: "/", permanent: false } };
	}

	const helpers = createServerSideHelpers({
		router: appRouter,
		ctx: {
			req: req as any,
			res: res as any,
			db: null as any,
			session: session as any,
			user: user as any,
		},
		transformer: superjson,
	});

	try {
		const userPermissions = await helpers.user.getPermissions.fetch();
		if (!userPermissions?.monitoring.read) {
			return {
				redirect: {
					destination: "/dashboard/settings/profile",
					permanent: false,
				},
			};
		}
		return { props: { trpcState: helpers.dehydrate() } };
	} catch {
		return { props: {} };
	}
}
