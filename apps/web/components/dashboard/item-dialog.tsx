"use client";

import { ImagePlus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { fileToDataUrl } from "@/lib/image-file";
import {
  createItem,
  parsePriceToCents,
  type MenuImage,
  type MenuItem,
} from "@/lib/menu-domain";
import { useMenuStore } from "@/lib/menu-store";
import { normalizeExternalVideoUrl } from "@repo/backend/video";

export function ItemDialog({
  categoryId,
  item,
  onClose,
}: {
  categoryId: string;
  item?: MenuItem;
  onClose: () => void;
}) {
  const { state, addItem, updateItem, addItemImage, removeItemImage } =
    useMenuStore();
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [details, setDetails] = useState(item?.details ?? "");
  const [price, setPrice] = useState(
    item ? String(item.priceCents / 100).replace(".", ",") : "",
  );
  const [videoUrl, setVideoUrl] = useState(
    item?.video
      ? item.video.provider === "youtube"
        ? `https://youtu.be/${item.video.externalId}`
        : `https://vimeo.com/${item.video.externalId}`
      : "",
  );
  const [ingredients, setIngredients] = useState(
    item?.ingredients.join("\n") ?? "",
  );
  const [pairingName, setPairingName] = useState(item?.pairingName ?? "");
  const [pairingPrice, setPairingPrice] = useState(
    item?.pairingPriceCents === undefined
      ? ""
      : String(item.pairingPriceCents / 100).replace(".", ","),
  );
  const [reviewRating, setReviewRating] = useState(
    item?.reviewRating === undefined ? "" : String(item.reviewRating),
  );
  const [reviewCount, setReviewCount] = useState(
    item?.reviewCount === undefined ? "" : String(item.reviewCount),
  );
  const [reviewQuote, setReviewQuote] = useState(item?.reviewQuote ?? "");
  const [reviewAuthor, setReviewAuthor] = useState(item?.reviewAuthor ?? "");
  const [pendingImages, setPendingImages] = useState<MenuImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const currentItem = item
    ? state.categories
        .find((category) => category.id === categoryId)
        ?.items.find((candidate) => candidate.id === item.id)
    : undefined;
  const currentImages = currentItem?.images ?? item?.images ?? [];

  async function save() {
    try {
      if (!name.trim()) throw new Error("Le nom est obligatoire.");
      setSaving(true);
      const parsedRating = reviewRating.trim()
        ? Number(reviewRating.replace(",", "."))
        : undefined;
      const parsedReviewCount = reviewCount.trim()
        ? Number(reviewCount)
        : undefined;
      if (
        parsedRating !== undefined &&
        (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 5)
      ) {
        throw new Error("La note doit être comprise entre 0 et 5.");
      }
      if (
        parsedReviewCount !== undefined &&
        (!Number.isInteger(parsedReviewCount) || parsedReviewCount < 0)
      ) {
        throw new Error("Le nombre d’avis est invalide.");
      }
      const parsedIngredients = ingredients
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);
      const shared = {
        name: name.trim(),
        description: description.trim(),
        details: details.trim(),
        priceCents: parsePriceToCents(price),
        video: videoUrl.trim()
          ? normalizeExternalVideoUrl(videoUrl)
          : undefined,
        ingredients: parsedIngredients,
        pairingName: pairingName.trim(),
        pairingPriceCents: pairingPrice.trim()
          ? parsePriceToCents(pairingPrice)
          : undefined,
        reviewRating: parsedRating,
        reviewCount: parsedReviewCount,
        reviewQuote: reviewQuote.trim(),
        reviewAuthor: reviewAuthor.trim(),
      };
      let itemId: string;
      if (item) {
        await updateItem(categoryId, item.id, shared);
        itemId = item.id;
      } else {
        itemId = await addItem(
          categoryId,
          createItem({
            id: `item-${crypto.randomUUID()}`,
            name,
            description,
            details,
            price,
            videoUrl,
            ingredients: parsedIngredients,
            pairingName,
            pairingPrice,
            reviewRating: parsedRating,
            reviewCount: parsedReviewCount,
            reviewQuote,
            reviewAuthor,
          }),
        );
      }
      for (const image of pendingImages) {
        await addItemImage(categoryId, itemId, image);
      }
      onClose();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Impossible d’enregistrer.";
      setError(
        message === "INVALID_PRICE"
          ? "Le prix est invalide."
          : message === "INVALID_VIDEO_URL" ||
              message === "UNSUPPORTED_VIDEO_PROVIDER"
            ? "Utilisez une URL YouTube ou Vimeo valide."
            : message,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-dialog-title"
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">
              {item ? "Modification" : "Nouveau plat"}
            </span>
            <h2 className="serif" id="item-dialog-title">
              {item ? item.name : "Ajouter un plat"}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="form-grid">
          <div className="form-group span-2">
            <label htmlFor="item-name">Nom du plat</label>
            <input
              className="input"
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group span-2">
            <label htmlFor="item-description">Description courte</label>
            <textarea
              className="input textarea"
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-group span-2">
            <label htmlFor="item-details">
              Description complète de la fiche
            </label>
            <textarea
              className="input textarea"
              id="item-details"
              placeholder="L’histoire du plat, sa préparation, ses saveurs…"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="item-price">Prix (€)</label>
            <input
              className="input"
              id="item-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="item-video">Vidéo YouTube ou Vimeo</label>
            <input
              className="input"
              id="item-video"
              type="url"
              placeholder="https://youtu.be/..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>
          <div className="form-group span-2">
            <label htmlFor="item-ingredients">Ingrédients</label>
            <textarea
              className="input textarea"
              id="item-ingredients"
              placeholder={
                "Un ingrédient par ligne\nBurrata des Pouilles\nBasilic frais"
              }
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="item-pairing">Accord ou accompagnement</label>
            <input
              className="input"
              id="item-pairing"
              placeholder="Verre de Vermentino"
              value={pairingName}
              onChange={(e) => setPairingName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="item-pairing-price">Prix de l’accord (€)</label>
            <input
              className="input"
              id="item-pairing-price"
              inputMode="decimal"
              value={pairingPrice}
              onChange={(e) => setPairingPrice(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="item-review-rating">Note client (sur 5)</label>
            <input
              className="input"
              id="item-review-rating"
              inputMode="decimal"
              placeholder="4,9"
              value={reviewRating}
              onChange={(e) => setReviewRating(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="item-review-count">Nombre d’avis</label>
            <input
              className="input"
              id="item-review-count"
              inputMode="numeric"
              placeholder="148"
              value={reviewCount}
              onChange={(e) => setReviewCount(e.target.value)}
            />
          </div>
          <div className="form-group span-2">
            <label htmlFor="item-review-quote">Avis mis en avant</label>
            <textarea
              className="input textarea"
              id="item-review-quote"
              value={reviewQuote}
              onChange={(e) => setReviewQuote(e.target.value)}
            />
          </div>
          <div className="form-group span-2">
            <label htmlFor="item-review-author">Auteur de l’avis</label>
            <input
              className="input"
              id="item-review-author"
              placeholder="Chiara F."
              value={reviewAuthor}
              onChange={(e) => setReviewAuthor(e.target.value)}
            />
          </div>
        </div>
        <div className="media-editor">
          <div>
            <strong>Galerie du plat</strong>
            <p className="form-note left">
              Jusqu’à 8 images, 2 Mo maximum par image.
            </p>
          </div>
          <div className="image-grid">
            {currentImages.map((image) => (
              <div className="image-tile" key={image.id}>
                <img src={image.dataUrl} alt={image.alt} />
                <button
                  type="button"
                  aria-label={`Supprimer ${image.alt}`}
                  onClick={() =>
                    item && removeItemImage(categoryId, item.id, image.id)
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {pendingImages.map((image) => (
              <div className="image-tile pending" key={image.id}>
                <img src={image.dataUrl} alt={image.alt} />
                <span>À enregistrer</span>
                <button
                  type="button"
                  aria-label={`Retirer ${image.alt}`}
                  onClick={() =>
                    setPendingImages((images) =>
                      images.filter((candidate) => candidate.id !== image.id),
                    )
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <label className="image-upload">
              <ImagePlus />
              <span>Ajouter des images</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (event) => {
                  const input = event.currentTarget;
                  const files = Array.from(event.target.files ?? []);
                  if (!files.length) return;
                  try {
                    if (
                      currentImages.length +
                        pendingImages.length +
                        files.length >
                      8
                    ) {
                      throw new Error("La galerie est limitée à 8 images.");
                    }
                    const images = await Promise.all(
                      files.map(async (file) => ({
                        id: `image-${crypto.randomUUID()}`,
                        dataUrl: await fileToDataUrl(file),
                        alt: file.name,
                      })),
                    );
                    setPendingImages((current) => [...current, ...images]);
                    setError("");
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Image invalide.",
                    );
                  }
                  input.value = "";
                }}
              />
            </label>
          </div>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button className="button" type="button" onClick={onClose}>
            Annuler
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </section>
    </div>
  );
}
