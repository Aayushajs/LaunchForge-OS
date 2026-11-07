import { useRouter } from "next/router";
import posthog from "posthog-js";
import { useEffect } from "react";
import { api } from "@/utils/api";

/**
 * Product analytics are opt-in: PostHog only loads in cloud mode and only
 * when the operator configures their own PostHog key on the server.
 */
export const Analytics = () => {
	const { data: isCloud } = api.settings.isCloud.useQuery();
	if (!isCloud) {
		return null;
	}
	return <PostHogTracking />;
};

const PostHogTracking = () => {
	const router = useRouter();
	const { data: config } = api.settings.getPostHogConfig.useQuery();
	const isDashboard = router.pathname.startsWith("/dashboard");
	const { data: member } = api.user.get.useQuery(undefined, {
		enabled: !!config && isDashboard,
	});
	const { data: billingStatus } = api.stripe.getBillingStatus.useQuery(
		undefined,
		{ enabled: !!config && isDashboard },
	);

	useEffect(() => {
		if (!config || posthog.__loaded) {
			return;
		}
		posthog.init(config.key, {
			api_host: config.host,
			defaults: "2025-05-24",
			person_profiles: "identified_only",
			tracing_headers: [window.location.hostname],
			// Replay only runs for trial / no-plan users, started below once billing status is known.
			disable_session_recording: true,
			session_recording: {
				maskAllInputs: true,
				// Editors, terminals and log viewers render env vars, compose files and secrets as plain text.
				maskTextSelector: ".cm-editor, .xterm, pre, code",
			},
		});
	}, [config]);

	const userId = member?.user.id;
	const email = member?.user.email;
	const organizationId = member?.organizationId;
	useEffect(() => {
		if (!config || !userId || !organizationId) {
			return;
		}
		posthog.identify(userId, { email });
		posthog.group("organization", organizationId);
	}, [config, userId, email, organizationId]);

	const utils = api.useUtils();
	useEffect(() => {
		// Outside the dashboard (login, register) the next user may be someone else; drop the
		// cached billing status so their recording decision never uses the previous user's plan.
		if (!isDashboard) {
			void utils.stripe.getBillingStatus.reset();
		}
	}, [isDashboard, utils]);

	const shouldRecord =
		isDashboard &&
		!!billingStatus &&
		!billingStatus.isEnterpriseCloud &&
		(billingStatus.isOnTrial || !billingStatus.hasActiveAccess);
	useEffect(() => {
		if (!config || !posthog.__loaded) {
			return;
		}
		if (shouldRecord) {
			posthog.startSessionRecording();
		} else {
			posthog.stopSessionRecording();
		}
	}, [config, shouldRecord]);

	return null;
};

export const resetPostHog = () => {
	if (posthog.__loaded) {
		posthog.stopSessionRecording();
		posthog.reset();
	}
};

/**
 * The HubSpot script is loaded app-wide for marketing tracking, but the
 * conversations (chat) widget stays restricted to startup plan customers.
 */
export const useHubSpotChat = (enabled: boolean) => {
	useEffect(() => {
		if (!enabled) {
			return;
		}
		const loadWidget = () => {
			window.HubSpotConversations?.widget.load();
		};
		if (window.HubSpotConversations) {
			loadWidget();
		} else {
			window.hsConversationsOnReady = [
				...(window.hsConversationsOnReady || []),
				loadWidget,
			];
		}
		return () => {
			window.hsConversationsOnReady = window.hsConversationsOnReady?.filter(
				(callback) => callback !== loadWidget,
			);
			window.HubSpotConversations?.widget.remove();
		};
	}, [enabled]);
};
