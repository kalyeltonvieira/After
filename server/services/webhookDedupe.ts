import { getAdminFirestore } from "../auth.js";

export async function claimWebhookDelivery(projectId: string, deliveryId: string, eventName: string): Promise<boolean> {
  const db = getAdminFirestore();
  const id = deliveryId.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 120);
  const ref = db.collection("projects").doc(projectId).collection("webhookDeliveries").doc(id);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) return false;
    tx.create(ref, { deliveryId, eventName, projectId, createdAt: new Date().toISOString() });
    return true;
  });
}
