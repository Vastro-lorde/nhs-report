import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Lock, Home } from "lucide-react";

export default function UnauthorizedPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-center">
                    <div className="h-20 w-20 bg-amber-100 rounded-full flex items-center justify-center">
                        <Lock className="h-10 w-10 text-amber-600" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        401 - Unauthorized Access
                    </h1>
                    <p className="text-gray-500 text-sm">
                        You do not have permission to view this page. Ensure you are logged into the correct account.
                    </p>
                </div>

                <div className="pt-4 flex justify-center">
                    <Link href="/dashboard" className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto bg-orange-700 hover:bg-orange-800 text-white">
                            <Home className="mr-2 h-4 w-4" />
                            Return to Dashboard
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
