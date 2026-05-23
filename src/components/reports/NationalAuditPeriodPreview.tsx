/* ──────────────────────────────────────────
   NationalAuditPeriodPreview
   Renders the official periodic Federal Oversight
   report template.
   ────────────────────────────────────────── */
"use client";

import type { INationalAuditPeriodReport } from "@/types/national-audit";

interface NationalAuditPeriodPreviewProps {
  data: INationalAuditPeriodReport;
}

export default function NationalAuditPeriodPreview({ data }: NationalAuditPeriodPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-blue-50 p-5">
        <h2 className="text-lg font-bold text-blue-900">{data.title}</h2>
        <p className="mt-1 text-sm text-blue-800">
          Reporting Period: <span className="font-medium">{data.reportingPeriod}</span>
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-blue-100 bg-white px-3 py-2">
            <p className="text-xs font-medium uppercase text-gray-500">Total LGAs Monitored</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{data.totalLGAsMonitored}</p>
          </div>
          <div className="rounded-md border border-blue-100 bg-white px-3 py-2">
            <p className="text-xs font-medium uppercase text-gray-500">Total States + FCT</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{data.totalStatesAndFct}</p>
          </div>
          <div className="rounded-md border border-blue-100 bg-white px-3 py-2">
            <p className="text-xs font-medium uppercase text-gray-500">National Fellow Attendance</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{data.nationalFellowAttendance}</p>
          </div>
          <div className="rounded-md border border-blue-100 bg-white px-3 py-2">
            <p className="text-xs font-medium uppercase text-gray-500">National Mentor Engagement</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{data.nationalMentorEngagement}</p>
          </div>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-base font-semibold text-gray-800">
          1. Geopolitical Zone Executive Brief
        </h3>
        <div className="space-y-5">
          {data.geopoliticalZoneExecutiveBriefs.map((zone) => (
            <div key={zone.zoneName} className="rounded-md border bg-white p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-sm font-bold text-blue-700">
                  {zone.zoneName} <span className="text-gray-400">({zone.zoneCode})</span>
                </h4>
                <span className="text-xs font-medium text-gray-500">
                  {zone.stateCount} state entit{zone.stateCount === 1 ? "y" : "ies"}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {zone.stateExecutiveBriefs.map((brief) => (
                  <div key={brief.stateName} className="rounded-md border-l-4 border-blue-200 bg-gray-50 p-3">
                    <h5 className="text-sm font-semibold text-gray-800">{brief.stateName}</h5>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-600">{brief.brief}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-base font-semibold text-gray-800">
          2. The National Leadership Board
        </h3>

        <div className="mb-4">
          <h4 className="mb-2 text-sm font-medium text-gray-700">Top 5 LGAs - The National Gold</h4>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">National Rank</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">LGA</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">State</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Zone</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.nationalLeadershipBoard.topLGAs.map((entry) => (
                  <tr key={`${entry.nationalRank}-${entry.state}-${entry.lgaName}`} className="bg-white">
                    <td className="px-3 py-2 font-semibold text-blue-700">{entry.nationalRank}</td>
                    <td className="px-3 py-2">{entry.lgaName}</td>
                    <td className="px-3 py-2">{entry.state}</td>
                    <td className="px-3 py-2">{entry.zone}</td>
                    <td className="px-3 py-2">{entry.performance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700">Bottom 5 LGAs - Intervention List</h4>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-red-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">National Rank</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">LGA</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">State</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Zone</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Primary Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.nationalLeadershipBoard.bottomLGAs.map((entry) => (
                  <tr key={`${entry.nationalRank}-${entry.state}-${entry.lgaName}`} className="bg-white">
                    <td className="px-3 py-2 font-semibold text-red-600">{entry.nationalRank}</td>
                    <td className="px-3 py-2">{entry.lgaName}</td>
                    <td className="px-3 py-2">{entry.state}</td>
                    <td className="px-3 py-2">{entry.zone}</td>
                    <td className="px-3 py-2">{entry.primaryRisk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-base font-semibold text-gray-800">3. National Operational Insights</h3>
        <div className="space-y-3 rounded-md border bg-white p-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700">Progress of the Nation</h4>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-600">
              {data.nationalOperationalInsights.progressOfTheNation}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700">National Challenges</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-600">
              {data.nationalOperationalInsights.nationalChallenges.map((challenge, index) => (
                <li key={index}>{challenge}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700">National Solutions Proffered</h4>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-600">
              {data.nationalOperationalInsights.nationalSolutionsProffered}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-base font-semibold text-gray-800">
          4. Team Lead&apos;s Strategic Recommendation
        </h3>
        <div className="space-y-3 rounded-md border bg-white p-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700">National Directive</h4>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-600">
              {data.teamLeadStrategicRecommendation.nationalDirective}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700">Team Lead&apos;s Final Word</h4>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-600">
              {data.teamLeadStrategicRecommendation.teamLeadFinalWord}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}