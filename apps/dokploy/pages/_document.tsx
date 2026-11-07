import NextDocument, {
	type DocumentContext,
	type DocumentInitialProps,
	Head,
	Html,
	Main,
	NextScript,
} from "next/document";
import { BRANDING } from "@/lib/branding";

interface DocumentProps {
	baseUrl: string;
}

export default function Document({ baseUrl }: DocumentProps) {
	const ogImage = `${baseUrl}/og.png`;

	return (
		<Html lang="en" className="font-sans">
			<Head>
				<title>{BRANDING.appName}</title>
				<meta name="description" content={BRANDING.appDescription} />
				<meta property="og:title" content={BRANDING.appName} />
				<meta property="og:description" content={BRANDING.appDescription} />
				<meta property="og:image" content={ogImage} />
				<link rel="icon" href="/icon.svg" />
			</Head>
			<body className="flex h-full w-full flex-col font-sans">
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}

Document.getInitialProps = async (
	ctx: DocumentContext,
): Promise<DocumentInitialProps & DocumentProps> => {
	const initialProps = await NextDocument.getInitialProps(ctx);
	const host = ctx.req?.headers?.host || "localhost:3000";
	const protocol = ctx.req?.headers?.["x-forwarded-proto"] || "http";
	return { ...initialProps, baseUrl: `${protocol}://${host}` };
};
