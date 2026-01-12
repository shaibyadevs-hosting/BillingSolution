"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

export default function SignupPage() {
	const router = useRouter();

	// Signup page - redirect to secret admin page for admin creation
	useEffect(() => {
		router.push("/admin/ckejwngw242r1/login");
	}, [router]);

	return (
		<div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
			<Card className="w-full max-w-md">
				<CardContent className="pt-6">
					<p className="text-center text-muted-foreground">
						Redirecting to admin panel...
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
