import Dexie from 'dexie';

export const db = new Dexie('TabManagerDatabase');

db.version(1).stores({
  archivedTabs: '++id, url, title, favIconUrl, timestamp'
});

export async function archiveTab(tab) {
  // Enforce 90-day TTL before adding new tab
  await enforceTTL();
  return await db.archivedTabs.add({
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    timestamp: Date.now()
  });
}

export async function enforceTTL() {
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - NINETY_DAYS;
  // Uses the timestamp index instead of scanning every archived tab
  await db.archivedTabs.where('timestamp').below(cutoff).delete();
}

export async function getArchivedTabs() {
  return await db.archivedTabs.orderBy('timestamp').reverse().toArray();
}

export async function getLatestArchivedTab() {
  const tabs = await db.archivedTabs.orderBy('timestamp').reverse().limit(1).toArray();
  return tabs.length > 0 ? tabs[0] : null;
}

export async function deleteArchivedTab(id) {
  return await db.archivedTabs.delete(id);
}

export async function bulkImportArchivedTabs(tabs) {
  const toAdd = tabs.map(t => ({
      url: t.url,
      title: t.title,
      favIconUrl: t.favIconUrl,
      timestamp: t.timestamp || Date.now()
  }));
  await db.archivedTabs.bulkAdd(toAdd).catch(e => console.log("Bulk import error:", e));
}
