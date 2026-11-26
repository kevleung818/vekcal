import { useState } from "react";
import {
  COMPANY,
  DISCLAIMER,
  MAINTENANCE_FEE_HKD,
  PRIVACY_REPLY,
  PROHIBITED_REDEMPTIONS,
  REDEMPTIONS,
  RED_LINES,
  SUBSCRIPTION_HKD,
  VOUCHER_HKD,
} from "../compliance";
import { professionals } from "../data";
import { useStore } from "../store";
import type { Placement, Topic } from "../types";
import { LayerBanner, formatWhen } from "../ui";

export function Membership() {
  const { state, subscribe, endSubscription, buyVoucher } = useStore();
  return (
    <div>
      <header className="page-head">
        <h1>Membership</h1>
        <p>
          People pay Atrium for the library. Brands pay Atrium for labelled space. Clinicians do not pay a
          referral fee, and Atrium does not pay them by the patient.
        </p>
      </header>
      <div className="price-grid">
        <section>
          <h2>Monthly reading</h2>
          <p className="price">HKD {SUBSCRIPTION_HKD}</p>
          <p>The professional library, discussion, and general questions. Cancel whenever you like in this demo.</p>
          {state.subscribed ? (
            <button type="button" onClick={endSubscription}>
              End the demonstration membership
            </button>
          ) : (
            <button type="button" className="primary" onClick={subscribe}>
              Start membership
            </button>
          )}
          <p className="fine">No card is charged. This build only records the choice on this browser.</p>
        </section>
        <section>
          <h2>Topic voucher</h2>
          <p className="price">HKD {VOUCHER_HKD}</p>
          <p>
            One educational answer. It is not a consultation, it cannot be spent at a clinic, and it is not
            a discount.
          </p>
          <button type="button" onClick={buyVoucher}>
            Add a voucher ({state.vouchers} held)
          </button>
        </section>
        <section>
          <h2>What Atrium will not sell</h2>
          <ul>
            <li>A share of a consultation fee.</li>
            <li>A charge per booking.</li>
            <li>A listing fee exchanged for patients.</li>
            <li>A doctor’s endorsement bundled into an advertising contract.</li>
          </ul>
        </section>
      </div>
      <p className="fine">
        {state.subscribed ? "Membership is on for this browser." : "Membership is off."} Vouchers held:{" "}
        {state.vouchers}.
      </p>
    </div>
  );
}

export function Points() {
  const { state, professional, redeem } = useStore();
  const [message, setMessage] = useState<string | null>(null);
  const balance = state.balances[professional.id] ?? 0;
  const donated = state.donatedBy[professional.id] ?? 0;

  return (
    <div>
      <header className="page-head">
        <h1>Honorary points</h1>
        <p>
          A point is a reputation mark. It is not cash, it cannot be given to someone else, and it is not
          calculated from bookings or fees. Members award points. Only the professional who received them
          can redeem them.
        </p>
      </header>
      {state.role !== "professional" && (
        <p className="panel">
          You are not viewing as a licensed professional. Switch the demonstration role to redeem. Members
          thank an article from the article itself.
        </p>
      )}
      {state.role === "professional" && (
        <p className="panel">
          Acting as {professional.name}. Balance {balance}. Donated {donated}. A badge{" "}
          {state.badgeBy[professional.id] ? "is on this profile" : "has not been redeemed"}.
        </p>
      )}
      <div className="redeem-grid">
        {REDEMPTIONS.map((item) => (
          <article key={item.id}>
            <h2>{item.name}</h2>
            <p className="price">{item.cost} points</p>
            <p>{item.detail}</p>
            <button
              type="button"
              disabled={state.role !== "professional"}
              onClick={() => {
                const result = redeem(item.id);
                setMessage(result ?? "Recorded. Nothing was converted to cash, and nothing was tied to a booking.");
              }}
            >
              {item.kind === "charity" ? "Donate" : "Redeem"}
            </button>
          </article>
        ))}
      </div>
      {message && (
        <p role="status" className="fine">
          {message}
        </p>
      )}
      <h2>Not offered</h2>
      <ul className="blocked">
        {PROHIBITED_REDEMPTIONS.map((item) => (
          <li key={item.id}>
            <strong>{item.name}</strong>
            <span>{item.reason}</span>
          </li>
        ))}
      </ul>
      <h2>Ledger</h2>
      <ul className="ledger">
        {state.ledger.map((entry) => (
          <li key={entry.id}>
            <span>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</span>
            <p>
              {entry.label}
              <small>{formatWhen(entry.createdAt)}</small>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const clauses: { title: string; body: string }[] = [
  {
    title: "1 · Definitions",
    body: `${COMPANY} operates the venue. A licensed professional is a doctor, registered dietitian, or other professional the venue has accepted. Professional content is educational writing and general answers. Consultation services happen at the professional’s own premises.`,
  },
  {
    title: "2 · Role of the venue",
    body: "Atrium provides the technical place to publish, discuss, and list a profile. It does not give medical advice, join the consultation, or handle the fee. There is no employment, partnership, agency, or referral-remuneration relationship.",
  },
  {
    title: "3 · Duties of the professional",
    body: "Content stays general. On the venue they do not induce a booking with a discount or a convenience offer, promise an effect, use patient stories or before-and-after pictures, or breach their code. Qualifications are stated accurately. Atrium’s acceptance is not a certificate of compliance.",
  },
  {
    title: "4 · Booking",
    body: "A timetable may be shown only as a redirect into the clinic’s own system. Atrium does not handle the fee and does not charge by booking volume or by the amount charged in clinic.",
  },
  {
    title: "5 · Fees",
    body: `Publishing in the professional layer is free. Advanced profile tools may carry a fixed maintenance fee of HKD ${MAINTENANCE_FEE_HKD}, defined as a technical charge, unrelated to referrals. Member subscriptions and brand fees are not a share of consultation income. This figure is in the draft for a solicitor to test against a disguised referral fee.`,
  },
  {
    title: "6 · Review and the line on every page",
    body: `Atrium may edit or remove content. Beside professional content: “${DISCLAIMER}” The professional is responsible for accuracy. The venue undertakes a reasonable review, not a guarantee.`,
  },
  {
    title: "7 · Advertising kept apart",
    body: "Brand material is labelled and placed in its own section. Professionals do not endorse a brand inside professional content, and declare conflicts. The venue cannot require an endorsement as the price of joining.",
  },
  {
    title: "8 · Complaints and ending participation",
    body: "Anyone can report misleading promotion. The venue handles reports in a reasonable time and may suspend or end participation. Rights already accrued survive the ending.",
  },
  {
    title: "9 · Liability and insurance",
    body: "The professional maintains professional indemnity insurance. The venue maintains its own liability cover. Claims from a professional’s content or from conduct in clinic are the professional’s. The venue answers for its own operation.",
  },
  {
    title: "10 · Law",
    body: "The draft is written for the law of Hong Kong, including the Medical Council’s Code of Professional Conduct and the Trade Descriptions Ordinance, and it is not adopted until a solicitor has reviewed it.",
  },
  {
    title: "11 · Patient stories",
    body: "Professionals do not request, induce, or reward testimonials or comparison photos, and they do not forward or display them. They do not confirm or deny another person’s care. They decline, on privacy grounds, and return the conversation to the person in front of them — in clinic, not as advice on this venue.",
  },
  {
    title: "12 · Honorary points",
    body: "Points and badges are non-cash, non-transferable recognition. They are not wages, commission, or a function of patient volume. They cannot be swapped for a consultation discount, a treatment voucher, booking priority, exposure, a testimonial slot, or the booking system. Donation to a recognised charity is voluntary, is not paid back as cash, and buys no promotional advantage.",
  },
];

export function Terms() {
  return (
    <div className="terms">
      <header className="page-head">
        <h1>Participation terms</h1>
        <p>Draft for legal review. Not a signed agreement. Company name in this build: {COMPANY}.</p>
      </header>
      {clauses.map((clause) => (
        <section key={clause.title}>
          <h2>{clause.title}</h2>
          <p>{clause.body}</p>
        </section>
      ))}
      <h2>Red lines</h2>
      <ol className="red-lines">
        {RED_LINES.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
    </div>
  );
}

export function Studio() {
  const { state, professional, setActingProfessional, submitArticle, submitPlacement, enableAdvanced } =
    useStore();
  const [message, setMessage] = useState<string | null>(null);
  const [article, setArticle] = useState({
    title: "",
    excerpt: "",
    body: "",
    topic: "Everyday care" as Topic,
    conflictNote: "No brand relationship declared.",
  });
  const [placement, setPlacement] = useState({
    brand: "",
    kind: "Advertisement" as Placement["kind"],
    title: "",
    body: "",
  });

  if (state.role === "brand") {
    return (
      <div>
        <LayerBanner
          kicker="Layer 4 · Brand desk"
          text="A submission can only become a labelled placement. It cannot be attached to a clinician."
          tone="commercial"
        />
        <h1>Brand desk</h1>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            const result = submitPlacement(placement);
            setMessage(result ?? "Sent to the commercial review queue. It is not public yet.");
            if (!result) setPlacement({ brand: "", kind: "Advertisement", title: "", body: "" });
          }}
        >
          <label>
            Brand
            <input
              value={placement.brand}
              onChange={(event) => setPlacement({ ...placement, brand: event.target.value })}
              required
            />
          </label>
          <label>
            Kind
            <select
              value={placement.kind}
              onChange={(event) =>
                setPlacement({ ...placement, kind: event.target.value as Placement["kind"] })
              }
            >
              <option>Advertisement</option>
              <option>Sponsored</option>
              <option>Listing</option>
            </select>
          </label>
          <label>
            Title
            <input
              value={placement.title}
              onChange={(event) => setPlacement({ ...placement, title: event.target.value })}
              required
            />
          </label>
          <label>
            Copy
            <textarea
              rows={5}
              value={placement.body}
              onChange={(event) => setPlacement({ ...placement, body: event.target.value })}
              required
            />
          </label>
          <button className="primary" type="submit">
            Send to review
          </button>
        </form>
        {message && (
          <p role="alert" className="alert">
            {message}
          </p>
        )}
        {!message && state.placements.some((item) => item.status === "pending") && (
          <p className="fine">Pending placements wait in the review desk. They are not on the public sponsor page yet.</p>
        )}
      </div>
    );
  }

  if (state.role !== "professional") {
    return (
      <div>
        <h1>Studio</h1>
        <p>Switch the demonstration role to a licensed professional, or to a brand, to use this desk.</p>
      </div>
    );
  }

  const mine = state.articles.filter((item) => item.authorId === professional.id);

  return (
    <div>
      <LayerBanner
        kicker="Professional studio"
        text="Publishing here is free. The text is checked against solicitation, testimonials, brand names, and individual advice before it can even reach review."
      />
      <header className="page-head">
        <h1>Studio</h1>
        <p>Acting as a sample professional. Nothing you publish is medical advice, and nothing here pays by the patient.</p>
      </header>
      <label>
        Acting as
        <select
          value={professional.id}
          onChange={(event) => setActingProfessional(event.target.value)}
        >
          {professionals.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>
      <section className="panel">
        <h2>Advanced profile tools</h2>
        <p>
          Fixed maintenance of HKD {MAINTENANCE_FEE_HKD} a month for the redirect display and reading
          counts. The draft terms call this a technical fee. It does not change with bookings, and this
          demonstration does not collect it. Reading counts are not patient counts, and booking clicks are
          not shown because they must not become a billing input.
        </p>
        {state.advancedOn ? (
          <p>Tools marked on for {professional.name} in this browser. Article reads stay on each article.</p>
        ) : (
          <button type="button" onClick={enableAdvanced}>
            Mark the fixed-fee tools as requested
          </button>
        )}
      </section>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const result = submitArticle(article);
          setMessage(result ?? "Sent for review. It stays off the library until the desk publishes it.");
          if (!result) {
            setArticle({
              title: "",
              excerpt: "",
              body: "",
              topic: "Everyday care",
              conflictNote: "No brand relationship declared.",
            });
          }
        }}
      >
        <h2>New educational article</h2>
        <label>
          Title
          <input value={article.title} onChange={(event) => setArticle({ ...article, title: event.target.value })} required />
        </label>
        <label>
          Excerpt
          <input
            value={article.excerpt}
            onChange={(event) => setArticle({ ...article, excerpt: event.target.value })}
            required
          />
        </label>
        <label>
          Topic
          <select
            value={article.topic}
            onChange={(event) => setArticle({ ...article, topic: event.target.value as Topic })}
          >
            <option>Skin</option>
            <option>Nutrition</option>
            <option>Everyday care</option>
            <option>How care works</option>
          </select>
        </label>
        <label>
          Body
          <textarea
            rows={8}
            value={article.body}
            onChange={(event) => setArticle({ ...article, body: event.target.value })}
            required
          />
        </label>
        <label>
          Conflict of interest
          <input
            value={article.conflictNote}
            onChange={(event) => setArticle({ ...article, conflictNote: event.target.value })}
            required
          />
        </label>
        <button type="button" onClick={() => setArticle({ ...article, body: PRIVACY_REPLY })}>
          Insert the privacy reply
        </button>
        <button type="submit" className="primary">
          Submit for review
        </button>
      </form>
      {message && (
        <p role="alert" className="alert">
          {message}
        </p>
      )}
      <h2>Your drafts and articles</h2>
      <ul className="index">
        {mine.map((item) => (
          <li key={item.id}>
            <span>{item.status}</span>
            <strong>{item.title}</strong>
            {item.reviewNote && <p>{item.reviewNote}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReviewDesk() {
  const { state, reviewArticle, reviewPlacement, handleReport } = useStore();
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (state.role !== "reviewer") {
    return (
      <div>
        <h1>Review desk</h1>
        <p>Switch the demonstration role to content reviewer. The desk is not a public page.</p>
      </div>
    );
  }
  const pendingArticles = state.articles.filter((item) => item.status === "pending");
  const pendingAds = state.placements.filter((item) => item.status === "pending");

  return (
    <div>
      <header className="page-head">
        <h1>Review desk</h1>
        <p>
          A reviewer can keep a piece off the library. Approval is not a medical endorsement and not a
          promise that the author is compliant with their council.
        </p>
      </header>
      <h2>Articles waiting</h2>
      <ul className="index">
        {pendingArticles.length === 0 && <li>Nothing waiting.</li>}
        {pendingArticles.map((article) => (
          <li key={article.id}>
            <strong>{article.title}</strong>
            <p>{article.body}</p>
            <label>
              Note
              <input
                value={notes[article.id] ?? ""}
                onChange={(event) => setNotes({ ...notes, [article.id]: event.target.value })}
              />
            </label>
            <div className="row">
              <button type="button" className="primary" onClick={() => reviewArticle(article.id, "published", notes[article.id] ?? "")}>
                Publish
              </button>
              <button type="button" onClick={() => reviewArticle(article.id, "rejected", notes[article.id] || "Does not stay educational.")}>
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
      <h2>Placements waiting</h2>
      <ul className="index">
        {pendingAds.length === 0 && <li>Nothing waiting.</li>}
        {pendingAds.map((ad) => (
          <li key={ad.id}>
            <span>
              {ad.kind} · {ad.brand}
            </span>
            <strong>{ad.title}</strong>
            <p>{ad.body}</p>
            <div className="row">
              <button type="button" className="primary" onClick={() => reviewPlacement(ad.id, "live")}>
                Place in the commercial layer
              </button>
              <button type="button" onClick={() => reviewPlacement(ad.id, "rejected")}>
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
      <h2>Reports</h2>
      <ul className="index">
        {state.reports.length === 0 && <li>No reports yet.</li>}
        {state.reports.map((report) => (
          <li key={report.id}>
            <span>{report.status}</span>
            <strong>{report.target}</strong>
            <p>{report.detail}</p>
            <small>{formatWhen(report.createdAt)}</small>
            {report.status === "open" && (
              <button type="button" onClick={() => handleReport(report.id)}>
                Mark handled
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Complaints() {
  const { fileReport } = useStore();
  const [target, setTarget] = useState("");
  const [detail, setDetail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div>
      <header className="page-head">
        <h1>Report a concern</h1>
        <p>
          Use this for promotion that does not belong, a testimonial being used as advertising, or a piece
          that has slipped into personal medical advice. The reviewer marks it handled. This demonstration
          stores the report in the browser only.
        </p>
      </header>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          fileReport(target, detail);
          setSent(true);
          setTarget("");
          setDetail("");
        }}
      >
        <label>
          Where it appeared
          <input value={target} onChange={(event) => setTarget(event.target.value)} required maxLength={160} />
        </label>
        <label>
          What is wrong
          <textarea value={detail} onChange={(event) => setDetail(event.target.value)} required rows={5} maxLength={800} />
        </label>
        <button type="submit" className="primary">
          Send report
        </button>
      </form>
      {sent && <p role="status">Received. A reviewer can see it on the review desk.</p>}
    </div>
  );
}
