import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
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
    <motion.div
      className="cover-lightbox"
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <button
        type="button"
        className="cover-lightbox-backdrop"
        onClick={onClose}
        aria-label={t("ai.lightbox.close")}
      />
      <motion.div
        className="cover-lightbox-content"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
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
      </motion.div>
    </motion.div>
  );

  if (typeof document === "undefined") {
    return lightbox;
  }

  return createPortal(lightbox, document.body);
}
