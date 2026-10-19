/**
 * Recibos de pagamento do Cliente Oculto — tela do administrador: todas as
 * avaliações enviadas, o status do recibo (não assinado, aguardando
 * pagamento, pago), os totais e a marcação de pagamento.
 */
import { exigirPagina } from "@/lib/auth/acesso";
import { listarRecibos } from "@/lib/cliente-oculto/recibo";
import GestaoRecibos from "./GestaoRecibos";

export const dynamic = "force-dynamic";

export default async function RecibosPage({
  searchParams: sp,
}: { searchParams: Promise<{ status?: string; mes?: string }> }) {
  await exigirPagina("recibos");
  const searchParams = await sp;
  const status = ["nao_assinado", "aguardando_pagamento", "pago"].includes(searchParams.status ?? "") ? searchParams.status! : "";
  const mes = /^\d{4}-\d{2}$/.test(searchParams.mes ?? "") ? searchParams.mes! : "";
  const [itens, todosDoMes] = await Promise.all([listarRecibos({ status, mes }), listarRecibos({ mes })]);
  return <GestaoRecibos itens={itens} todosDoMes={todosDoMes} status={status} mes={mes} />;
}
