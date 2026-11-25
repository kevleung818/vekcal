import { useState, type FormEvent } from "react";
import { isSafeClinicUrl } from "../compliance";
import { authorName, professionals } from "../data";
import { useStore } from "../store";
import type { Topic } from "../types";
import { Disclaimer, LayerBanner, formatWhen } from "../ui";

const topics: Array<Topic | "All"> = ["All", "Skin", "Nutrition", "Everyday care", "How care works"];

export function Home() {
  return (
    <div className="home">
      <p className="eyebrow">Hong Kong · content and community infrastructure</p>
      <h1>Educate first. You choose. The clinician judges alone.</h1>
      <p className="lede">
        Atrium is a paid information venue for licensed professionals. It is not a clinic, not a
        question-and-answer service for your case, and not a desk that introduces patients for a fee.
      </p>
      <ol className="steps">
        <li>
          <span>01</span>
          <strong>Educate</strong>
          <p>Read how an option works, what it cannot do, and where the evidence stops.</p>
        </li>
        <li>
          <span>02</span>
          <strong>Choose</strong>
          <p>Decide whether to seek care, and whom to see, without a package already on the table.</p>
        </li>
        <li>
          <span>03</span>
          <strong>Independent judgment</strong>
          <p>The consultation happens at the clinic. Atrium is not in the room and does not hold the fee.</p>
        </li>
      </ol>

      <section className="block">
        <h2>Four layers, kept apart</h2>
        <div className="layer-grid">
          <a href="#/learn">
            <span>Layer 1 · Core</span>
            <strong>Professional content</strong>
            <p>Educational articles and general questions. This is what the membership pays for.</p>
          </a>
          <a href="#/learn/sunscreen">
            <span>Layer 2 · Community</span>
            <strong>Discussion</strong>
            <p>Notes under an article. A professional may reply with principles, not a diagnosis.</p>
          </a>
          <a href="#/directory">
            <span>Layer 3 · Directory</span>
            <strong>Profiles and a redirect</strong>
            <p>Registration, focus, and a link into the clinic’s own timetable. No incentive to book.</p>
          </a>
          <a href="#/sponsors">
            <span>Layer 4 · Commercial</span>
            <strong>Labelled advertising</strong>
            <p>Brand space, sponsored copy, and product rows. Never mixed into a clinician’s article.</p>
          </a>
        </div>
      </section>

      <section className="split">
        <div>
          <h2>Against the pre-sold package</h2>
          <p>
            A common salon path sells the course of treatment before anyone qualified has examined the
            person. The clinician’s judgment arrives afterwards, already squeezed by the sale.
          </p>
          <p>
            Atrium reverses that order. The page teaches. The person decides. The clinician, at their
            own premises, accepts or declines the work. There is no employment, partnership, agency, or
            referral-fee relationship behind that door.
          </p>
        </div>
        <div className="panel">
          <h2>Who it is for</h2>
          <ul>
            <li>People who want health information without a disguised advertorial.</li>
            <li>Licensed professionals who need a public voice that does not solicit.</li>
            <li>Brands that will accept a labelled slot, separate from the clinical voice.</li>
          </ul>
        </div>
      </section>
      <p className="fine">
        Sample profiles on this demonstration are fictional. Acceptance by Atrium would not be a promise
        that a real professional is complying with their code. Terms are a draft for a Hong Kong solicitor.
      </p>
    </div>
  );
}

export function Learn() {
  const { state } = useStore();
  const [topic, setTopic] = useState<(typeof topics)[number]>("All");
  const list = state.articles.filter(
    (article) => article.status === "published" && (topic === "All" || article.topic === topic),
  );

  return (
    <div>
      <LayerBanner
        kicker="Layer 1 · Professional content"
        text="Educational and general. No diagnosis, prescription, or treatment plan for a named person."
      />
      <header className="page-head">
        <h1>Learn</h1>
        <p>Articles carry the venue’s credibility. Advertising does not appear in this list.</p>
      </header>
      <div className="filters" role="tablist" aria-label="Topics">
        {topics.map((item) => (
          <button key={item} type="button" aria-pressed={topic === item} onClick={() => setTopic(item)}>
            {item}
          </button>
        ))}
      </div>
      <ul className="index">
        {list.map((article) => (
          <li key={article.id}>
            <a href={`#/learn/${article.id}`}>
              <span>{article.topic}</span>
              <strong>{article.title}</strong>
              <em>{article.excerpt}</em>
              <small>
                {authorName(article.authorId)} · {article.reads.toLocaleString("en-HK")} reads
              </small>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ArticleView({ id }: { id: string }) {
  const { state, canRead, addComment, tipArticle } = useStore();
  const article = state.articles.find((item) => item.id === id);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);

  if (!article || article.status !== "published") {
    return (
      <div>
        <h1>This article is not public</h1>
        <p>Pending and rejected drafts stay with the reviewer. They are not part of the library.</p>
        <a href="#/learn">Back to Learn</a>
      </div>
    );
  }

  const published = article;
  const thread = state.comments.filter((comment) => comment.articleId === published.id);
  const paragraphs = published.body.split("\n\n");
  const visible = canRead ? paragraphs : paragraphs.slice(0, 1);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = addComment(published.id, note);
    setError(result);
    if (!result) setNote("");
  }

  function thank() {
    setThanks(tipArticle(published.id));
  }

  return (
    <article className="article">
      <LayerBanner
        kicker="Layer 1 · Professional content"
        text="Separated from brand placements. A conflict, if any, is declared here — not buried in a caption."
      />
      <p className="eyebrow">{published.topic}</p>
      <h1>{published.title}</h1>
      <p className="byline">
        {authorName(published.authorId)} · {published.conflictNote}
        {state.badgeBy[published.authorId] ? " · Community badge" : ""}
      </p>
      <Disclaimer />
      {visible.map((paragraph) => (
        <p key={paragraph.slice(0, 24)}>{paragraph}</p>
      ))}
      {!canRead && (
        <div className="paywall">
          <h2>The rest of this article is part of the membership</h2>
          <p>
            HKD 128 a month in this demonstration, for the library, the discussion, and general questions.
            The fee is for the venue. It is not a consultation fee, and Atrium does not share it with the
            author as a commission.
          </p>
          <a className="button" href="#/membership">
            See membership
          </a>
        </div>
      )}
      {canRead && (
        <div className="thanks-row">
          <button type="button" onClick={thank}>
            Thank the author with 1 honorary point
          </button>
          <p>
            Non-cash, non-transferable, and not a discount on any clinic fee.
            {state.tipped.includes(published.id) ? " You have thanked this article." : ""}
          </p>
          {thanks && (
            <p role="alert" className="alert">
              {thanks}
            </p>
          )}
        </div>
      )}

      <section className="thread">
        <LayerBanner
          kicker="Layer 2 · Discussion"
          text="A professional reply stays principled. It does not diagnose the person who wrote the note."
        />
        <h2>Discussion</h2>
        <ul>
          {thread.map((comment) => (
            <li key={comment.id}>
              <span>
                {comment.authorLabel} · {formatWhen(comment.createdAt)}
              </span>
              <p>{comment.body}</p>
            </li>
          ))}
        </ul>
        <form onSubmit={submit}>
          <label>
            Add a note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={800} />
          </label>
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <button type="submit" className="primary">
            Publish note
          </button>
        </form>
      </section>
    </article>
  );
}

export function Ask() {
  const { state, askQuestion, answerQuestion } = useStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [answerError, setAnswerError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = askQuestion(title, body);
    setError(result);
    if (!result) {
      setTitle("");
      setBody("");
    }
  }

  return (
    <div>
      <LayerBanner
        kicker="Layer 1 · General questions"
        text="A topic voucher pays for an educational answer. It cannot be redeemed for a diagnosis, a prescription, or a booking."
      />
      <header className="page-head">
        <h1>Questions</h1>
        <p>
          Ask something a stranger could learn from. If the question is about your body, your child, or a
          medicine you might take, it will not be posted.
        </p>
      </header>
      <form className="stack" onSubmit={submit}>
        <label>
          Question
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} required />
        </label>
        <label>
          The general point
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} maxLength={800} required />
        </label>
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary">
          Submit for an educational answer
        </button>
      </form>

      <ul className="index questions">
        {state.questions.map((question) => (
          <li key={question.id}>
            <span>{question.status === "answered" ? "Answered" : "Open"}</span>
            <strong>{question.title}</strong>
            <p>{question.body}</p>
            <small>
              {question.askerLabel} · {formatWhen(question.createdAt)}
            </small>
            {question.status === "answered" && (
              <blockquote>
                <Disclaimer />
                <p>{question.answer}</p>
                <small>{authorName(question.answeredBy)}</small>
              </blockquote>
            )}
            {question.status === "open" && state.role === "professional" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const result = answerQuestion(question.id, drafts[question.id] ?? "");
                  setAnswerError(result);
                }}
              >
                <label>
                  Educational answer
                  <textarea
                    rows={5}
                    value={drafts[question.id] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                  />
                </label>
                <button type="submit" className="primary">
                  Publish answer
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {answerError && (
        <p role="alert" className="alert">
          {answerError}
        </p>
      )}
    </div>
  );
}

export function Directory() {
  const { state } = useStore();
  return (
    <div>
      <LayerBanner
        kicker="Layer 3 · Directory"
        text="A profile is contact information plus a redirect. Order is not for sale. There is no “book now and save”."
        tone="directory"
      />
      <header className="page-head">
        <h1>Directory</h1>
        <p>Fictional professionals, so the shape of a compliant profile can be walked through.</p>
      </header>
      <ul className="index">
        {professionals.map((person) => (
          <li key={person.id}>
            <a href={`#/directory/${person.id}`}>
              <span>{person.field}</span>
              <strong>
                {person.name}
                {state.badgeBy[person.id] ? " · Badge" : ""}
              </strong>
              <em>{person.credential}</em>
              <small>
                {person.district} · {person.clinic}
              </small>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProfileView({ id }: { id: string }) {
  const person = professionals.find((item) => item.id === id);
  const { state } = useStore();
  const [leaving, setLeaving] = useState(false);
  if (!person) {
    return (
      <div>
        <h1>No such profile</h1>
        <a href="#/directory">Back to the directory</a>
      </div>
    );
  }
  const safe = isSafeClinicUrl(person.bookingUrl);
  const advanced = person.advanced || (state.advancedOn && state.actingProfessionalId === person.id);

  return (
    <article>
      <LayerBanner
        kicker="Layer 3 · Profile"
        text="The booking control does not apply a discount and does not pass a fee through Atrium."
        tone="directory"
      />
      <p className="eyebrow">{person.field}</p>
      <h1>{person.name}</h1>
      <p className="byline">
        {person.credential}
        {state.badgeBy[person.id] ? " · Community badge" : ""}
      </p>
      <dl className="facts">
        <div>
          <dt>Registration</dt>
          <dd>{person.registration}</dd>
        </div>
        <div>
          <dt>Practice</dt>
          <dd>
            {person.clinic}, {person.district}
          </dd>
        </div>
        <div>
          <dt>Insurance</dt>
          <dd>A participating professional carries their own professional indemnity insurance.</dd>
        </div>
        <div>
          <dt>Advanced profile</dt>
          <dd>
            {advanced
              ? "Technical extras are on. The fee, when charged, is a fixed maintenance charge for the profile tools — HKD 480 in the draft terms — and is not counted from bookings."
              : "Basic profile. Advanced tools are optional and are not required in order to publish."}
          </dd>
        </div>
      </dl>
      <h2>How this practice thinks</h2>
      <p>{person.philosophy}</p>
      <Disclaimer />
      {safe ? (
        <button type="button" className="primary" onClick={() => setLeaving(true)}>
          Continue to the clinic’s own booking
        </button>
      ) : (
        <p className="alert">This profile has no safe clinic address, so the redirect stays closed.</p>
      )}
      {leaving && (
        <section className="sheet" role="dialog" aria-labelledby="leave-title">
          <p className="eyebrow">Leaving the venue</p>
          <h2 id="leave-title">The timetable belongs to {person.clinic}</h2>
          <p>
            Atrium does not collect, hold, or intercept the consultation fee. Continuing would open the
            clinic’s system. Nothing on this screen is a promotion, a priority pass, or a reason to book
            today.
          </p>
          <p className="url">{person.bookingUrl}</p>
          <p>This demonstration stops here, so the browser never leaves Atrium.</p>
          <button type="button" onClick={() => setLeaving(false)}>
            Stay on Atrium
          </button>
        </section>
      )}
    </article>
  );
}

export function Sponsors() {
  const { state } = useStore();
  const live = state.placements.filter((item) => item.status === "live");
  return (
    <div className="commercial">
      <LayerBanner
        kicker="Layer 4 · Commercial"
        text="Paid placement. Not written by a licensed professional. Not a condition of anyone’s participation."
        tone="commercial"
      />
      <header className="page-head">
        <h1>Sponsors</h1>
        <p>
          Advertising, sponsored notes, and product rows live only on this layer. They do not sit under an
          article and they do not appear on a profile.
        </p>
      </header>
      <ul className="index ads">
        {live.map((item) => (
          <li key={item.id}>
            <span>
              {item.kind} · {item.brand}
            </span>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
