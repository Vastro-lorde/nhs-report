/* ──────────────────────────────────────────
   Reusable Privacy Policy content
   Shared between the public /privacy-policy page
   and the onboarding acceptance modal.
   ────────────────────────────────────────── */
export function PrivacyPolicyContent() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-gray-700">
      <p className="text-xs text-gray-400">Last updated: July 2, 2026</p>

      <p>
        We respect your privacy and are committed to protecting the personal data
        you share with us. This Privacy Policy outlines our practices regarding
        the collection, storage, processing, and disclosure of information on the
        CWC Research Mentorship Portal.
      </p>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          1. Information We Collect
        </h3>
        <p>
          We collect the minimum amount of personal data necessary to execute our
          programmatic operations:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account Information:</strong> Names, email addresses,
            professional affiliations, and designated zonal assignments (e.g.,
            specific mentorship cohorts).
          </li>
          <li>
            <strong>Activity &amp; Reporting Data:</strong> Progress tracking
            metrics, virtual tutoring logs, data collection templates, and
            performance reports submitted by Fellows and Mentors.
          </li>
          <li>
            <strong>Integration Tokens:</strong> System metadata, OAuth client ID
            parameters, and temporary session tokens required to safely
            communicate with integrated cloud platforms (like Google Drive or
            Google Meet).
          </li>
          <li>
            <strong>Technical Metadata:</strong> IP addresses, browser types, and
            system timestamps collected via server logs to secure platform
            architecture.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          2. How We Use Your Information
        </h3>
        <p>
          Your data is utilized strictly for the functional deployment of the
          program:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            To authenticate user identities and maintain role-based access control
            (RBAC).
          </li>
          <li>
            To generate automated, long-lasting virtual meeting spaces and
            distribute link assets seamlessly into your portal database.
          </li>
          <li>
            To aggregate program performance metrics and build comprehensive zonal
            evaluation reports.
          </li>
          <li>
            To enable features like live caption extraction, video processing, or
            meeting summary generation when integrated with your authorized storage
            directories.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          3. Data Processing &amp; Third-Party Sharing
        </h3>
        <p>
          We do not sell, rent, or trade your personal data. Data is shared only
          with certified subprocessors necessary to deliver the service:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Infrastructure Hosting:</strong> Secure storage and application
            deployment frameworks (such as Vercel and MongoDB).
          </li>
          <li>
            <strong>API Integrations:</strong> Data passed through to Google Cloud
            Services to handle calendar, email, or video processing commands.
          </li>
          <li>
            <strong>Program Compliance:</strong> Aggregated, non-identifying
            metrics may be shared with leadership stakeholders for programmatic
            reporting and audit purposes.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          4. Data Security &amp; Storage
        </h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            All data is encrypted in transit using Transport Layer Security (TLS
            1.2 or higher) and at rest using advanced encryption standards
            (AES-256).
          </li>
          <li>
            Multi-factor authentication (MFA) and strict role-based limits ensure
            that only verified administrative accounts can inspect backend data
            payloads.
          </li>
          <li>
            Data generated during video calls (such as meeting recordings or text
            transcripts) is routed directly into your specific storage container
            (e.g., your designated Google Drive) and is not stored or cached on our
            independent platform servers without explicit instruction.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          5. Your Rights and Deletion Requests
        </h3>
        <p>
          You maintain full ownership and control over your personal data.
          Depending on your jurisdiction, you have the right to:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Inspect, correct, or update your personal identity records.</li>
          <li>Restrict the programmatic processing of your cohort reports.</li>
          <li>
            Request the permanent erasure of your account and all associated
            operational logs from our live relational databases.
          </li>
        </ul>
        <p>
          To exercise these rights, or to submit questions regarding our data
          handling frameworks, please contact our administration support team
          directly at{" "}
          <a
            href="mailto:admin@cwcr.ng"
            className="font-medium text-orange-700 hover:underline"
          >
            admin@cwcr.ng
          </a>
          .
        </p>
      </section>
    </div>
  );
}
