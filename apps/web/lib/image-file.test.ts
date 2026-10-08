// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { fileToDataUrl } from "@/lib/image-file";

describe("import d’images", () => {
  it("accepte une petite image", async () => {
    const file = new File(["<svg></svg>"], "plat.svg", {
      type: "image/svg+xml",
    });
    await expect(fileToDataUrl(file)).resolves.toMatch(
      /^data:image\/svg\+xml;base64,/,
    );
  });

  it("rejette les fichiers non image et ceux de plus de 25 Mo", async () => {
    await expect(
      fileToDataUrl(new File(["texte"], "note.txt", { type: "text/plain" })),
    ).rejects.toThrow("doit être une image");
    await expect(
      fileToDataUrl(
        new File([new Uint8Array(25 * 1024 * 1024 + 1)], "trop-grand.png", {
          type: "image/png",
        }),
      ),
    ).rejects.toThrow("2 Mo");
  });
});
