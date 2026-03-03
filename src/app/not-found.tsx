import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Search, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-center">
          <div className="h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center">
            <Search className="h-10 w-10 text-blue-600" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            404 - Page Not Found
          </h1>
          <p className="text-gray-500 text-sm">
            We couldn't find the page you were looking for. It might have been moved or removed.
          </p>
        </div>

        <div className="pt-4 flex justify-center">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto bg-green-700 hover:bg-green-800 text-white">
              <Home className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
