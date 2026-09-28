// Normalisation shared by every parser: lower case, no accents, single spaces.
export function normalise(input) {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function words(input) {
  return normalise(input).split(/[^a-zñ0-9]+/).filter(Boolean);
}
