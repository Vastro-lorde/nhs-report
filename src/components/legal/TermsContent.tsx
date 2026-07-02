/* ──────────────────────────────────────────
   Reusable Terms of Service content
   Shared between the public /terms page and the
   onboarding acceptance modal.
   ────────────────────────────────────────── */
export function TermsContent() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-gray-700">
      <p className="text-xs text-gray-400">Last updated: July 2, 2026</p>

      <p>
        Welcome to the CWC Research Mentorship Portal (the &ldquo;Portal&rdquo;).
        By accessing or using our platform, web applications, and integrated
        services, you agree to comply with and be bound by these Terms of Service
        (&ldquo;Terms&rdquo;). Please read them carefully.
      </p>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          1. Acceptance of Terms
        </h3>
        <p>
          The Portal is owned and operated by CWC Research (&ldquo;Company,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). These Terms
          constitute a legally binding agreement between you (&ldquo;User,&rdquo;
          &ldquo;Fellow,&rdquo; &ldquo;Mentor,&rdquo; or
          &ldquo;Administrator&rdquo;) and CWC Research. If you do not agree to
          these Terms, you may not access or use the Portal.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          2. Description of Services
        </h3>
        <p>
          The Portal serves as a capacity-building and strategic mobilization
          platform designed to manage the National Health Fellows Mentorship
          Program. Features include, but are not limited to:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>User registration and profile management.</li>
          <li>Zonal reporting and automated data collection templates.</li>
          <li>
            Integration with third-party communication tools (such as Google Meet
            API) to facilitate virtual tutoring and mentorship sessions.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          3. Account Security &amp; User Conduct
        </h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Eligibility:</strong> You must provide accurate, complete, and
            current information during registration.
          </li>
          <li>
            <strong>Credentials:</strong> You are solely responsible for
            maintaining the confidentiality of your account credentials and single
            sign-on (SSO) authentication states.
          </li>
          <li>
            <strong>Prohibited Use:</strong> You agree not to exploit the platform
            for unauthorized data harvesting, distributed denial-of-service (DDoS)
            attempts, or bypassing API routing configurations. Any attempt to
            reverse-engineer or manipulate the database infrastructure will result
            in immediate termination of access.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          4. Third-Party Integrations &amp; API Usage
        </h3>
        <p>
          The Portal integrates directly with the Google Cloud Platform (GCP) to
          generate communication assets (e.g., Google Meet links).
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Dependency Disclaimer:</strong> Our ability to provide
            automated meeting functionality depends entirely on the availability
            and operation of third-party APIs. CWC Research is not liable for
            service interruptions, changes to API quotas, or authentication
            failures originating from Google Cloud Console architectures.
          </li>
          <li>
            <strong>User Accounts:</strong> To access premium video interactions
            (such as native recording, transcript collection, or polls), users
            must interact with the portal via accounts that possess the
            appropriate licensing or underlying subscription tiers (e.g., Google
            Workspace Individual or Enterprise allocations).
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          5. Intellectual Property
        </h3>
        <p>
          All platform source code, custom relational schemas, interface designs,
          training guides, Standard Operating Procedures (SOPs), and strategic
          frameworks built into the Portal are the exclusive intellectual property
          of CWC Research. Users are granted a limited, revocable,
          non-transferable license to access materials solely for their designated
          participation within the active programmatic framework.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-gray-900">
          6. Limitation of Liability &amp; Disclaimers
        </h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>As-Is Provision:</strong> The platform is provided on an
            &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; basis without
            warranties of any kind.
          </li>
          <li>
            <strong>Data Transmission:</strong> While we employ standard
            cryptographic security, we do not guarantee that third-party streaming
            assets or automated recordings hosted external to our core cloud
            database will remain continuously uninterrupted.
          </li>
          <li>
            <strong>Maximum Liability:</strong> In no event shall CWC Research be
            liable for any indirect, incidental, or consequential damages arising
            from the use or inability to use the Portal.
          </li>
        </ul>
      </section>
    </div>
  );
}
