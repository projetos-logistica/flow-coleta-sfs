import { useEffect, useState } from "react";

export type UserRole = "admin" | "user"; // admin = Administrador, user = Visualizador
export type UserStatus = "aprovado" | "rejeitado";

export interface ManagedUser {
  id: string;
  email: string;
  nome: string;
  cadastro: string; // Formato: "DD/MM/AAAA, HH:mm"
  situacao: UserStatus;
  perfil: UserRole;
}

const STORAGE_KEY = "flow_coletas_rbac_users";

export const INITIAL_ADMINS = [
  { email: "tayna.silva@somagrupo.com.br", nome: "Tayná Silva" },
  { email: "renan.ribeiro@somagrupo.com.br", nome: "Renan Ribeiro" },
  { email: "fabio.batalha@somagrupo.com.br", nome: "Fábio Batalha" },
  { email: "fellipe.bacelar@usereserva.com", nome: "Fellipe Bacelar" },
  { email: "fellipe.bacelar@somagrupo.com.br", nome: "Fellipe Bacelar" },
  { email: "guilherme.dantas@usereserva.com", nome: "Guilherme" },
  { email: "ricardo.junior@somagrupo.com.br", nome: "Ricardo" },
  { email: "adriano.soares@farmrio.com.br", nome: "Adriano Soares" },
];

export const INITIAL_VIEWERS = [
  { email: "fernanda.moraes@usereserva.com", nome: "Fernanda Moraes" },
  { email: "andre.baptista@somagrupo.com.br", nome: "Andre Baptista" },
  { email: "vinicius.faria@somagrupo.com.br", nome: "Vinicius" },
];

export const INITIAL_REJECTED = [
  { email: "adriano.morrison@gmail.com", nome: "adriano queiroz" },
];

/** Seed inicial com todos os usuários mapeados */
export function getInitialSeedUsers(): ManagedUser[] {
  const users: ManagedUser[] = [
    {
      id: "u-1",
      email: "guilherme.dantas@usereserva.com",
      nome: "Guilherme",
      cadastro: "04/11/2026, 14:31",
      situacao: "aprovado",
      perfil: "admin",
    },
    {
      id: "u-2",
      email: "ricardo.junior@somagrupo.com.br",
      nome: "Ricardo",
      cadastro: "04/11/2026, 12:45",
      situacao: "aprovado",
      perfil: "admin",
    },
    {
      id: "u-3",
      email: "vinicius.faria@somagrupo.com.br",
      nome: "Vinicius",
      cadastro: "04/11/2026, 12:29",
      situacao: "aprovado",
      perfil: "user",
    },
    {
      id: "u-4",
      email: "tayna.silva@somagrupo.com.br",
      nome: "Tayná Silva",
      cadastro: "04/11/2026, 12:22",
      situacao: "aprovado",
      perfil: "admin",
    },
    {
      id: "u-5",
      email: "fabio.batalha@somagrupo.com.br",
      nome: "Fábio Batalha",
      cadastro: "04/11/2026, 12:09",
      situacao: "aprovado",
      perfil: "admin",
    },
    {
      id: "u-6",
      email: "renan.ribeiro@somagrupo.com.br",
      nome: "Renan Ribeiro",
      cadastro: "04/11/2026, 12:00",
      situacao: "aprovado",
      perfil: "admin",
    },
    {
      id: "u-7",
      email: "fellipe.bacelar@somagrupo.com.br",
      nome: "Fellipe Bacelar",
      cadastro: "04/11/2026, 11:58",
      situacao: "aprovado",
      perfil: "admin",
    },
    {
      id: "u-8",
      email: "fellipe.bacelar@usereserva.com",
      nome: "Fellipe Bacelar",
      cadastro: "04/11/2026, 11:57",
      situacao: "aprovado",
      perfil: "admin",
    },
    {
      id: "u-9",
      email: "adriano.morrison@gmail.com",
      nome: "adriano queiroz",
      cadastro: "04/11/2026, 11:56",
      situacao: "rejeitado",
      perfil: "user",
    },
    {
      id: "u-10",
      email: "adriano.soares@farmrio.com.br",
      nome: "Adriano Soares",
      cadastro: "04/11/2026, 11:38",
      situacao: "aprovado",
      perfil: "admin",
    },
    {
      id: "u-11",
      email: "fernanda.moraes@usereserva.com",
      nome: "Fernanda Moraes",
      cadastro: "04/11/2026, 11:30",
      situacao: "aprovado",
      perfil: "user",
    },
    {
      id: "u-12",
      email: "andre.baptista@somagrupo.com.br",
      nome: "Andre Baptista",
      cadastro: "04/11/2026, 11:15",
      situacao: "aprovado",
      perfil: "user",
    },
  ];

  return users;
}

/** Lê os usuários do storage local ou inicializa com o seed */
export function getManagedUsers(): ManagedUser[] {
  if (typeof window === "undefined") return getInitialSeedUsers();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialSeedUsers();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.error("Falha ao ler usuários do RBAC:", e);
  }

  const initial = getInitialSeedUsers();
  return initial;
}

/** Salva os usuários e emite evento para atualizar todos os listeners */
export function saveManagedUsers(users: ManagedUser[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    window.dispatchEvent(new Event("rbac-users-updated"));
  } catch (e) {
    console.error("Falha ao salvar usuários do RBAC:", e);
  }
}

/**
 * Normaliza um e-mail ou nome de usuário para verificação
 */
function normalizeIdentifier(val?: string | null): string {
  if (!val) return "";
  return val.trim().toLowerCase();
}

/**
 * Verifica se um e-mail ou prefixo de usuário possui cargo de Administrador
 */
export function isUserAdmin(emailOrUser?: string | null): boolean {
  if (!emailOrUser) return false;
  const ident = normalizeIdentifier(emailOrUser);

  // 1. Verifica no seed de admins explícitos
  const isAdminInSeed = INITIAL_ADMINS.some((a) => {
    const adminEmail = a.email.toLowerCase();
    const adminUser = adminEmail.split("@")[0];
    return ident === adminEmail || ident === adminUser;
  });
  if (isAdminInSeed) return true;

  // 2. Verifica no armazenamento dinâmico
  const users = getManagedUsers();
  const found = users.find((u) => {
    const uEmail = u.email.toLowerCase();
    const uPrefix = uEmail.split("@")[0];
    return ident === uEmail || ident === uPrefix;
  });

  if (found) {
    return found.perfil === "admin" && found.situacao === "aprovado";
  }

  return false;
}

/**
 * Retorna as informações do usuário atual ou cadastra como Visualizador aprovado por padrão
 */
export function getCurrentUserInfo(emailOrUser?: string | null): {
  email: string;
  nome: string;
  isAdmin: boolean;
  isApproved: boolean;
  perfil: UserRole;
  situacao: UserStatus;
} {
  const ident = normalizeIdentifier(emailOrUser);
  const users = getManagedUsers();

  const found = users.find((u) => {
    const uEmail = u.email.toLowerCase();
    const uPrefix = uEmail.split("@")[0];
    return ident === uEmail || ident === uPrefix;
  });

  if (found) {
    return {
      email: found.email,
      nome: found.nome,
      isAdmin: found.perfil === "admin" && found.situacao === "aprovado",
      isApproved: found.situacao === "aprovado",
      perfil: found.perfil,
      situacao: found.situacao,
    };
  }

  // Se não foi encontrado, mas está na lista de admins seed
  const isAdminSeed = isUserAdmin(emailOrUser);
  const email = emailOrUser?.includes("@") ? emailOrUser : `${ident}@somagrupo.com.br`;

  return {
    email,
    nome: ident.split(".")[0]?.replace(/^\w/, (c) => c.toUpperCase()) || "Usuário",
    isAdmin: isAdminSeed,
    isApproved: true,
    perfil: isAdminSeed ? "admin" : "user",
    situacao: "aprovado",
  };
}

/**
 * Hook para sincronizar estado de usuários e permissões de forma reativa
 */
export function useRbac(currentUserIdent?: string | null) {
  const [users, setUsers] = useState<ManagedUser[]>(() => getManagedUsers());

  useEffect(() => {
    function handleUpdate() {
      setUsers(getManagedUsers());
    }

    window.addEventListener("rbac-users-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("rbac-users-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const currentUserInfo = getCurrentUserInfo(currentUserIdent);

  function alterarPerfil(id: string, novoPerfil: UserRole) {
    const atualizados = users.map((u) => (u.id === id ? { ...u, perfil: novoPerfil } : u));
    saveManagedUsers(atualizados);
    setUsers(atualizados);
  }

  function alterarSituacao(id: string, novaSituacao: UserStatus) {
    const atualizados = users.map((u) => (u.id === id ? { ...u, situacao: novaSituacao } : u));
    saveManagedUsers(atualizados);
    setUsers(atualizados);
  }

  function aprovarComPerfil(id: string, perfil: UserRole) {
    const atualizados = users.map((u) =>
      u.id === id ? { ...u, situacao: "aprovado" as UserStatus, perfil } : u,
    );
    saveManagedUsers(atualizados);
    setUsers(atualizados);
  }

  function adicionarUsuario(dados: {
    email: string;
    nome?: string;
    perfil: UserRole;
  }): { success: boolean; error?: string } {
    const emailLimpo = dados.email.trim().toLowerCase();
    if (!emailLimpo || !emailLimpo.includes("@")) {
      return { success: false, error: "Informe um e-mail válido." };
    }

    if (users.some((u) => u.email.toLowerCase() === emailLimpo)) {
      return { success: false, error: "Já existe um usuário cadastrado com este e-mail." };
    }

    const agora = new Date();
    const dataFormatada =
      agora.toLocaleDateString("pt-BR") +
      ", " +
      agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const nomeFormatado =
      dados.nome?.trim() ||
      emailLimpo
        .split("@")[0]
        .split(".")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");

    const novo: ManagedUser = {
      id: "u-" + Date.now(),
      email: emailLimpo,
      nome: nomeFormatado,
      cadastro: dataFormatada,
      situacao: "aprovado",
      perfil: dados.perfil,
    };

    const atualizados = [novo, ...users];
    saveManagedUsers(atualizados);
    setUsers(atualizados);
    return { success: true };
  }

  return {
    users,
    isAdmin: currentUserInfo.isAdmin,
    currentUserInfo,
    alterarPerfil,
    alterarSituacao,
    aprovarComPerfil,
    adicionarUsuario,
  };
}
