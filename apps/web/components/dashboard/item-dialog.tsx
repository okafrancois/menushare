"use client";

import { ImagePlus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { fileToDataUrl } from "@/lib/image-file";
import {
  createItem,
  parsePriceToCents,
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
  const [error, setError] = useState("");
  const currentItem = item
    ? state.categories
        .find((category) => category.id === categoryId)
        ?.items.find((candidate) => candidate.id === item.id)
    : undefined;
  const currentImages = currentItem?.images ?? item?.images ?? [];

  function save() {
    try {
      if (!name.trim()) throw new Error("Le nom est obligatoire.");
      if (item) {
        updateItem(categoryId, item.id, {
          name: name.trim(),
          description: description.trim(),
          priceCents: parsePriceToCents(price),
          video: videoUrl.trim()
            ? normalizeExternalVideoUrl(videoUrl)
            : undefined,
        });
      } else {
        addItem(
          categoryId,
          createItem({
            id: `item-${crypto.randomUUID()}`,
            name,
            description,
            price,
            videoUrl,
          }),
        );
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
            <label htmlFor="item-description">Description</label>
            <textarea
              className="input textarea"
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
        </div>
        {item ? (
          <div className="media-editor">
            <strong>Galerie d’images</strong>
            <div className="image-grid">
              {currentImages.map((image) => (
                <div className="image-tile" key={image.id}>
                  <img src={image.dataUrl} alt={image.alt} />
                  <button
                    type="button"
                    aria-label={`Supprimer ${image.alt}`}
                    onClick={() =>
                      removeItemImage(categoryId, item.id, image.id)
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <label className="image-upload">
                <ImagePlus />
                <span>Ajouter</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      addItemImage(categoryId, item.id, {
                        id: `image-${crypto.randomUUID()}`,
                        dataUrl: await fileToDataUrl(file),
                        alt: file.name,
                      });
                      setError("");
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Image invalide.",
                      );
                    }
                  }}
                />
              </label>
            </div>
            <small className="muted">
              2 Mo maximum par image. En production, elles seront stockées dans
              Convex.
            </small>
          </div>
        ) : (
          <p className="form-note left">
            Enregistrez d’abord le plat pour ajouter sa galerie d’images.
          </p>
        )}
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
          >
            Enregistrer
          </button>
        </div>
      </section>
    </div>
  );
}
