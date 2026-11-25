import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { classifyQuestion, quoteRedeem, reviewProfessionalText } from "./compliance";
import { articles, authorName, comments, placements, professionals, questions } from "./data";
import type { AppState, Article, Comment, Placement, Question, Report, Role } from "./types";

const STORAGE_KEY = "atrium-demo-v1";

function seed(): AppState {
  return {
    role: "guest",
    actingProfessionalId: "cho",
    subscribed: false,
    vouchers: 0,
    articles: articles.map((article) => ({ ...article })),
    comments: comments.map((comment) => ({ ...comment })),
    questions: questions.map((question) => ({ ...question })),
    placements: placements.map((placement) => ({ ...placement })),
    reports: [],
    ledger: [
      {
        id: "seed",
        label: "Sample honorary balance for Dr Helen Cho. Not cash, not wages, not a referral fee.",
        delta: 12,
        createdAt: "2026-11-01T00:00:00.000Z",
      },
    ],
    tipped: [],
    balances: { cho: 12, leung: 4, shah: 6 },
    redeemedBy: { cho: [], leung: [], shah: [] },
    donatedBy: { cho: 0, leung: 0, shah: 0 },
    badgeBy: { cho: false, leung: false, shah: false },
    advancedOn: false,
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...seed(), ...parsed };
  } catch {
    return seed();
  }
}

interface Store {
  state: AppState;
  professional: (typeof professionals)[number];
  canRead: boolean;
  setRole: (role: Role) => void;
  setActingProfessional: (id: string) => void;
  subscribe: () => void;
  endSubscription: () => void;
  buyVoucher: () => void;
  addComment: (articleId: string, body: string) => string | null;
  askQuestion: (title: string, body: string) => string | null;
  answerQuestion: (id: string, body: string) => string | null;
  tipArticle: (articleId: string) => string | null;
  redeem: (id: string) => string | null;
  submitArticle: (draft: Pick<Article, "title" | "excerpt" | "body" | "topic" | "conflictNote">) => string | null;
  reviewArticle: (id: string, decision: "published" | "rejected", note: string) => void;
  submitPlacement: (draft: Pick<Placement, "brand" | "kind" | "title" | "body">) => string | null;
  reviewPlacement: (id: string, decision: "live" | "rejected") => void;
  fileReport: (target: string, detail: string) => void;
  handleReport: (id: string) => void;
  enableAdvanced: () => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const store = useMemo<Store>(() => {
    const professional =
      professionals.find((person) => person.id === state.actingProfessionalId) ?? professionals[0];
    const canRead = state.role === "member" ? state.subscribed : state.role !== "guest";

    function stamp(label: string, delta: number) {
      return {
        id: crypto.randomUUID(),
        label,
        delta,
        createdAt: new Date().toISOString(),
      };
    }

    return {
      state,
      professional,
      canRead,
      setRole: (role) => setState((current) => ({ ...current, role })),
      setActingProfessional: (id) => setState((current) => ({ ...current, actingProfessionalId: id })),
      subscribe: () => setState((current) => ({ ...current, role: "member", subscribed: true })),
      endSubscription: () => setState((current) => ({ ...current, subscribed: false })),
      buyVoucher: () => setState((current) => ({ ...current, vouchers: current.vouchers + 1 })),
      addComment: (articleId, body) => {
        const text = body.trim();
        if (text.length < 4) return "Write a longer note.";
        if (state.role === "guest" || (state.role === "member" && !state.subscribed)) {
          return "Community notes are part of the membership.";
        }
        if (state.role === "professional" || state.role === "reviewer") {
          const issues = reviewProfessionalText(text);
          if (issues.length) return issues[0].message;
        }
        const comment: Comment = {
          id: crypto.randomUUID(),
          articleId,
          authorLabel:
            state.role === "professional" ? professional.name : state.role === "reviewer" ? "Reviewer" : "Member",
          role: state.role === "professional" ? "professional" : "member",
          professionalId: state.role === "professional" ? professional.id : undefined,
          body: text,
          createdAt: new Date().toISOString(),
        };
        setState((current) => ({ ...current, comments: [...current.comments, comment] }));
        return null;
      },
      askQuestion: (title, body) => {
        const verdict = classifyQuestion(`${title}\n${body}`);
        if (!verdict.ok) return verdict.reason;
        if (state.role !== "member" || !state.subscribed) {
          if (state.vouchers < 1) {
            return "A general question uses the membership, or one topic voucher. This demonstration does not take a consultation fee.";
          }
        }
        const question: Question = {
          id: crypto.randomUUID(),
          title: title.trim(),
          body: body.trim(),
          askerLabel: "You",
          status: "open",
          answer: "",
          answeredBy: "",
          createdAt: new Date().toISOString(),
        };
        setState((current) => ({
          ...current,
          questions: [question, ...current.questions],
          vouchers:
            current.role === "member" && current.subscribed ? current.vouchers : current.vouchers - 1,
        }));
        return null;
      },
      answerQuestion: (id, body) => {
        if (state.role !== "professional") return "Only the acting licensed professional can answer.";
        const issues = reviewProfessionalText(body);
        if (issues.length) return issues.map((issue) => issue.message).join(" ");
        setState((current) => ({
          ...current,
          questions: current.questions.map((question) =>
            question.id === id
              ? { ...question, status: "answered", answer: body.trim(), answeredBy: professional.id }
              : question,
          ),
        }));
        return null;
      },
      tipArticle: (articleId) => {
        if (state.role !== "member" || !state.subscribed) {
          return "Honorary thanks come from a member, and they are not a fee.";
        }
        if (state.tipped.includes(articleId)) return "You have already thanked this article.";
        const article = state.articles.find((item) => item.id === articleId);
        if (!article || article.status !== "published") return "Only a published educational article can be thanked.";
        setState((current) => ({
          ...current,
          tipped: [...current.tipped, articleId],
          balances: {
            ...current.balances,
            [article.authorId]: (current.balances[article.authorId] ?? 0) + 1,
          },
          ledger: [
            stamp(
              `Honorary point for ${authorName(article.authorId)}. Not cash, not transferable, not linked to a booking.`,
              1,
            ),
            ...current.ledger,
          ],
        }));
        return null;
      },
      redeem: (id) => {
        if (state.role !== "professional") {
          return "Only the professional who earned the points can redeem them.";
        }
        const balance = state.balances[professional.id] ?? 0;
        const already = state.redeemedBy[professional.id] ?? [];
        const quote = quoteRedeem(id, balance, already);
        if (!quote.ok) return quote.reason;
        setState((current) => ({
          ...current,
          balances: {
            ...current.balances,
            [professional.id]: (current.balances[professional.id] ?? 0) - quote.item.cost,
          },
          redeemedBy: {
            ...current.redeemedBy,
            [professional.id]:
              quote.item.kind === "charity"
                ? (current.redeemedBy[professional.id] ?? [])
                : [...(current.redeemedBy[professional.id] ?? []), quote.item.id],
          },
          donatedBy: {
            ...current.donatedBy,
            [professional.id]:
              (current.donatedBy[professional.id] ?? 0) + (quote.item.kind === "charity" ? quote.item.cost : 0),
          },
          badgeBy: {
            ...current.badgeBy,
            [professional.id]: quote.item.id === "badge" ? true : current.badgeBy[professional.id],
          },
          ledger: [
            stamp(
              quote.item.kind === "charity"
                ? `${professional.name} donated points to Harbour Community Health Fund. Not returned as cash.`
                : `${professional.name} redeemed ${quote.item.name}.`,
              -quote.item.cost,
            ),
            ...current.ledger,
          ],
        }));
        return null;
      },
      submitArticle: (draft) => {
        if (state.role !== "professional") return "Switch to the professional view to submit.";
        const issues = reviewProfessionalText(`${draft.title}\n${draft.excerpt}\n${draft.body}`);
        if (issues.length) return issues.map((issue) => issue.message).join(" ");
        if (!draft.conflictNote.trim()) return "Declare interests, or state that there are none.";
        const article: Article = {
          id: crypto.randomUUID(),
          ...draft,
          authorId: professional.id,
          status: "pending",
          reviewNote: "",
          reads: 0,
        };
        setState((current) => ({ ...current, articles: [article, ...current.articles] }));
        return null;
      },
      reviewArticle: (id, decision, note) => {
        if (state.role !== "reviewer") return;
        setState((current) => ({
          ...current,
          articles: current.articles.map((article) =>
            article.id === id ? { ...article, status: decision, reviewNote: note.trim() } : article,
          ),
        }));
      },
      submitPlacement: (draft) => {
        if (state.role !== "brand") return "Switch to the brand view to submit a placement.";
        const blob = `${draft.title}\n${draft.body}`;
        if (/\b(doctor recommends|clinically proven to cure|endorsed by)\b/i.test(blob)) {
          return "A placement cannot claim a clinician's endorsement or a cure.";
        }
        const placement: Placement = {
          id: crypto.randomUUID(),
          ...draft,
          status: "pending",
        };
        setState((current) => ({ ...current, placements: [placement, ...current.placements] }));
        return null;
      },
      reviewPlacement: (id, decision) => {
        if (state.role !== "reviewer") return;
        setState((current) => ({
          ...current,
          placements: current.placements.map((placement) =>
            placement.id === id ? { ...placement, status: decision } : placement,
          ),
        }));
      },
      fileReport: (target, detail) => {
        const report: Report = {
          id: crypto.randomUUID(),
          target: target.trim(),
          detail: detail.trim(),
          status: "open",
          createdAt: new Date().toISOString(),
        };
        setState((current) => ({ ...current, reports: [report, ...current.reports] }));
      },
      handleReport: (id) => {
        if (state.role !== "reviewer") return;
        setState((current) => ({
          ...current,
          reports: current.reports.map((report) =>
            report.id === id ? { ...report, status: "handled" } : report,
          ),
        }));
      },
      enableAdvanced: () => setState((current) => ({ ...current, advancedOn: true })),
      reset: () => {
        localStorage.removeItem(STORAGE_KEY);
        setState(seed());
      },
    };
  }, [state]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const value = useContext(Ctx);
  if (!value) throw new Error("Store missing");
  return value;
}
