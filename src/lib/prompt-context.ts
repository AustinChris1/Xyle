/**
 * Every prompt that reaches a miner must state the current date.
 *
 * Models answer from their training cutoff otherwise, which produced markets
 * asking about "the end of 2023" and judges writing "as of October 2023" in
 * user-visible reasoning. That bug was fixed three separate times in three
 * separate prompts before this file existed; import from here instead of
 * writing the preamble again.
 */

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentYear(): number {
  return new Date().getUTCFullYear();
}

/** Preamble for any prompt whose answer depends on what "now" means. */
export function datePreamble(): string {
  return `Today is ${today()} (year ${currentYear()}). Your training data ends well before this date. Never present your training cutoff as the present. Reason only from the dated material supplied in this request.`;
}

/**
 * Rejects text that anchors on a year that has already passed. Used to throw
 * out generated market questions like "before the end of 2023".
 */
export function referencesPastYear(text: string): boolean {
  const year = currentYear();
  const matches = text.match(/\b(19|20)\d{2}\b/g);
  if (!matches) return false;
  return matches.some((m) => Number(m) < year);
}
