export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">
        Terms of Service and Code of Conduct
      </h1>
      <p className="mt-2 text-sm text-ink-soft">Placeholder — final copy pending legal review.</p>

      <section className="mt-8 space-y-6 text-ink leading-relaxed">
        <div>
          <h2 className="font-display text-xl text-ink">1. Acceptance</h2>
          <p className="mt-2">
            By creating an EduBoost account you accept these Terms and the Code of Conduct set out below. If
            you do not accept, do not create an account.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl text-ink">2. Eligibility</h2>
          <p className="mt-2">
            You must be at least 18 years old to create an account. Minors may use the platform only through a
            parent or guardian account.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl text-ink">3. Payments</h2>
          <p className="mt-2">
            Payments are processed upfront through the platform. Refunds follow the money-back-guarantee policy
            in your country of residence.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl text-ink">4. Code of Conduct</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Treat all users with respect. Harassment, discrimination, and abuse are grounds for removal.</li>
            <li>Teachers must honor scheduled sessions and deliver the services they advertise.</li>
            <li>Students and parents must participate in good faith and provide honest feedback.</li>
            <li>Do not share personal contact information to circumvent platform payments.</li>
            <li>Do not record sessions without the consent of all participants, beyond the platform&apos;s recording feature.</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-xl text-ink">5. Disputes</h2>
          <p className="mt-2">
            Disputes about sessions, payments, or conduct must be raised through the in-platform dispute system
            before any external action.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl text-ink">6. Data</h2>
          <p className="mt-2">
            We store the information you provide in EU (eu-west-1) and share it only with service providers
            required to deliver the platform (Stripe, Resend, Amazon Web Services).
          </p>
        </div>
      </section>
    </main>
  );
}
