import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface Props {
	className?: string;
	logoUrl?: string;
	logoLightUrl?: string;
}

export const Logo = ({
	className = "size-14",
	logoUrl,
	logoLightUrl,
}: Props) => {
	const { resolvedTheme } = useTheme();
	const effectiveUrl =
		resolvedTheme === "light" && logoLightUrl ? logoLightUrl : logoUrl;

	if (effectiveUrl) {
		return (
			<img
				src={effectiveUrl}
				alt="Organization Logo"
				className={cn(className, "object-contain rounded-sm")}
			/>
		);
	}

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 64 64"
			fill="none"
			className={className}
			role="img"
			aria-label="LaunchForge"
		>
			<path
				d="M32 6 54.5 19v26L32 58 9.5 45V19Z"
				className="stroke-primary"
				strokeWidth={4}
				strokeLinejoin="round"
			/>
			<path d="M32 16 44 31h-7.5v10h-9V31H20Z" fill="#F97316" />
			<rect
				x={20}
				y={44}
				width={24}
				height={4.5}
				rx={2.25}
				className="fill-primary"
			/>
		</svg>
	);
};
