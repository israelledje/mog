// Script d'initialisation du Replica Set MongoDB
// Exécuté UNE SEULE FOIS au premier démarrage du conteneur MongoDB
// (placé dans /docker-entrypoint-initdb.d/)

// Attendre que mongod soit prêt avant d'initialiser le replica set
sleep(2000);

try {
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongodb:27017", priority: 1 }],
  });
  print("✅ Replica Set rs0 initialisé avec succès.");
} catch (e) {
  // Idempotent : si déjà initialisé, ne pas lever d'erreur
  if (e.code === 23) {
    print("ℹ️  Replica Set déjà initialisé, skip.");
  } else {
    print("⚠️  Erreur initialisation RS: " + e.message);
  }
}
