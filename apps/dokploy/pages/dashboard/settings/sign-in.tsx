import { validateRequest } from "@dokploy/server";
import { isPlatformWorkspace } from "@dokploy/server/services/platform";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { ShowSignInSettings } from "@/components/dashboard/settings/sign-in/show-sign-in-settings";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";

const Page = () => <ShowSignInSettings />;

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="Sign-in & Email">{page}</DashboardLayout>;
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	const { user, session } = await validateRequest(ctx.req);
	if (!user) {
		return { redirect: { destination: "/", permanent: false } };
	}
	// Instance-wide settings: only owners and admins of the platform workspace.
	const allowed =
		(user.role === "owner" || user.role === "admin") &&
		(await isPlatformWorkspace(session?.activeOrganizationId ?? ""));
	if (!allowed) {
		return {
			redirect: {
				destination: "/dashboard/settings/profile",
				permanent: false,
			},
		};
	}
	return { props: {} };
}
