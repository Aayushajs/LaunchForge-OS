import { Languages } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { LOCALES, type Locale, useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const LanguageSwitcher = ({ className }: { className?: string }) => {
	const { locale, setLocale, t } = useTranslation();

	return (
		<Select
			value={locale}
			onValueChange={(value) => setLocale(value as Locale)}
		>
			<SelectTrigger
				aria-label={t("Language")}
				className={cn("h-9 w-auto gap-2", className)}
			>
				<Languages className="size-4 text-muted-foreground" aria-hidden />
				<SelectValue />
			</SelectTrigger>
			<SelectContent align="end">
				{LOCALES.map(({ code, label }) => (
					<SelectItem key={code} value={code} lang={code}>
						{label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
};
