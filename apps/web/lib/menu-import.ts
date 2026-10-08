import { parsePriceToCents, type MenuState } from "./menu-domain";
import { csvCell } from "./download";
export type ImportRow = {
  category: string;
  name: string;
  priceCents: number;
  description: string;
};

function cells(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = first.includes(";") ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted)
    throw new Error("Un guillemet n’est pas fermé dans le fichier CSV.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}
export function parseMenuCsv(text: string): ImportRow[] {
  if (text.length > 1_000_000)
    throw new Error("Le fichier doit faire moins de 1 Mo.");
  const [header, ...rows] = cells(text.replace(/^\uFEFF/, ""));
  const normalized = header?.map((value) =>
    value
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
  );
  const indices = ["categorie", "nom", "prix", "description"].map(
    (key) => normalized?.indexOf(key) ?? -1,
  );
  if (indices.slice(0, 3).some((index) => index < 0))
    throw new Error(
      "Colonnes attendues : categorie, nom, prix, description. Téléchargez le modèle.",
    );
  if (!rows.length || rows.length > 500)
    throw new Error("Importez entre 1 et 500 plats à la fois.");
  return rows.map((row, index) => {
    const get = (n: number) => (row[indices[n]!] ?? "").trim();
    const category = get(0),
      name = get(1),
      description = get(3);
    if (
      !category ||
      !name ||
      category.length > 100 ||
      name.length > 120 ||
      description.length > 1000
    )
      throw new Error(
        `Ligne ${index + 2} : vérifiez la catégorie, le nom et la longueur de la description.`,
      );
    try {
      return {
        category,
        name,
        priceCents: parsePriceToCents(get(2)),
        description,
      };
    } catch {
      throw new Error(
        `Ligne ${index + 2} : le prix doit être un nombre positif ou nul, en euros.`,
      );
    }
  });
}
export function menuCsv(state: MenuState) {
  return (
    "\uFEFF" +
    [
      ["categorie", "nom", "prix", "description"],
      ...state.categories.flatMap((category) =>
        category.items.map((item) => [
          category.name,
          item.name,
          (item.priceCents / 100).toFixed(2),
          item.description,
        ]),
      ),
    ]
      .map((row) => row.map(csvCell).join(";"))
      .join("\r\n")
  );
}
