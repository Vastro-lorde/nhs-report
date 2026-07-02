/* ──────────────────────────────────────────
   Reusable Privacy Policy content
   Shared between the public /privacy-policy page
   and the onboarding acceptance modal.
   NOTE: Placeholder / dummy copy — replace with
   the final legal text before going live.
   ────────────────────────────────────────── */
import { APP_NAME } from "@/lib/constants";

export function PrivacyPolicyContent() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-gray-700">
      <p className="text-xs text-gray-400">Last updated: 1 January 2026</p>

      <p>
        This Privacy Policy is a placeholder. It explains, in draft form, how{" "}
        {APP_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
        collects, uses, and protects your personal information. The final text
        will be provided by our legal team before launch.
      </p>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          1. Information We Collect
        </h3>
        <p>
          We may collect information you provide directly to us, such as your
          name, email address, phone number, professional details, and any
          reports or documents you submit through the platform.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          2. How We Use Your Information
        </h3>
        <p>
          We use the information we collect to operate, maintain, and improve
          the platform, to communicate with you, and to support the mentorship
          and reporting activities of the fellowship programme.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          3. Data Sharing
        </h3>
        <p>
          We do not sell your personal information. We may share it with
          authorised programme coordinators, mentors, and administrators strictly
          as needed to deliver the services described here.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          4. Data Security
        </h3>
        <p>
          We apply reasonable technical and organisational measures to protect
          your information. However, no method of transmission or storage is
          completely secure.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          5. Your Rights
        </h3>
        <p>
          You may request access to, correction of, or deletion of your personal
          information by contacting the programme administrators.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">6. Contact</h3>
        <p>
          If you have questions about this Privacy Policy, please contact the
          programme administrators. This is placeholder content and does not
          constitute legal advice.
        </p>
      </section>
    </div>
  );
}
