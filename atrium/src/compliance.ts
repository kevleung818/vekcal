/** Rules that keep Atrium a publishing venue, not a clinic or a referral desk. */

export const DISCLAIMER =
  "This content is general educational information, does not constitute medical advice, and does not replace professional diagnosis.";

export const COMPANY = "Atrium Health Information Limited";

export const MAINTENANCE_FEE_HKD = 480;
export const SUBSCRIPTION_HKD = 128;
export const VOUCHER_HKD = 68;

export interface TextRule {
  id: string;
  message: string;
}

export interface QuestionVerdict {
  ok: boolean;
  reason: string;
}

const professionalRules: { id: string; pattern: RegExp; message: string }[] = [
  {
    id: "individual-advice",
    pattern:
      /\b(in your case|your (condition|rash|mole|symptoms|dose)|suitable for you|right for you|you should (take|use|start|stop|undergo|book|inject)|i recommend you|i would prescribe)\b/i,
    message:
      "This speaks to one person's care. On Atrium, stay with general principles. Suitability is decided at the clinic.",
  },
  {
    id: "solicitation",
    pattern:
      /\b(\d+\s*%\s*off|discount|limited[-\s]?time|promo(?:tion| code)|book now|special offer|free consultation|complimentary (treatment|consultation)|優惠|折扣|限時)\b/i,
    message:
      "Discounts, limited-time offers, and booking incentives are not allowed. They pull clinical judgment into a sale.",
  },
  {
    id: "guarantee",
    pattern:
      /\b(guaranteed?|guarantee[ds]?|100\s*%|miracle|permanent results?|no side effects|risk[-\s]?free|cures?|curing)\b/i,
    message: "Do not promise effects or a risk-free result.",
  },
  {
    id: "testimonial",
    pattern:
      /\b(before[-\s]?and[-\s]?after|testimonial|patient (said|told me|results)|real (patients|results)|客戶對比|真實案例)\b/i,
    message:
      "Do not use patient testimonials or before-and-after comparisons to promote a practice.",
  },
  {
    id: "confirm-patient",
    pattern:
      /\b((yes|yeah),?\s+(she|he|they)\s+(is|was)\s+my patient|that photo is (real|genuine|hers|his)|i (did|performed|treated)\b.{0,40}\b(on (her|him|them)|that patient))\b/i,
    message:
      "Do not confirm, deny, or describe another person's care. Decline on privacy grounds.",
  },
  {
    id: "brand-endorsement",
    pattern: /\b(kiln(\s+skin)?|northline(\s+pantry)?)\b/i,
    message:
      "Named brand products stay in the commercial layer. Professional content cannot endorse them.",
  },
  {
    id: "fee-link",
    pattern:
      /\b(referral fee|commission|revenue share|split (the|my) fee|per[-\s]?booking charge|pay per patient)\b/i,
    message:
      "Fees and recognition cannot be tied to patients, bookings, or consultation income.",
  },
];

export function reviewProfessionalText(text: string): TextRule[] {
  const value = text.trim();
  if (!value) {
    return [{ id: "empty", message: "Write the educational point before publishing." }];
  }
  return professionalRules
    .filter((rule) => rule.pattern.test(value))
    .map((rule) => ({ id: rule.id, message: rule.message }));
}

const personalCase: { pattern: RegExp; reason: string }[] = [
  {
    pattern:
      /\b(diagnos(e|is|ing)|prescri(be|ption|bing)|what (medicine|medication|drug|dose|dosage)|how many mg|mg\/kg)\b/i,
    reason:
      "Atrium cannot take diagnosis, prescription, or dosing questions. Those belong with a clinician who can examine the person.",
  },
  {
    pattern:
      /\b(my|i have|i've got|i am|i'm|me)\b.{0,48}\b(rash|mole|lesion|pain|symptom|cancer|tumou?r|infection|allergy|acne|melasma|eczema|dose|pregnant|bleeding)\b/i,
    reason:
      "This describes a personal situation. Atrium only carries general education, not a reading of someone's symptoms.",
  },
  {
    pattern:
      /\b(should i|can i|do i need to|is it safe for me to)\b.{0,40}\b(take|use|start|stop|inject|undergo|book|try)\b/i,
    reason:
      "Whether you should start, stop, or undergo something is an individual clinical question. Ask it at a clinic, not here.",
  },
  {
    pattern: /\b(is this|is my)\b.{0,24}\b(cancer|infected|normal for me|safe for me)\b/i,
    reason: "Atrium cannot say what a personal finding means. A clinician needs to see it.",
  },
  {
    pattern: /\bmy (child|baby|son|daughter|kid|mother|father|husband|wife)\b/i,
    reason:
      "Questions about a specific person, including a family member, are outside this venue.",
  },
];

export function classifyQuestion(text: string): QuestionVerdict {
  const value = text.trim();
  if (value.length < 12) {
    return { ok: false, reason: "Ask a complete general question so the answer can stay educational." };
  }
  for (const rule of personalCase) {
    if (rule.pattern.test(value)) return { ok: false, reason: rule.reason };
  }
  return {
    ok: true,
    reason: "This can be answered as general education. It is still not a diagnosis.",
  };
}

export interface RedeemItem {
  id: string;
  name: string;
  cost: number;
  kind: "allowed" | "charity";
  detail: string;
}

export const REDEMPTIONS: RedeemItem[] = [
  {
    id: "badge",
    name: "Community badge",
    cost: 4,
    kind: "allowed",
    detail: "A non-transferable title beside educational contributions. It does not rank anyone in search.",
  },
  {
    id: "format",
    name: "Formatting tools",
    cost: 6,
    kind: "allowed",
    detail: "Editor tools for articles. No effect on directory order.",
  },
  {
    id: "notebook",
    name: "Venue notebook",
    cost: 8,
    kind: "allowed",
    detail: "Merchandise. It has no clinical use and cannot be exchanged for cash.",
  },
  {
    id: "quota",
    name: "Extra article slot",
    cost: 5,
    kind: "allowed",
    detail: "One more educational article. Not an exposure boost.",
  },
  {
    id: "charity",
    name: "Donate 4 honorary points",
    cost: 4,
    kind: "charity",
    detail:
      "Harbour Community Health Fund (sample organisation). Points are not returned as cash and do not buy exposure.",
  },
];

export interface ProhibitedItem {
  id: string;
  name: string;
  reason: string;
}

export const PROHIBITED_REDEMPTIONS: ProhibitedItem[] = [
  {
    id: "consult-voucher",
    name: "Consultation discount voucher",
    reason: "It would lower the cost of reaching a clinician through this venue.",
  },
  {
    id: "treatment-cash",
    name: "Treatment cash voucher",
    reason: "It is tied to treatment spend.",
  },
  {
    id: "booking-fee",
    name: "Booking-system fee credit",
    reason: "The booking redirect is not a reward. Its upkeep is a fixed technical fee, if charged at all.",
  },
  {
    id: "priority",
    name: "Booking priority",
    reason: "Priority would be a solicitation advantage.",
  },
  {
    id: "weighting",
    name: "Exposure weighting",
    reason: "Directory order cannot be bought with points or tips.",
  },
  {
    id: "stories",
    name: "Patient-story placement",
    reason: "Patient testimonials are not a promotional slot.",
  },
];

export function quoteRedeem(
  id: string,
  balance: number,
  already: readonly string[],
): { ok: true; item: RedeemItem } | { ok: false; reason: string } {
  if (PROHIBITED_REDEMPTIONS.some((item) => item.id === id)) {
    const item = PROHIBITED_REDEMPTIONS.find((entry) => entry.id === id)!;
    return { ok: false, reason: item.reason };
  }
  const item = REDEMPTIONS.find((entry) => entry.id === id);
  if (!item) return { ok: false, reason: "That reward is not offered." };
  if (item.kind !== "charity" && already.includes(item.id)) {
    return { ok: false, reason: "This reward can be redeemed once. Points are not transferable." };
  }
  if (balance < item.cost) {
    return { ok: false, reason: "Not enough honorary points. Points cannot be bought with consultation income." };
  }
  return { ok: true, item };
}

/** Production would open this URL on the clinic's own system. The demo never navigates. */
export function isSafeClinicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

export const PRIVACY_REPLY =
  "I cannot confirm or comment on anyone else's consultation. That is patient privacy. On this venue I can only discuss the topic in general. Whether a procedure suits a particular person is decided in clinic, after history and examination, and not on this page. Personal stories online are not a measure of a typical result.";

export const RED_LINES = [
  "Atrium does not provide medical advice, join the consultation, or handle the consultation fee.",
  "There is no employment, partnership, agency, or referral-fee relationship with a licensed professional.",
  "Nothing paid to a professional is calculated from patient volume, bookings, or fees. Nothing they pay Atrium is a referral fee.",
  "Booking opens the clinic's own system. Atrium does not charge by booking or by the fee charged there.",
  "Professionals do not offer discounts, urgency, or other inducements to book.",
  "Professionals do not request, reward, forward, or display patient testimonials.",
  "Honorary points are non-cash and non-transferable. They are not linked to bookings, fees, or patient numbers.",
  "Points cannot buy booking access, fee discounts, treatment vouchers, priority, exposure, or testimonial slots.",
  "Brand placements are labelled and kept off the professional layer. Endorsing a brand is not a condition of joining.",
] as const;
