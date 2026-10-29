import { SHOP } from "./format";

/**
 * Research Use Agreement shown at checkout.
 * When you change the wording, bump WAIVER_VERSION so each order records
 * exactly which version the customer signed.
 */
export const WAIVER_VERSION = "2026-10-29";
export const WAIVER_TITLE = "Research Use Agreement and Release of Liability";

const state = process.env.NEXT_PUBLIC_SHOP_STATE || "Idaho";

export const WAIVER_INTRO = `This agreement is between you (the "Buyer") and ${SHOP.name} (the "Seller"). Please read it carefully. By signing below and by taking possession of any product, you agree to every term in this agreement.`;

export const WAIVER_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "Research use only",
    body: "All products are sold strictly for laboratory and in-vitro research purposes. They are not drugs, foods, dietary supplements, or cosmetics, and they have not been evaluated or approved by the U.S. Food and Drug Administration. Products are not intended to diagnose, treat, cure, or prevent any disease, and are not for human or animal consumption, injection, application, or any other use in or on the body.",
  },
  {
    heading: "Buyer eligibility",
    body: "You confirm that you are at least 21 years of age, that you are purchasing for lawful research purposes only, and that you have the training and knowledge to handle research materials safely.",
  },
  {
    heading: "No medical advice",
    body: "The Seller does not provide medical advice, dosing guidance, or instructions for use. Nothing on this website, on any label, or said by the Seller or its staff is medical advice. Consult a licensed healthcare professional for any health question.",
  },
  {
    heading: "Handling, storage and compliance",
    body: "You are solely responsible for the safe handling, storage, use, and disposal of all products, and for complying with all federal, state, and local laws and regulations that apply to your purchase, possession, and research.",
  },
  {
    heading: "No resale or redistribution",
    body: "You will not resell, give, or otherwise provide any product to another person for human or animal use, or represent any product as fit for such use.",
  },
  {
    heading: "Assumption of risk",
    body: "You understand that research materials may carry known and unknown risks. You knowingly and voluntarily assume all risks arising from the purchase, possession, handling, storage, use, or misuse of any product.",
  },
  {
    heading: "Release of liability",
    body: `To the fullest extent permitted by law, you release, waive, and discharge the Seller and its owners, employees, and agents from any and all claims, demands, losses, damages, and liabilities of any kind, including personal injury, illness, or death, arising from or related to any product or your use or misuse of it.`,
  },
  {
    heading: "Indemnification",
    body: "You agree to defend, indemnify, and hold harmless the Seller and its owners, employees, and agents from any claim, loss, liability, or expense, including reasonable attorney fees, arising from your breach of this agreement or your use, misuse, or distribution of any product.",
  },
  {
    heading: "Disclaimer of warranties and limit of liability",
    body: "Products are provided as is, without warranty of any kind, express or implied, including any warranty of merchantability or fitness for a particular purpose. The Seller's total liability for any claim is limited to the amount you paid for the product involved.",
  },
  {
    heading: "Orders and pickup",
    body: "Submitting an order is a request only. The Seller may decline or cancel any order for any reason. Payment is due in cash at pickup. Taking possession of your order confirms that you have read, understood, and accepted this agreement as it applies to every product in that order.",
  },
  {
    heading: "Electronic signature",
    body: "Typing your full legal name below is your electronic signature and has the same legal effect as a handwritten signature. You agree that this agreement may be signed and kept in electronic form.",
  },
  {
    heading: "General terms",
    body: `This agreement is governed by the laws of the State of ${state}. If any part of it is found unenforceable, the remaining parts stay in full effect. This is the entire agreement between you and the Seller on its subject and replaces any prior statements.`,
  },
];
