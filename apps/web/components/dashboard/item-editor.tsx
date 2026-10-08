"use client";

import { ALLERGENS, DISH_TAGS } from "@repo/backend/menu";
import { normalizeExternalVideoUrl } from "@repo/backend/video";
import { Camera, ImagePlus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  errorMessage,
  ProSheet,
  Switch,
  useToast,
} from "@/components/dashboard/ui";
import { fileToDataUrl } from "@/lib/image-file";
import {
  createItem,
  parsePriceToCents,
  priceToInput,
  videoToUrl,
  type AllergenKey,
  type DishTagKey,
  type MenuImage,
  type MenuItem,
} from "@/lib/menu-domain";
import { useMenuStore } from "@/lib/menu-store";

const MAX_IMAGES = 8;
const SHORT_MAX = 140;

function toggle<T>(list: T[], value: T) {
  return list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value];
}

export function ItemEditor({
  categoryId: initialCategoryId,
  item,
  onClose,
}: {
  categoryId: string;
  item?: MenuItem;
  onClose: () => void;
}) {
  const {
    state,
    addItem,
    updateItem,
    deleteItem,
    addItemImage,
    removeItemImage,
  } = useMenuStore();
  const toast = useToast();
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(priceToInput(item?.priceCents));
  const [description, setDescription] = useState(item?.description ?? "");
  const [details, setDetails] = useState(item?.details ?? "");
  const [videoUrl, setVideoUrl] = useState(
    item?.video ? videoToUrl(item.video) : "",
  );
  const [available, setAvailable] = useState(item?.available ?? true);
  const [allergens, setAllergens] = useState<AllergenKey[] | undefined>(
    item?.allergens,
  );
  const [tags, setTags] = useState<DishTagKey[]>(item?.tags ?? []);
  const [ingredients, setIngredients] = useState(
    item?.ingredients.join("\n") ?? "",
  );
  const [pairingName, setPairingName] = useState(item?.pairingName ?? "");
  const [pairingPrice, setPairingPrice] = useState(
    priceToInput(item?.pairingPriceCents),
  );
  const [reviewRating, setReviewRating] = useState(
    item?.reviewRating === undefined
      ? ""
      : String(item.reviewRating).replace(".", ","),
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
        .find((category) => category.id === initialCategoryId)
        ?.items.find((candidate) => candidate.id === item.id)
    : undefined;
  const images = currentItem?.images ?? item?.images ?? [];
  const hasDetails = Boolean(
    item?.details ||
      item?.ingredients.length ||
      item?.pairingName ||
      item?.reviewQuote ||
      item?.reviewRating !== undefined,
  );

  async function addFiles(files: File[]) {
    if (!files.length) return;
    try {
      if (images.length + pendingImages.length + files.length > MAX_IMAGES)
        throw new Error(`La galerie est limitée à ${MAX_IMAGES} images.`);
      const next = await Promise.all(
        files.map(async (file) => ({
          id: `image-${crypto.randomUUID()}`,
          dataUrl: await fileToDataUrl(file),
          alt: file.name,
        })),
      );
      setPendingImages((current) => [...current, ...next]);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause, "Image invalide."));
    }
  }

  async function save() {
    setError("");
    try {
      if (!name.trim()) throw new Error("Le nom du plat est obligatoire.");
      const rating = reviewRating.trim()
        ? Number(reviewRating.replace(",", "."))
        : undefined;
      const count = reviewCount.trim() ? Number(reviewCount) : undefined;
      if (rating !== undefined && (!Number.isFinite(rating) || rating < 0 || rating > 5))
        throw new Error("La note doit être comprise entre 0 et 5.");
      if (count !== undefined && (!Number.isInteger(count) || count < 0))
        throw new Error("Le nombre d’avis est invalide.");
      const parsedIngredients = ingredients
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);
      const priceCents = parsePriceToCents(price);
      const video = videoUrl.trim()
        ? normalizeExternalVideoUrl(videoUrl)
        : undefined;
      setSaving(true);
      let itemId: string;
      if (item) {
        await updateItem(initialCategoryId, item.id, {
          name: name.trim(),
          priceCents,
          description: description.trim(),
          details: details.trim(),
          available,
          video,
          allergens,
          tags,
          ingredients: parsedIngredients,
          pairingName: pairingName.trim(),
          pairingPriceCents: pairingPrice.trim()
            ? parsePriceToCents(pairingPrice)
            : undefined,
          reviewRating: rating,
          reviewCount: count,
          reviewQuote: reviewQuote.trim(),
          reviewAuthor: reviewAuthor.trim(),
        });
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
            allergens,
            tags,
            pairingName,
            pairingPrice,
            reviewRating: rating,
            reviewCount: count,
            reviewQuote,
            reviewAuthor,
          }),
        );
      }
      for (const image of pendingImages) {
        await addItemImage(item ? initialCategoryId : categoryId, itemId, image);
      }
      toast(`${name.trim()} enregistré · à publier`);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "Impossible d’enregistrer le plat."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item) return;
    if (!confirm(`Supprimer « ${item.name} » de la carte ?`)) return;
    try {
      await deleteItem(initialCategoryId, item.id);
      toast(`${item.name} supprimé · à publier`);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  const allergenState =
    allergens === undefined
      ? "Non renseignés"
      : allergens.length
        ? `${allergens.length} déclaré${allergens.length > 1 ? "s" : ""}`
        : "Aucun allergène majeur";

  return (
    <ProSheet
      onClose={onClose}
      labelledBy="item-editor-title"
      variant="full"
      className="pro-editor"
    >
      <header className="pro-navbar">
        <button className="pro-nav-btn" type="button" onClick={onClose}>
          Annuler
        </button>
        <h2 id="item-editor-title">{item ? "Modifier le plat" : "Nouveau plat"}</h2>
        <button
          className="pro-nav-btn save"
          type="button"
          onClick={save}
          disabled={saving}
        >
          {saving ? "…" : "Enregistrer"}
        </button>
      </header>

      <div className="pro-sheet-body pro-editor-body">
        <section aria-label="Photos et vidéo">
          <div className="pro-photos">
            {images.map((image, index) => (
              <div className="pro-photo" key={image.id}>
                <img src={image.dataUrl} alt={image.alt} />
                {index === 0 ? <span className="pro-photo-tag">Vignette</span> : null}
                <button
                  type="button"
                  aria-label={`Supprimer ${image.alt}`}
                  onClick={() =>
                    item && removeItemImage(initialCategoryId, item.id, image.id)
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {pendingImages.map((image) => (
              <div className="pro-photo pending" key={image.id}>
                <img src={image.dataUrl} alt={image.alt} />
                <span className="pro-photo-tag">À enregistrer</span>
                <button
                  type="button"
                  aria-label={`Retirer ${image.alt}`}
                  onClick={() =>
                    setPendingImages((current) =>
                      current.filter((candidate) => candidate.id !== image.id),
                    )
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {images.length + pendingImages.length < MAX_IMAGES ? (
              <>
                <label className="pro-photo-add">
                  <Camera size={20} />
                  <span>Prendre une photo</span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      void addFiles(files);
                    }}
                  />
                </label>
                <label className="pro-photo-add">
                  <ImagePlus size={20} />
                  <span>Galerie</span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    multiple
                    data-testid="item-images-input"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      void addFiles(files);
                    }}
                  />
                </label>
              </>
            ) : null}
          </div>
          <p className="pro-hint">
            La première photo sert de vignette. Jusqu’à {MAX_IMAGES} images de 2 Mo.
          </p>
        </section>

        <div className="pro-form">
          <label className="pro-field">
            <span>Nom du plat</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex. Burrata des Pouilles"
              data-autofocus={item ? undefined : true}
            />
          </label>
          <label className="pro-field">
            <span>Prix (€)</span>
            <input
              value={price}
              inputMode="decimal"
              placeholder="0,00"
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>
          {item ? null : (
            <label className="pro-field">
              <span>Catégorie</span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                {state.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="pro-field">
            <span>
              Description courte
              <small>
                {description.length}/{SHORT_MAX}
              </small>
            </span>
            <textarea
              rows={2}
              maxLength={SHORT_MAX}
              value={description}
              placeholder="Ce qu’on lit sur la carte, en une phrase."
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          {item ? (
            <div className="pro-field inline">
              <span>
                Visible sur la carte
                <small>Pour une rupture du soir, utilisez plutôt la disponibilité.</small>
              </span>
              <Switch
                checked={available}
                label="Visible sur la carte"
                onChange={setAvailable}
              />
            </div>
          ) : null}
        </div>

        <h3 className="pro-section-title">
          <ShieldCheck size={17} /> Allergènes
          <span className={`pro-tag ${allergens === undefined ? "warn" : "good"}`}>
            {allergenState}
          </span>
        </h3>
        <p className="pro-hint">
          Information obligatoire. Elle s’affiche sur la fiche du plat et sert au
          filtre « Allergies » de vos clients.
        </p>
        <div className="pro-chips" role="group" aria-label="Allergènes du plat">
          {ALLERGENS.map((allergen) => (
            <button
              key={allergen.key}
              type="button"
              className="pro-chip"
              aria-pressed={allergens?.includes(allergen.key) ?? false}
              onClick={() => setAllergens(toggle(allergens ?? [], allergen.key))}
            >
              {allergen.label}
            </button>
          ))}
          <button
            type="button"
            className="pro-chip none"
            aria-pressed={allergens !== undefined && allergens.length === 0}
            onClick={() => setAllergens([])}
          >
            Aucun des 14
          </button>
        </div>

        <h3 className="pro-section-title">Régime et mise en avant</h3>
        <div className="pro-chips diet" role="group" aria-label="Régime et badges">
          {DISH_TAGS.map((tag) => (
            <button
              key={tag.key}
              type="button"
              className="pro-chip"
              aria-pressed={tags.includes(tag.key)}
              onClick={() => setTags(toggle(tags, tag.key))}
            >
              {tag.label}
            </button>
          ))}
        </div>

        <details className="pro-details" open={hasDetails || undefined}>
          <summary>
            Fiche détaillée <small>facultatif</small>
          </summary>
          <div className="pro-form">
            <label className="pro-field">
              <span>Description complète de la fiche</span>
              <textarea
                rows={4}
                value={details}
                placeholder="L’histoire du plat, sa préparation, ses saveurs…"
                onChange={(event) => setDetails(event.target.value)}
              />
            </label>
            <label className="pro-field">
              <span>Vidéo YouTube ou Vimeo</span>
              <input
                type="url"
                value={videoUrl}
                placeholder="https://youtu.be/…"
                onChange={(event) => setVideoUrl(event.target.value)}
              />
            </label>
            <label className="pro-field">
              <span>Ingrédients</span>
              <textarea
                rows={3}
                value={ingredients}
                placeholder={"Un ingrédient par ligne\nBurrata des Pouilles"}
                onChange={(event) => setIngredients(event.target.value)}
              />
            </label>
            <label className="pro-field">
              <span>Accord ou accompagnement</span>
              <input
                value={pairingName}
                placeholder="Verre de Vermentino"
                onChange={(event) => setPairingName(event.target.value)}
              />
            </label>
            <label className="pro-field">
              <span>Prix de l’accord (€)</span>
              <input
                value={pairingPrice}
                inputMode="decimal"
                onChange={(event) => setPairingPrice(event.target.value)}
              />
            </label>
            <label className="pro-field">
              <span>Note client (sur 5)</span>
              <input
                value={reviewRating}
                inputMode="decimal"
                placeholder="4,9"
                onChange={(event) => setReviewRating(event.target.value)}
              />
            </label>
            <label className="pro-field">
              <span>Nombre d’avis</span>
              <input
                value={reviewCount}
                inputMode="numeric"
                placeholder="148"
                onChange={(event) => setReviewCount(event.target.value)}
              />
            </label>
            <label className="pro-field">
              <span>Avis mis en avant</span>
              <textarea
                rows={2}
                value={reviewQuote}
                onChange={(event) => setReviewQuote(event.target.value)}
              />
            </label>
            <label className="pro-field">
              <span>Auteur de l’avis</span>
              <input
                value={reviewAuthor}
                placeholder="Chiara F."
                onChange={(event) => setReviewAuthor(event.target.value)}
              />
            </label>
          </div>
        </details>

        {error ? (
          <p className="pro-error" role="alert">
            {error}
          </p>
        ) : null}

        {item ? (
          <button className="pro-btn danger block" type="button" onClick={remove}>
            <Trash2 size={16} /> Supprimer ce plat
          </button>
        ) : null}
        <p className="pro-hint center">
          Les modifications sont visibles en salle après publication.
        </p>
      </div>
    </ProSheet>
  );
}
