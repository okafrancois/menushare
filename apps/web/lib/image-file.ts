import { MAX_IMAGE_BYTES } from "@/lib/menu-domain";

export async function fileToDataUrl(file: File) {
  if (!file.type.startsWith("image/"))
    throw new Error("Le fichier doit être une image.");
  if (file.size <= MAX_IMAGE_BYTES) return await readFile(file);
  if (
    file.size > 25 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  ) {
    throw new Error(
      "Utilisez une photo JPEG, PNG ou WebP de moins de 25 Mo, ou une image de moins de 2 Mo.",
    );
  }
  const url = URL.createObjectURL(file);
  try {
    const photo = new Image();
    await new Promise<void>((resolve, reject) => {
      photo.onload = () => resolve();
      photo.onerror = () =>
        reject(
          new Error(
            "Photo illisible. Exportez-la en JPEG ou choisissez une image de moins de 2 Mo.",
          ),
        );
      photo.src = url;
    });
    const canvas = document.createElement("canvas");
    const ratio = Math.min(
      1,
      1600 / Math.max(photo.naturalWidth, photo.naturalHeight),
    );
    canvas.width = Math.max(1, Math.round(photo.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(photo.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Impossible de préparer cette photo sur cet appareil.");
    context.drawImage(photo, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.5]) {
      const result = canvas.toDataURL("image/webp", quality);
      if ((result.split(",")[1]?.length ?? Infinity) * 0.75 <= MAX_IMAGE_BYTES)
        return result;
    }
    throw new Error(
      "Photo trop détaillée. Choisissez une image de moins de 2 Mo.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire l’image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
