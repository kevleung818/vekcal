import { useEffect, useState } from "react";
import { COMPANY } from "./compliance";
import { useStore } from "./store";
import type { Role } from "./types";
import { roleLabel } from "./ui";
import { Complaints, Membership, Points, ReviewDesk, Studio, Terms } from "./views/account";
import {
  ArticleView,
  Ask,
  Directory,
  Home,
  Learn,
  ProfileView,
  Sponsors,
} from "./views/public";

type Route =
  | { name: "home" }
  | { name: "learn" }
  | { name: "article"; id: string }
  | { name: "ask" }
  | { name: "directory" }
  | { name: "profile"; id: string }
  | { name: "sponsors" }
  | { name: "membership" }
  | { name: "points" }
  | { name: "terms" }
  | { name: "studio" }
  | { name: "review" }
  | { name: "complaints" };

function parse(hash: string): Route {
  const parts = (hash.replace(/^#/, "") || "/").split("/").filter(Boolean);
  const head = parts[0] ?? "";
  if (!head) return { name: "home" };
  if (head === "learn") return parts[1] ? { name: "article", id: parts[1] } : { name: "learn" };
  if (head === "ask") return { name: "ask" };
  if (head === "directory") return parts[1] ? { name: "profile", id: parts[1] } : { name: "directory" };
  if (head === "sponsors") return { name: "sponsors" };
  if (head === "membership") return { name: "membership" };
  if (head === "points") return { name: "points" };
  if (head === "terms") return { name: "terms" };
  if (head === "studio") return { name: "studio" };
  if (head === "review") return { name: "review" };
  if (head === "complaints") return { name: "complaints" };
  return { name: "home" };
}

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const sync = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return hash;
}

const links = [
  ["#/", "Venue"],
  ["#/learn", "Learn"],
  ["#/ask", "Questions"],
  ["#/directory", "Directory"],
  ["#/sponsors", "Sponsors"],
  ["#/membership", "Membership"],
];

export function App() {
  const hash = useHash();
  const route = parse(hash);
  const { state, setRole, reset } = useStore();
  const commercial = route.name === "sponsors" || (route.name === "studio" && state.role === "brand");

  useEffect(() => {
    document.title = "Atrium — health information venue";
    window.scrollTo(0, 0);
  }, [hash]);

  return (
    <div className={commercial ? "shell is-commercial" : "shell"}>
      <header className="top">
        <div className="frame top-row">
          <a className="mark" href="#/">
            <span>Atrium</span>
            <small>Information venue</small>
          </a>
          <nav aria-label="Primary">
            {links.map(([href, label]) => (
              <a key={href} href={href} aria-current={current(route, href) ? "page" : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <label className="role">
            View as
            <select
              value={state.role}
              onChange={(event) => setRole(event.target.value as Role)}
              aria-label="Demonstration role"
            >
              {(Object.keys(roleLabel) as Role[]).map((role) => (
                <option key={role} value={role}>
                  {roleLabel[role]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="demo-strip">
          Demonstration stored in this browser. The clinicians are fictional. No payment is taken, and no
          consultation fee ever passes through {COMPANY}.
          <button type="button" onClick={reset}>
            Reset demonstration
          </button>
        </p>
      </header>
      <main className="frame">
        {route.name === "home" && <Home />}
        {route.name === "learn" && <Learn />}
        {route.name === "article" && <ArticleView id={route.id} />}
        {route.name === "ask" && <Ask />}
        {route.name === "directory" && <Directory />}
        {route.name === "profile" && <ProfileView id={route.id} />}
        {route.name === "sponsors" && <Sponsors />}
        {route.name === "membership" && <Membership />}
        {route.name === "points" && <Points />}
        {route.name === "terms" && <Terms />}
        {route.name === "studio" && <Studio />}
        {route.name === "review" && <ReviewDesk />}
        {route.name === "complaints" && <Complaints />}
      </main>
      <footer className="foot">
        <div className="frame foot-grid">
          <div>
            <strong>Atrium</strong>
            <p>
              Compliant content and community infrastructure for licensed professionals. Not a referral
              intermediary.
            </p>
          </div>
          <div>
            <a href="#/terms">Participation terms</a>
            <a href="#/points">Honorary points</a>
            <a href="#/complaints">Report a concern</a>
            <a href="#/studio">Studio</a>
            <a href="#/review">Review desk</a>
          </div>
          <p className="disclaimer">
            This content is general educational information, does not constitute medical advice, and does
            not replace professional diagnosis.
          </p>
        </div>
      </footer>
    </div>
  );
}

function current(route: Route, href: string): boolean {
  if (href === "#/") return route.name === "home";
  if (href === "#/learn") return route.name === "learn" || route.name === "article";
  if (href === "#/directory") return route.name === "directory" || route.name === "profile";
  return href === `#/${route.name}`;
}
