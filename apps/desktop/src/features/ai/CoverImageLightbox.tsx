import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

type CoverImageLightboxProps = {
  image: {
    src: string;
    alt: string;
  } | null;
  onClose: () => void;
};

export function CoverImageLightbox({ image, onClose }: CoverImageLightboxProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!image) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [image, onClose]);

  if (!image) {
    return null;
  }

  const lightbox = (
    <div className="cover-lightbox" role="dialog" aria-modal="true">
      <button
        type="button"
        className="cover-lightbox-backdrop"
        onClick={onClose}
        aria-label={t("ai.lightbox.close")}
      />
      <div className="cover-lightbox-content">
        <button
          type="button"
          className="icon-button cover-lightbox-close"
          onClick={onClose}
          aria-label={t("ai.lightbox.close")}
          title={t("ai.lightbox.close")}
        >
          <X size={18} />
        </button>
        <img src={image.src} alt={image.alt} />
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return lightbox;
  }

  return createPortal(lightbox, document.body);
}
