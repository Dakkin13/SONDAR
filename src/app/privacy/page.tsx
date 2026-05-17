import Link from 'next/link'
import MarketingNav from '@/components/ui/MarketingNav'

export const metadata = {
  title: 'Privacy Policy — Sondar',
  description: 'How Sondar collects, uses, and protects your personal data.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2
        className="mb-3 text-[20px] tracking-[0.06em] text-[#F0EFEB]"
        style={{ fontFamily: 'var(--font-bebas)' }}
      >
        {title}
      </h2>
      <div className="space-y-3 text-[13px] leading-relaxed text-[rgba(240,239,235,0.6)]">
        {children}
      </div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main
      className="relative text-[#F0EFEB]"
      style={{ minHeight: '100dvh', zIndex: 1, fontFamily: 'var(--font-dm-sans)' }}
    >
      <MarketingNav alwaysScrolled />

      {/* Ambient orbs */}
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }}>
        <div className="absolute right-0 top-0"
          style={{ width: 600, height: 600, background: 'radial-gradient(circle at 80% 15%, rgba(255,85,0,0.12) 0%, transparent 60%)' }} />
        <div className="absolute bottom-0 left-0"
          style={{ width: 500, height: 500, background: 'radial-gradient(circle at 20% 85%, rgba(91,33,182,0.10) 0%, transparent 60%)' }} />
      </div>

      <div
        className="relative mx-auto max-w-2xl px-5 pb-24"
        style={{ paddingTop: 'calc(80px + env(safe-area-inset-top, 0px))', zIndex: 1 }}
      >
        <div className="mb-8 pt-8">
          <p className="text-[10px] tracking-[0.2em] text-[rgba(240,239,235,0.3)] uppercase mb-2">Legal</p>
          <h1
            className="text-[42px] leading-none tracking-[0.04em] text-[#F0EFEB]"
            style={{ fontFamily: 'var(--font-bebas)' }}
          >
            PRIVACY POLICY
          </h1>
          <p className="mt-2 text-[12px] text-[rgba(240,239,235,0.3)]">Last updated: May 2026</p>
        </div>

        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Section title="Who We Are">
            <p>
              Sondar (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is a musician matchmaking platform that
              connects musicians in cities across Europe. The data controller responsible for your personal data
              is Sondar, reachable at <a href="mailto:hello@sondar.app" className="text-[#FF5C00] hover:underline">hello@sondar.app</a>.
            </p>
          </Section>

          <Section title="What Data We Collect">
            <p>When you create an account and use Sondar, we collect:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li><strong className="text-[rgba(240,239,235,0.8)]">Account data:</strong> Email address and name from Google OAuth.</li>
              <li><strong className="text-[rgba(240,239,235,0.8)]">Profile data:</strong> Display name, profile photo, city, approximate location (coordinates), bio, instruments, genres, musical objectives, experience level, and availability.</li>
              <li><strong className="text-[rgba(240,239,235,0.8)]">Content:</strong> Messages you send to other users, and any additional photos you upload.</li>
              <li><strong className="text-[rgba(240,239,235,0.8)]">Optional links:</strong> Instagram handle and audio links (YouTube / SoundCloud).</li>
              <li><strong className="text-[rgba(240,239,235,0.8)]">Usage data:</strong> Last active timestamp, anonymised page-view analytics via Vercel Analytics (no cookies).</li>
            </ul>
            <p>
              We do not collect payment information. We do not collect precise GPS coordinates — your city
              coordinates are stored with a small random offset to protect your exact address.
            </p>
          </Section>

          <Section title="How We Use Your Data">
            <p>We use your data solely to provide and improve the Sondar service:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Displaying your profile to other musicians on the map and in search results.</li>
              <li>Enabling direct messaging between matched musicians.</li>
              <li>Showing your activity status (&quot;Active today&quot;) to other users.</li>
              <li>Improving the recommendation algorithm and app performance.</li>
            </ul>
            <p>
              We do not sell your data. We do not use your data for advertising profiling.
            </p>
          </Section>

          <Section title="Who We Share Data With">
            <p>Your data is processed by the following sub-processors:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li><strong className="text-[rgba(240,239,235,0.8)]">Supabase</strong> — database and file storage (EU region).</li>
              <li><strong className="text-[rgba(240,239,235,0.8)]">Vercel</strong> — hosting and serverless infrastructure.</li>
              <li><strong className="text-[rgba(240,239,235,0.8)]">Google</strong> — OAuth sign-in only; we receive your name and email from Google.</li>
              <li><strong className="text-[rgba(240,239,235,0.8)]">Mapbox</strong> — map tiles; tile requests are anonymous.</li>
            </ul>
            <p>
              Your profile (name, photo, instruments, bio, city) is visible to all authenticated Sondar users.
              Messages are only visible to the two parties in the conversation.
            </p>
          </Section>

          <Section title="Your Rights (GDPR)">
            <p>
              If you are in the European Economic Area, you have the following rights regarding your personal data:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li><strong className="text-[rgba(240,239,235,0.8)]">Access:</strong> Request a copy of all data we hold about you.</li>
              <li><strong className="text-[rgba(240,239,235,0.8)]">Rectification:</strong> Correct inaccurate data via your Settings page.</li>
              <li><strong className="text-[rgba(240,239,235,0.8)]">Erasure:</strong> Delete your account and all associated data from the Settings page, or by emailing us.</li>
              <li><strong className="text-[rgba(240,239,235,0.8)]">Portability:</strong> Request an export of your data in a machine-readable format.</li>
              <li><strong className="text-[rgba(240,239,235,0.8)]">Objection:</strong> Object to processing for any purpose described above.</li>
            </ul>
            <p>
              To exercise any of these rights, email us at{' '}
              <a href="mailto:hello@sondar.app" className="text-[#FF5C00] hover:underline">hello@sondar.app</a>.
              We will respond within 30 days.
            </p>
          </Section>

          <Section title="Data Retention">
            <p>
              We retain your data for as long as your account is active. When you delete your account, all profile
              data, photos, and messages are permanently deleted within 30 days. Anonymised analytics data
              (page-view counts) has no identifiable information and is retained indefinitely.
            </p>
          </Section>

          <Section title="Cookies & Analytics">
            <p>
              Sondar does not use advertising cookies or tracking pixels. We use Vercel Analytics, which collects
              anonymised, aggregate page-view data without cookies and without storing any personally identifiable
              information. No consent banner is required for this tool under GDPR.
            </p>
          </Section>

          <Section title="Security">
            <p>
              All data is transmitted over HTTPS. Database access is protected by Supabase Row Level Security — your
              profile data can only be read by authenticated users, and your account data can only be modified by you.
              Passwords are never stored; authentication is handled entirely by Google OAuth.
            </p>
          </Section>

          <Section title="Changes to This Policy">
            <p>
              We may update this policy as the service evolves. We will notify users of material changes via the app.
              Continued use of Sondar after changes constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy? Reach us at{' '}
              <a href="mailto:hello@sondar.app" className="text-[#FF5C00] hover:underline">hello@sondar.app</a>.
            </p>
          </Section>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-[12px] text-[rgba(240,239,235,0.3)] transition-colors hover:text-[rgba(240,239,235,0.6)]"
          >
            ← Back to Sondar
          </Link>
        </div>
      </div>
    </main>
  )
}
