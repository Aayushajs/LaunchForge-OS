import { IS_CLOUD, isAdminPresent, validateRequest } from "@dokploy/server";
import { enabledSocialProviders } from "@dokploy/server/lib/auth";
import { isPublicSignupEnabled } from "@dokploy/server/services/platform";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { AlertTriangle } from "lucide-react";
import type { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { type ReactElement, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
	type SocialProvider,
	SocialSignIn,
} from "@/components/auth/social-sign-in";
import { OnboardingLayout } from "@/components/layouts/onboarding-layout";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { pushToDataLayer } from "@/lib/analytics";
import { authClient } from "@/lib/auth-client";
import { useTranslation } from "@/lib/i18n";
import { appRouter } from "@/server/api/root";
import { generateServerSideHelper } from "@/utils/create-server-helpers";
import { useWhitelabelingPublic } from "@/utils/hooks/use-whitelabeling";

const registerSchema = z
	.object({
		name: z.string().min(1, {
			message: "First name is required",
		}),
		lastName: z.string().min(1, {
			message: "Last name is required",
		}),
		email: z
			.string()
			.trim()
			.min(1, {
				message: "Email is required",
			})
			.email({
				message: "Email must be a valid email",
			}),
		password: z
			.string()
			.min(1, {
				message: "Password is required",
			})
			.refine((password) => password === "" || password.length >= 12, {
				message: "Password must be at least 12 characters",
			}),
		confirmPassword: z
			.string()
			.min(1, {
				message: "Password is required",
			})
			.refine(
				(confirmPassword) =>
					confirmPassword === "" || confirmPassword.length >= 12,
				{
					message: "Password must be at least 12 characters",
				},
			),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type Register = z.infer<typeof registerSchema>;

interface Props {
	hasAdmin: boolean;
	isCloud: boolean;
	publicSignup?: boolean;
	socialProviders?: SocialProvider[];
}

const Register = ({ isCloud, publicSignup, socialProviders }: Props) => {
	const isSignup = isCloud || !!publicSignup;
	const router = useRouter();
	const { t } = useTranslation();
	const { config: whitelabeling } = useWhitelabelingPublic();
	const [isError, setIsError] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [data, setData] = useState<any>(null);

	const form = useForm<Register>({
		defaultValues: {
			name: "",
			lastName: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
		resolver: zodResolver(registerSchema),
	});

	useEffect(() => {
		form.reset();
	}, [form, form.reset, form.formState.isSubmitSuccessful]);

	const onSubmit = async (values: Register) => {
		const { data, error } = await authClient.signUp.email({
			email: values.email,
			password: values.password,
			name: values.name,
			lastName: values.lastName,
		});

		if (error) {
			setIsError(true);
			setError(error.message || "An error occurred");
		} else {
			toast.success("User registered successfully", {
				duration: 2000,
			});
			if (!isCloud) {
				router.push("/");
			} else {
				pushToDataLayer("sign_up", { method: "email" });
				setData(data);
			}
		}
	};
	return (
		<div className="">
			<div className="flex  w-full items-center justify-center ">
				<div className="flex flex-col items-center gap-4 w-full">
					<div className="mb-6 flex w-full flex-col gap-2">
						<h1 className="text-2xl font-semibold tracking-tight">
							{isSignup ? t("Create your account") : t("Set up the server")}
						</h1>
						<p className="text-sm text-muted-foreground">
							{isSignup
								? t("Enter your email and password to create an account")
								: t("Create the owner account for this server")}
						</p>
					</div>
					<div className="mx-auto w-full max-w-lg bg-transparent">
						{isError && (
							<div className="my-2 flex flex-row items-center gap-2 rounded-lg bg-red-50 p-2 dark:bg-red-950">
								<AlertTriangle className="text-red-600 dark:text-red-400" />
								<span className="text-sm text-red-600 dark:text-red-400">
									{error}
								</span>
							</div>
						)}
						{isCloud && data && (
							<AlertBlock type="success" className="my-2">
								<span>
									Registered successfully, please check your inbox or spam
									folder to confirm your account.
								</span>
							</AlertBlock>
						)}
						<CardContent className="p-0">
							<SocialSignIn providers={socialProviders ?? []} />
							<Form {...form}>
								<form
									method="post"
									onSubmit={form.handleSubmit(onSubmit)}
									className="grid gap-4"
								>
									<div className="space-y-4">
										<FormField
											control={form.control}
											name="name"
											render={({ field }) => (
												<FormItem>
													<FormLabel>{t("First Name")}</FormLabel>
													<FormControl>
														<Input placeholder="John" {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="lastName"
											render={({ field }) => (
												<FormItem>
													<FormLabel>{t("Last Name")}</FormLabel>
													<FormControl>
														<Input placeholder="Doe" {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="email"
											render={({ field }) => (
												<FormItem>
													<FormLabel>{t("Email")}</FormLabel>
													<FormControl>
														<Input placeholder="you@example.com" {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="password"
											render={({ field }) => (
												<FormItem>
													<FormLabel>{t("Password")}</FormLabel>
													<FormControl>
														<Input
															type="password"
															placeholder={t("Password")}
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="confirmPassword"
											render={({ field }) => (
												<FormItem>
													<FormLabel>{t("Confirm Password")}</FormLabel>
													<FormControl>
														<Input
															type="password"
															placeholder={t("Password")}
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<Button
											type="submit"
											isLoading={form.formState.isSubmitting}
											className="w-full"
										>
											{t("Register")}
										</Button>
									</div>
								</form>
							</Form>
							<div className="flex flex-row justify-between flex-wrap">
								{isSignup && (
									<div className="mt-4 text-center text-sm flex gap-2 text-muted-foreground">
										{t("Already have an account?")}
										<Link className="underline" href="/">
											{t("Sign in")}
										</Link>
									</div>
								)}

								<div className="mt-4 text-center text-sm flex flex-row justify-center gap-2  text-muted-foreground">
									{t("Need help?")}
									<Link
										className="underline"
										href="https://github.com/Aayushajs/LaunchForge-OS"
										target="_blank"
									>
										{t("Contact us")}
									</Link>
								</div>
							</div>
						</CardContent>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Register;

Register.getLayout = (page: ReactElement) => {
	return <OnboardingLayout>{page}</OnboardingLayout>;
};
export async function getServerSideProps(context: GetServerSidePropsContext) {
	const helpers = generateServerSideHelper(appRouter, context);

	if (IS_CLOUD) {
		const { user } = await validateRequest(context.req);

		if (user) {
			return {
				redirect: {
					permanent: false,
					destination: "/dashboard/home",
				},
			};
		}
		return {
			props: {
				trpcState: helpers.dehydrate(),
				isCloud: true,
				socialProviders: enabledSocialProviders(),
			},
		};
	}
	const hasAdmin = await isAdminPresent();

	if (hasAdmin && !(await isPublicSignupEnabled())) {
		return {
			redirect: {
				permanent: false,
				destination: "/",
			},
		};
	}
	return {
		props: {
			trpcState: helpers.dehydrate(),
			isCloud: false,
			socialProviders: enabledSocialProviders(),
			publicSignup: hasAdmin,
		},
	};
}
