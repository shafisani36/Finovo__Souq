/**
 * Finds the signs of common classifieds scams in a chat message, so the other person can be warned
 * before money moves. It never blocks a message: real buyers and sellers sometimes share these things too.
 *
 * payment      asks for a deposit, an advance or a bank transfer, or shares bank details
 * link         contains a web link (fake payment and delivery pages are the most common scam)
 * off_platform pushes the chat to WhatsApp, Telegram or a phone call, where we cannot help
 * code         asks for a verification code
 * meeting      arranges a meet-up (shown as a safety tip, not a warning)
 */
export const RISKS = ['payment', 'link', 'off_platform', 'code', 'meeting']

// Arabic-Indic (٠-٩) and Persian (۰-۹) digits are turned into 0-9 so number patterns match either way
const toLatinDigits = (text) =>
  text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))

const PATTERNS = {
  payment: [
    /\b(deposit|advance payment|pay (?:first|upfront|in advance)|bank transfer|transfer the money|wire|western union|stc ?pay|iban)\b/i,
    /\bSA\d{2}[ ]?(?:\d{4}[ ]?){4}\d{2}\b/i,
    /(عربون|تحويل|حوالة|حواله|دفعة مقدمة|دفع مقدم|ايبان|آيبان|رقم الحساب|اس تي سي باي)/,
  ],
  link: [/\bhttps?:\/\/\S+/i, /\bwww\.\S+/i, /\b[a-z0-9-]+\.(?:com|net|org|sa|link|xyz|top|online|site|shop|info|me|ly)(?:\/\S*)?\b/i],
  off_platform: [
    /\b(whats ?app|wa\.me|telegram|t\.me|signal|snapchat|call me|text me)\b/i,
    /(?:\+?966|\b0)5\d{8}\b/,
    /(واتس|واتساب|وتساب|تلجرام|تيليجرام|كلمني|اتصل علي|سناب)/,
  ],
  code: [/\b(verification code|otp|the code (?:you|we) (?:got|received|sent)|send (?:me )?the code)\b/i, /(رمز التحقق|كود التحقق|ارسل الرمز|أرسل الرمز|الكود اللي وصلك)/],
  meeting: [/\b(meet(?: ?up)?|pick ?up|location|address|come to|where are you)\b/i, /(نتقابل|اقابلك|أقابلك|نلتقي|موقعك|العنوان|استلام|مكانك)/],
}

/** @returns {string[]} the risk codes found, in a fixed order */
export const detectRisks = (text) => {
  if (!text) return []
  const normalized = toLatinDigits(text)
  return RISKS.filter((risk) => PATTERNS[risk].some((pattern) => pattern.test(normalized)))
}
