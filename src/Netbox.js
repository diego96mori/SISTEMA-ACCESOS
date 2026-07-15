const MIGRATION_MESSAGE =
  "La integración segura con NetBox todavía no está desplegada. " +
  "El token ya no se utiliza desde el navegador.";

function pendingNetboxMigration() {
  throw new Error(MIGRATION_MESSAGE);
}

export async function netboxGet() {
  return pendingNetboxMigration();
}

export async function netboxPatch() {
  return pendingNetboxMigration();
}

export async function netboxDelete() {
  return pendingNetboxMigration();
}
