// Fotky míst jdou přes náš server (/photos): Wikimedia při mnoha obrázcích najednou odpovídá
// 429 Too Many Requests a část fotek by se nenačetla. Server je stáhne jednou a pak posílá sám.
export const photoSrc = (url: string | null | undefined): string | undefined =>
    url ? (/^https?:\/\//.test(url) ? `/photos?u=${encodeURIComponent(url)}` : url) : undefined;
