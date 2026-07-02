/* ──────────────────────────────────────────
   Reusable Terms of Service content
   Shared between the public /terms page and the
   onboarding acceptance modal.
   NOTE: Placeholder / dummy copy — replace with
   the final legal text before going live.
   ────────────────────────────────────────── */
import { APP_NAME } from "@/lib/constants";

export function TermsContent() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-gray-700">
      <p className="text-xs text-gray-400">Last updated: 1 January 2026</p>

      <p>
        These Terms of Service are a placeholder. By accessing or using{" "}
        {APP_NAME} (the &ldquo;Service&rdquo;), you agree to be bound by these
        draft terms. The final text will be provided by our legal team before
        launch.
      </p>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          1. Acceptance of Terms
        </h3>
        <p>
          By creating an account or using the Service, you confirm that you have
          read, understood, and agree to be bound by these Terms and our Privacy
          Policy.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          2. Use of the Service
        </h3>
        <p>
          You agree to use the Service only for lawful purposes connected to the
          fellowship mentorship and reporting programme, and to keep your account
          credentials confidential.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          3. User Responsibilities
        </h3>
        <p>
          You are responsible for the accuracy of the information and reports you
          submit and for all activity that occurs under your account.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          4. Intellectual Property
        </h3>
        <p>
          All content and materials provided through the Service remain the
          property of the programme and its licensors, except for content you
          submit.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          5. Termination
        </h3>
        <p>
          We may suspend or terminate access to the Service at any time for
          conduct that violates these Terms or is otherwise harmful to the
          programme.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          6. Limitation of Liability
        </h3>
        <p>
          The Service is provided on an &ldquo;as is&rdquo; basis. This is
          placeholder content and does not constitute legal advice.
        </p>
      </section>
    </div>
  );
}
