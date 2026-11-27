import { CalendarCheck, CalendarClock, CalendarPlus, History, Info, Landmark, TriangleAlert } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { AGE_BANDS, ageBandIndex, formatUtcDate } from "./report-utils";

function Fact({ icon: Icon, label, className, children }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-line bg-surface-2/40 px-4 py-3.5", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-subtle">
        <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const Value = ({ children }) => <p className="break-words text-[0.9375rem] font-semibold leading-snug text-fg">{children}</p>;
const Missing = ({ children }) => <p className="text-sm text-muted">{children}</p>;

/** Check summaries start with a short headline the box already shows as its title. */
const stripLead = (text) => (text ? text.replace(/^Registration (date unavailable|lookup failed)\.\s*/, "") : "");

/** The age scale shows which band the domain falls in. It says how old, not how trustworthy. */
function AgeScale({ ageDays }) {
  const active = ageBandIndex(ageDays);
  return (
    <div className="mt-3" aria-hidden="true">
      <div className="flex gap-1">
        {AGE_BANDS.map((band, index) => (
          <span
            key={band.id}
            className={cn("h-1.5 flex-1 rounded-full", index === active ? (index < 2 ? "bg-warning" : "bg-primary") : "bg-line")}
          />
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 text-[0.625rem] leading-tight text-subtle">
        {AGE_BANDS.map((band, index) => (
          <span key={band.id} className={cn("flex-1 truncate", index === active ? "font-semibold text-fg" : "")}>
            {band.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Registration facts from the domain registry. Shows only what the registry actually published:
 * a missing value says so, and nothing here is estimated or filled in.
 */
export function DomainIntelligence({ info, domain }) {
  if (!info) return null;

  const registered = formatUtcDate(info.registered);
  const expires = formatUtcDate(info.expires);
  const updated = formatUtcDate(info.updated);
  // A failed lookup (timeout, network, rate limit) is shown differently from data the registry does not publish.
  const failed = info.lookupState === "failed";
  // "Not disclosed" only when the registry answered without that field; a failed lookup is "Unavailable".
  const notShown = failed ? "Unavailable" : "Not disclosed";

  return (
    <Card as="section" aria-labelledby="domain-heading">
      <CardHeader
        title={<span id="domain-heading">Domain intelligence</span>}
        description={info.notApplicable ? undefined : `How long ${domain} has existed and who registered it, from the official domain registry.`}
      />
      <div className="space-y-4 px-5 py-5 sm:px-6">
        {info.notApplicable ? (
          <p className="text-sm leading-relaxed text-muted">
            This address is a raw IP address, not a domain name, so there is no registration record to show.
          </p>
        ) : (
          <>
            {failed ? (
              <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3">
                <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={2} aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-fg">Registry lookup failed</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {stripLead(info.reason) || "The registry could not be queried."} This is a problem with the lookup, not a finding
                    about the site. The domain&apos;s age is unknown, and that is not counted as a sign of safety.
                  </p>
                </div>
              </div>
            ) : !info.hasDate ? (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3">
                <Info className="mt-0.5 size-5 shrink-0 text-muted" strokeWidth={2} aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-fg">Registration date unavailable</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {stripLead(info.reason) || "The registry did not return a registration date."} The domain&apos;s age is unknown, and
                    that is not counted as a sign of safety.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Fact icon={CalendarPlus} label="Registered on" className="lg:col-span-2">
                {registered ? <Value>{registered}</Value> : <Missing>{failed ? "Lookup failed" : "Not published"}</Missing>}
              </Fact>
              <Fact icon={History} label="Domain age" className="lg:col-span-4">
                {info.hasDate && info.ageText ? (
                  <>
                    <Value>{info.ageText}</Value>
                    <AgeScale ageDays={info.ageDays} />
                  </>
                ) : (
                  <Missing>Unavailable</Missing>
                )}
              </Fact>
              <Fact icon={Landmark} label="Registrar" className="lg:col-span-2">
                {info.registrar ? <Value>{info.registrar}</Value> : <Missing>{notShown}</Missing>}
              </Fact>
              <Fact icon={CalendarClock} label="Expires on" className="lg:col-span-2">
                {expires ? <Value>{expires}</Value> : <Missing>{notShown}</Missing>}
              </Fact>
              <Fact icon={CalendarCheck} label="Last updated" className="lg:col-span-2">
                {updated ? <Value>{updated}</Value> : <Missing>{notShown}</Missing>}
              </Fact>
            </div>
            {info.source ? <p className="text-xs text-subtle">Source: RDAP via {info.source}</p> : null}

            <ul className="space-y-1.5 text-[0.8125rem] leading-relaxed text-muted">
              <li className="flex gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span>
                  Domain age is only one signal. A new domain is not automatically unsafe, and an old domain is not automatically
                  trustworthy, because domains can be sold or taken over.
                </span>
              </li>
              {info.privacyProtected ? (
                <li className="flex gap-2">
                  <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>The owner&apos;s details are hidden by privacy protection. This is common and is not treated as a warning sign.</span>
                </li>
              ) : null}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
