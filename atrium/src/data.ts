import type { Article, Comment, Placement, Professional, Question } from "./types";

export const professionals: Professional[] = [
  {
    id: "cho",
    name: "Dr Helen Cho",
    credential: "Specialist in Dermatology & Venereology",
    registration: "Sample register entry — not a real Medical Council number",
    field: "Skin",
    philosophy:
      "Explain the mechanism, the limits of a procedure, and what a consultation can and cannot decide. The decision to treat is made in the room, after examination, and never on a sales floor.",
    clinic: "Harbour Skin Practice (sample)",
    district: "Central",
    bookingUrl: "https://clinic.example/harbour-skin",
    advanced: true,
  },
  {
    id: "leung",
    name: "Marcus Leung",
    credential: "Registered Dietitian",
    registration: "Sample register entry — not a real dietitian number",
    field: "Nutrition",
    philosophy:
      "Food advice on a public page should teach people how evidence is weighed. A meal plan for a named person is a consultation, and it does not happen here.",
    clinic: "North Point Nutrition Practice (sample)",
    district: "North Point",
    bookingUrl: "https://clinic.example/leung-nutrition",
    advanced: false,
  },
  {
    id: "shah",
    name: "Dr Priya Shah",
    credential: "Family physician",
    registration: "Sample register entry — not a real Medical Council number",
    field: "Everyday care",
    philosophy:
      "Most online questions are really about how to prepare for a visit. Atrium is for that preparation. The visit itself stays at the clinic.",
    clinic: "Shah Family Practice (sample)",
    district: "Jordan",
    bookingUrl: "https://clinic.example/shah-family",
    advanced: false,
  },
];

export const articles: Article[] = [
  {
    id: "sunscreen",
    title: "How to read a sunscreen label without turning it into a promise",
    excerpt:
      "SPF, broad spectrum, and water resistance describe test conditions. They do not describe how a particular face will age.",
    body: [
      "A sunscreen label is a summary of laboratory conditions, not a forecast for one person's skin. SPF is a measure of how long reddening from ultraviolet B is delayed under a set amount of product, applied in a set way. It says nothing, by itself, about ultraviolet A, and it assumes the amount tested — often more than people use on a morning commute.",
      "“Broad spectrum” means the product has also been assessed for longer-wave ultraviolet A, which contributes to pigment change and to skin ageing. A high SPF number without that coverage is an incomplete description. Water resistance is timed (for example forty or eighty minutes of water exposure in a test), and it ends. Sweat, towels, and a missed patch of skin are outside the number on the bottle.",
      "Filters differ. Mineral filters sit largely on the surface and scatter or absorb light. Organic filters absorb ultraviolet energy in the skin's outer layers. Irritation, sting near the eyes, and the look of the product on deeper skin tones are practical reasons people abandon a bottle — not proof that one filter class is a treatment.",
      "No label can promise that a person will avoid pigment, a skin cancer, or a particular procedure. Those outcomes depend on exposure, skin type, and medical history, which a product page cannot take. People with a changing mole, a history of skin cancer, or a medicine that increases light sensitivity need a clinician, not a higher SPF claim.",
      "On Atrium this article stays in the professional layer. It does not name a brand, and it is not paired with a shop. If a sunscreen company buys space, that placement sits in the commercial layer and is labelled as paid.",
    ].join("\n\n"),
    authorId: "cho",
    topic: "Skin",
    status: "published",
    reviewNote: "",
    conflictNote: "No brand relationship declared.",
    reads: 1284,
  },
  {
    id: "evidence",
    title: "What a supplement claim is actually standing on",
    excerpt:
      "A vitamin, a probiotic, and a “clinical strength” line are not the same kind of statement. The gap is the point.",
    body: [
      "Health-food marketing often borrows the costume of a paper: a percentage, a small study, a white coat. The useful question is narrower. What was measured, in whom, for how long, and against what?",
      "A nutrient deficiency is a defined state. Correcting a measured deficiency can matter. Taking the same nutrient when there is no deficiency is a different claim, and the evidence for feeling “more energetic” is usually weaker than the evidence for correcting the deficiency. The label rarely makes that distinction.",
      "Probiotics are strains, not a single substance. A result for one strain, in antibiotic-associated diarrhoea for example, does not travel to a different strain sold for “immunity”. Colony count at manufacture is not the count that survives the shelf and the stomach.",
      "“Clinically tested” can mean a small comfort study paid for by the seller. It is not, by itself, a licence to treat a disease. In Hong Kong, claims that a food prevents or treats disease run into food and trade-description rules. This page does not assess any named product. Named products, if they appear at all, appear as labelled advertisements elsewhere on Atrium.",
      "A registered dietitian can teach someone how to read that gap. Deciding what a specific person should swallow, especially with medicines, pregnancy, or kidney disease in the picture, is a consultation and is not done in the comments.",
    ].join("\n\n"),
    authorId: "leung",
    topic: "Nutrition",
    status: "published",
    reviewNote: "",
    conflictNote: "No brand relationship declared.",
    reads: 860,
  },
  {
    id: "visit",
    title: "What to sort out before a first clinic visit",
    excerpt:
      "A useful visit starts with a history, not with a package. Here is the general shape of that history.",
    body: [
      "A first visit is a structured conversation plus an examination. The clinician needs the problem in the person's own words, how long it has been present, what has already been tried, medicines and supplements, and what a good outcome would look like. Photos taken in different light, on different days, are a poor substitute for that examination.",
      "It is reasonable to ask what the option is for, what it does not do, what the common and the uncommon harms are, and what happens if one waits. It is also reasonable to ask the fee for the consultation itself before any procedure is discussed. A procedure fee is a separate decision, made after the person has been assessed.",
      "Packages sold before that assessment reverse the order. The person is then fitted to a purchase. Atrium's directory can show a clinician's registration, focus, and a link to the clinic's own booking page. It does not sell the package, hold the fee, or offer a reason to book today rather than after thinking.",
      "Bring a list of questions. Leave with a written plan only if the clinician provides one. Anything on this page is background reading so that the questions are easier to ask — not an answer to them.",
    ].join("\n\n"),
    authorId: "shah",
    topic: "How care works",
    status: "published",
    reviewNote: "",
    conflictNote: "No brand relationship declared.",
    reads: 2104,
  },
  {
    id: "retinoid-pending",
    title: "How topical retinoids are studied, in general",
    excerpt:
      "Trials report averages for dryness, redness, and a photographic scale. They do not decide a regimen for one person.",
    body: [
      "Retinoids are a family of vitamin A–related molecules used on the skin in both cosmetic and medicinal settings. Trials usually follow a defined group for a defined number of weeks and score dryness, redness, and a change in a photographic scale. Those averages do not predict one face.",
      "Irritation is common early on. Pregnancy is a hard boundary for several medicinal retinoids; that fact is why a person who might be pregnant needs individual medical advice, which this article does not give.",
      "This draft names no brand and offers no regimen. It is waiting for review.",
    ].join("\n\n"),
    authorId: "cho",
    topic: "Skin",
    status: "pending",
    reviewNote: "",
    conflictNote: "No brand relationship declared.",
    reads: 0,
  },
];

export const comments: Comment[] = [
  {
    id: "c1",
    articleId: "sunscreen",
    authorLabel: "Member · Wing",
    role: "member",
    body: "Is “reef safe” a regulated term, or a marketing one? Asking generally, not about a bottle I own.",
    createdAt: "2026-11-18T02:10:00.000Z",
  },
  {
    id: "c2",
    articleId: "sunscreen",
    authorLabel: "Dr Helen Cho",
    role: "professional",
    professionalId: "cho",
    body: "In general it is not a single legal standard. Different places restrict different filters. The phrase on a label is a claim to check against the ingredient list, not a measure of how the product will behave on skin.",
    createdAt: "2026-11-18T06:40:00.000Z",
  },
];

export const questions: Question[] = [
  {
    id: "q1",
    title: "What is the difference between a cosmetic claim and a medicine claim?",
    body: "I see the same ingredient described as a cosmetic on one site and as a treatment on another. Generally, what separates those claims?",
    askerLabel: "Member · Ada",
    status: "answered",
    answer:
      "A cosmetic claim is about appearance, cleansing, or perfume. A medicine claim is about preventing or treating disease, or changing a body function in a medicinal way. The same ingredient can sit in both kinds of product; the claim, the dose, and the licence are what change. Which one is appropriate for a person is not decided from the wording alone.",
    answeredBy: "shah",
    createdAt: "2026-11-12T03:00:00.000Z",
  },
  {
    id: "q2",
    title: "What does a dietitian generally mean by “ultra-processed”?",
    body: "The term is used loosely in advertising. What definition is actually in use when professionals discuss it?",
    askerLabel: "Member · Jonah",
    status: "open",
    answer: "",
    answeredBy: "",
    createdAt: "2026-11-24T09:20:00.000Z",
  },
];

export const placements: Placement[] = [
  {
    id: "ad-northline",
    brand: "Northline Pantry",
    kind: "Advertisement",
    title: "Vitamin D drops, 1000 IU — a paid placement",
    body: "Northline Pantry paid for this space. The listing is a product fact sheet: vitamin D3 drops, 1000 IU per serving, for general nutritional use. It is not a medicine, it does not claim to treat disease, and no clinician on Atrium is required to mention it.",
    status: "live",
  },
  {
    id: "sp-kiln",
    brand: "Kiln Skin",
    kind: "Sponsored",
    title: "A moisturiser ingredient list, explained by the brand",
    body: "Kiln Skin paid for this note. It describes glycerin and ceramides in their unscented moisturiser. This is brand copy. It is not an article by a dermatologist and it is not an endorsement.",
    status: "live",
  },
  {
    id: "list-oat",
    brand: "Field & Oat",
    kind: "Listing",
    title: "Ordinary rolled oats",
    body: "A product-database row for a plain food. No health-effect claim is accepted in this listing.",
    status: "live",
  },
  {
    id: "ad-pending",
    brand: "Kiln Skin",
    kind: "Advertisement",
    title: "Pending: night cream placement",
    body: "Submitted by the brand. It must stay in this layer and must not be attached to a professional profile.",
    status: "pending",
  },
];

export function authorName(id: string): string {
  return professionals.find((person) => person.id === id)?.name ?? "Licensed professional";
}
