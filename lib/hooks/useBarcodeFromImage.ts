'use client';

import { useCallback, useState } from 'react';

type BarcodeResult = {
  barcode: string | null;
  error: string | null;
  loading: boolean;
  extractFromFile: (file: File) => Promise<string | null>;
};

export function useBarcodeFromImage(): BarcodeResult {
  const [barcode, setBarcode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const extractFromFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      if (!BarcodeDetectorCtor) {
        throw new Error('Barcode detection is not supported in this browser.');
      }

      const detector = new BarcodeDetectorCtor({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
      });

      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Unable to process image.');
      }

      ctx.drawImage(bitmap, 0, 0);
      const results = await detector.detect(canvas);
      const value = results?.[0]?.rawValue?.trim() ?? null;

      if (!value) {
        throw new Error('No barcode found in the image.');
      }

      setBarcode(value);
      return value;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Barcode extraction failed.';
      setError(message);
      setBarcode(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { barcode, error, loading, extractFromFile };
}
