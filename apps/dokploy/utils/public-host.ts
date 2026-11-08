/**
 * Whether a hostname can be reached from the public internet, for services
 * such as GitHub that call back into the dashboard.
 */
export const isPublicHost = (hostname: string) => {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
	if (
		host === "localhost" ||
		host.endsWith(".localhost") ||
		host.endsWith(".local") ||
		host.endsWith(".internal")
	) {
		return false;
	}
	if (host.includes(":")) {
		return !(
			host === "::1" ||
			host.startsWith("fc") ||
			host.startsWith("fd") ||
			host.startsWith("fe80:")
		);
	}

	const octets = host.split(".").map(Number);
	if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n))) {
		return true;
	}
	const [a, b] = octets as [number, number, number, number];
	return !(
		a === 10 ||
		a === 127 ||
		a === 0 ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 100 && b >= 64 && b <= 127)
	);
};
