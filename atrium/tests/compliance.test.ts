import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRIVACY_REPLY,
  PROHIBITED_REDEMPTIONS,
  classifyQuestion,
  isSafeClinicUrl,
  quoteRedeem,
  reviewProfessionalText,
} from "../src/compliance.ts";

describe("general questions", () => {
  it("accepts a question that does not ask about a person", () => {
    const verdict = classifyQuestion(
      "What does broad spectrum mean on a sunscreen label?\nAsking in general, not about a product I use.",
    );
    assert.equal(verdict.ok, true);
  });

  it("refuses a personal diagnosis", () => {
    const verdict = classifyQuestion("I have a mole that changed colour. Is this cancer?");
    assert.equal(verdict.ok, false);
  });

  it("refuses a dosing question", () => {
    const verdict = classifyQuestion("What dosage of retinoid should I start on my face?");
    assert.equal(verdict.ok, false);
  });

  it("refuses advice about a family member", () => {
    const verdict = classifyQuestion("My child has a rash after swimming. What should we buy?");
    assert.equal(verdict.ok, false);
  });
});

describe("professional text", () => {
  it("allows the privacy reply", () => {
    assert.deepEqual(reviewProfessionalText(PRIVACY_REPLY), []);
  });

  it("blocks a booking discount", () => {
    const issues = reviewProfessionalText("Book this month and take 20% off the consultation.");
    assert.ok(issues.map((issue) => issue.id).includes("solicitation"));
  });

  it("blocks a testimonial and a brand endorsement", () => {
    const issues = reviewProfessionalText(
      "A patient said Kiln Skin cleared her pigment. Here is the before-and-after.",
    );
    const ids = issues.map((issue) => issue.id);
    assert.ok(ids.includes("testimonial"));
    assert.ok(ids.includes("brand-endorsement"));
  });

  it("blocks confirming another patient's care", () => {
    const issues = reviewProfessionalText("Yes, she was my patient and that photo is real.");
    assert.ok(issues.map((issue) => issue.id).includes("confirm-patient"));
  });

  it("blocks individual advice", () => {
    const issues = reviewProfessionalText("In your case you should start this cream tonight.");
    assert.ok(issues.map((issue) => issue.id).includes("individual-advice"));
  });
});

describe("redemption", () => {
  it("refuses every prohibited reward", () => {
    for (const item of PROHIBITED_REDEMPTIONS) {
      const quote = quoteRedeem(item.id, 100, []);
      assert.equal(quote.ok, false);
    }
  });

  it("allows a charity donation more than once", () => {
    assert.equal(quoteRedeem("charity", 8, ["charity"]).ok, true);
  });

  it("allows a badge only once", () => {
    assert.equal(quoteRedeem("badge", 8, []).ok, true);
    assert.equal(quoteRedeem("badge", 8, ["badge"]).ok, false);
  });

  it("refuses a reward the balance cannot cover", () => {
    assert.equal(quoteRedeem("notebook", 3, []).ok, false);
  });
});

describe("clinic redirect", () => {
  it("accepts an https clinic address", () => {
    assert.equal(isSafeClinicUrl("https://clinic.example/harbour-skin"), true);
  });

  it("rejects scriptable and credentialled addresses", () => {
    assert.equal(isSafeClinicUrl("javascript:alert(1)"), false);
    assert.equal(isSafeClinicUrl("https://user:pass@clinic.example/book"), false);
    assert.equal(isSafeClinicUrl("http://clinic.example/book"), false);
  });
});
