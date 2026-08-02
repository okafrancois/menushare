import { MAX_IMAGE_BYTES } from "@/lib/menu-domain";

export async function fileToDataUrl(file: File) {
  if (!file.type.startsWith("image/"))
    throw new Error("Le fichier doit être une image.");
  if (file.size > MAX_IMAGE_BYTES)
    throw new Error("L’image ne doit pas dépasser 2 Mo.");
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire l’image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
