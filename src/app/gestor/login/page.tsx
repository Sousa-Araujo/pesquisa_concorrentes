import { redirect } from "next/navigation";

/** Endereço antigo do login do Gestor: a entrada agora é única, em /entrar. */
export default function LoginGestorAntigo() {
  redirect("/entrar");
}
