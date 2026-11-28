// CÓPIA de appbossao (supabase/functions/_shared/establishment-core.ts, commit 492fe97). Não alterar aqui: mudar no BOSS e copiar de novo.
// Estabelecimentos: o que os documentos impressos (PDF A4 e talão) precisam de saber da casa que os emitiu.
// Lógica pura, partilhada entre a função generate-invoice-pdf e o ecrã (src/lib/establishments.ts reexporta-a) e
// testada em src/__tests__/estabelecimentos.test.ts.

/** Estabelecimento de um documento. */
export interface DocumentEstablishment {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
}

export interface IssuerContact {
  /** Morada que sai no documento. */
  address: string;
  /** Localidade da empresa; só acompanha a morada da empresa. */
  city: string;
  phone: string;
  /** Nome do estabelecimento, para sair por baixo do nome da empresa; nulo no documento da empresa. */
  establishmentName: string | null;
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Morada e telefone que saem num documento. Num documento de um estabelecimento são os do estabelecimento (decisão
 * do Boss Jordão, 28/11/2026); o nome e o NIF continuam a ser os da empresa. Se o estabelecimento não tiver morada
 * (ou telefone), sai a da empresa. A localidade guardada na empresa só se junta à morada da empresa: a morada de
 * um estabelecimento diz a sua.
 */
export function documentIssuerContact(
  company: { address?: string | null } | null | undefined,
  settings: { city?: string | null; phone?: string | null } | null | undefined,
  establishment?: DocumentEstablishment | null,
): IssuerContact {
  const houseAddress = text(establishment?.address);
  return {
    address: houseAddress || text(company?.address),
    city: houseAddress ? "" : text(settings?.city),
    phone: text(establishment?.phone) || text(settings?.phone),
    establishmentName: text(establishment?.name) || null,
  };
}
