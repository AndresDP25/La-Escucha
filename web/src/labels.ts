export const CATEGORY_LABEL: Record<string, string> = {
  SECURITY: 'Seguridad',
  PUBLIC_WORKS: 'Obras públicas',
  HEALTH: 'Salud',
  POLITICS: 'Político',
  SUPPORT: 'Apoyo',
  ENGAGEMENT: 'Quiere participar',
  ATTACK: 'Crítica',
  OTHER: 'Otros',
};

export const SENTIMENT_LABEL: Record<string, string> = {
  POSITIVE: 'Positivo',
  NEUTRAL: 'Neutro',
  NEGATIVE: 'Negativo',
};

export const REASON_LABEL: Record<string, string> = {
  COMMENT_AUTHOR: 'Comentó una publicación',
  CAPTION_MENTION: 'Mencionada en el texto del post',
  TAGGED_USER: 'Etiquetada en el post',
  COMMENT_MENTION: 'Mencionada en un comentario',
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Sin decidir',
  WATCHING: 'A seguir',
  IGNORED: 'Ignorada',
};

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  ADMIN: 'Admin',
  OPERATOR: 'Operador',
  VIEWER: 'Consulta',
};
