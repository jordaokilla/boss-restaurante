export type Papel = "gerente" | "empregado" | "cozinha" | "bar";

export interface Estacao { id: string; nome: string; tipo: "cozinha" | "bar" }

export interface Eu {
  user_id: string;
  nome: string | null;
  company_id: string | null;
  empresa: string | null;
  gere_empresa: boolean;
  /** O restaurante está configurado e o módulo não está desligado. */
  activo: boolean;
  /** Estado do módulo Restaurante na empresa: «suspenso» = o plano já não o inclui (só se fecha o que está aberto). */
  modulo: "activo" | "suspenso" | "desligado";
  /** O restaurante já foi configurado alguma vez (voltar a ligar traz tudo de volta). */
  ja_configurado: boolean;
  /** É a empresa de demonstração dos comerciais: dados de exemplo, repostos sozinhos. */
  demonstracao: boolean;
  /** Porque é que o módulo não se pode ligar agora (plano, subscrição); nulo = pode. */
  bloqueio: string | null;
  papel: Papel | null;
  restaurante: { nome: string; cliente_pode_pedir: boolean; pedidos_directos: boolean; codigo_visita: boolean; largura_talao: 58 | 80 } | null;
  estacoes: Estacao[];
}

export type EstadoPedido = "aberto" | "conta_pedida" | "fechado" | "anulado";

export interface PedidoResumo {
  id: string;
  numero: number;
  tipo: "mesa" | "balcao";
  mesa_id: string | null;
  mesa_nome: string | null;
  pessoas: number | null;
  estado: EstadoPedido;
  aberto_em: string;
  chamada_em: string | null;
  conta_pedida_em: string | null;
  /** Código de 4 algarismos que o empregado diz ao cliente para pedir pelo QR; nulo quando não se usa. */
  codigo_visita: string | null;
  /** O que falta pagar (pedido em curso) ou o que foi facturado (pedido fechado). */
  total: number;
  /** O que já foi facturado, quando há facturas separadas. */
  pago: number;
  por_confirmar: number;
  por_enviar: number;
  prontos: number;
}

export interface MesaSala { id: string; nome: string; lugares: number; pedido: PedidoResumo | null }
export interface Sala { areas: { id: string; nome: string; mesas: MesaSala[] }[]; balcao: PedidoResumo[] }

export type EstadoLinha = "por_confirmar" | "por_enviar" | "enviado" | "a_preparar" | "pronto" | "servido" | "anulado";

export interface Linha {
  id: string;
  product_id: string | null;
  nome: string;
  quantidade: number;
  nota: string | null;
  preco: number;
  estado: EstadoLinha;
  origem: "equipa" | "cliente";
  estacao_id: string | null;
  /** Quanto desta linha já foi facturado (facturas separadas). */
  facturada: number;
  criado_em: string;
  anulado_motivo: string | null;
}

export interface Pedido extends PedidoResumo {
  linhas: Linha[];
  facturas: FacturaDoPedido[];
  pagamentos: Pagamento[];
  fechado_em: string | null;
}

export interface Artigo {
  id: string;
  product_id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  foto: string | null;
  esgotado: boolean;
  visivel: boolean;
}
export interface Categoria { id: string; nome: string; estacao_id: string | null; itens: Artigo[] }

export interface Talao {
  lote: string;
  pedido_id: string;
  numero: number;
  tipo: "mesa" | "balcao";
  mesa_nome: string | null;
  estado: "enviado" | "a_preparar" | "pronto";
  desde: string;
  pronto_em: string | null;
  linhas: { id: string; nome: string; quantidade: number; nota: string | null; estado: EstadoLinha }[];
}

export type Forma = "numerario" | "multicaixa" | "transferencia";

/** Uma parte do pagamento de uma conta (uma só, se não foi dividida). */
export interface Pagamento { forma: Forma; valor: number }

export interface Conta {
  pedido: PedidoResumo;
  linhas: { nome: string; quantidade: number; total: number }[];
  subtotal: number;
  iva: number;
  total: number;
  /** Linhas ainda por pagar, uma a uma, para as facturas separadas. */
  por_pagar: { id: string; nome: string; nota: string | null; quantidade: number; preco: number }[];
  facturas: FacturaDoPedido[];
  /** Totais da parte escolhida, quando se pede a conta de uma escolha. */
  parte: { subtotal: number; iva: number; total: number } | null;
  cliente: { id: string; nome: string; nif: string } | null;
}

/** Uma Factura-Recibo já emitida para um pedido (uma só, ou várias nas contas separadas). */
export interface FacturaDoPedido { id: string; invoice_id: string | null; numero: string; cliente: string | null; total: number; criado_em: string; pagamentos: Pagamento[] }

/** O que a base devolve ao emitir uma factura. `fechado` diz se o pedido ficou fechado; `falta` é o que sobra por pagar. */
export interface Factura {
  factura_id: string;
  invoice_id: string;
  factura_numero: string;
  total: number;
  public_token: string;
  pagamentos: Pagamento[];
  fechado: boolean;
  falta: number;
}

/** O que uma pessoa escolhe pagar numa conta separada. */
export interface Escolha { linha: string; quantidade: number }

export interface MenuPublico { restaurante: string; mesa: string; pode_pedir: boolean; codigo_visita: boolean; categorias: Categoria[] }
export interface EstadoPublico {
  aberta: boolean;
  /** A mesa está aberta, mas este telemóvel ainda não escreveu o código da visita. */
  precisa_codigo?: boolean;
  estado?: EstadoPedido;
  chamada?: boolean;
  total?: number;
  linhas?: { nome: string; quantidade: number; nota: string | null; estado: EstadoLinha; preco: number }[];
}

/** Resposta ao código da visita: a chave que o telemóvel guarda, ou porque não entrou. */
export type EntradaPublica = { ok: true; chave: string | null } | { ok: false; motivo: "fechada" | "errado" | "bloqueado" };
