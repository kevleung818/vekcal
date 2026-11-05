const DATABASE_NAME = "vekai-cal-private-archive";
const DATABASE_VERSION = 1;
const CHECK_TEXT = "vekai-cal-archive-check-v1";
const ITERATIONS = 310_000;
let unlockedKey = null;

function openDatabase() {
  if (!globalThis.indexedDB) {
    throw new Error("This browser does not support a local encrypted archive.");
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("settings")) {
        database.createObjectStore("settings", { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains("readings")) {
        database.createObjectStore("readings", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the local archive."));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The local archive request failed."));
  });
}

async function getSetting(database) {
  const transaction = database.transaction("settings", "readonly");
  return requestResult(transaction.objectStore("settings").get("archive"));
}

async function deriveKey(passphrase, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure encryption requires a modern browser on HTTPS or localhost.");
  }
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text),
  );
  return { iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)) };
}

async function decryptText(key, record) {
  const cleartext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(record.iv) },
    key,
    new Uint8Array(record.ciphertext),
  );
  return new TextDecoder().decode(cleartext);
}

export async function archiveExists() {
  const database = await openDatabase();
  try {
    return Boolean(await getSetting(database));
  } finally {
    database.close();
  }
}

export async function createArchive(passphrase) {
  if (passphrase.length < 10) throw new Error("Use at least 10 characters for your archive passphrase.");
  const database = await openDatabase();
  try {
    if (await getSetting(database)) throw new Error("A private archive already exists on this device.");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(passphrase, salt);
    const check = await encryptText(key, CHECK_TEXT);
    const transaction = database.transaction("settings", "readwrite");
    transaction.objectStore("settings").put({
      key: "archive",
      salt: Array.from(salt),
      check,
      iterations: ITERATIONS,
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not create the archive."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Archive creation was cancelled."));
    });
    unlockedKey = key;
  } finally {
    database.close();
  }
}

export async function unlockArchive(passphrase) {
  const database = await openDatabase();
  try {
    const setting = await getSetting(database);
    if (!setting) throw new Error("No archive exists on this device yet.");
    const key = await deriveKey(passphrase, new Uint8Array(setting.salt));
    let checkText;
    try {
      checkText = await decryptText(key, setting.check);
    } catch {
      throw new Error("That passphrase did not unlock the archive.");
    }
    if (checkText !== CHECK_TEXT) throw new Error("That passphrase did not unlock the archive.");
    unlockedKey = key;
  } finally {
    database.close();
  }
}

export function lockArchive() {
  unlockedKey = null;
}

export async function saveReading(reading) {
  if (!unlockedKey) throw new Error("Unlock the private archive before saving a reading.");
  const database = await openDatabase();
  try {
    const id = crypto.randomUUID();
    const encrypted = await encryptText(unlockedKey, JSON.stringify(reading));
    const transaction = database.transaction("readings", "readwrite");
    transaction.objectStore("readings").put({ id, ...encrypted });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save this reading."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Saving this reading was cancelled."));
    });
    return id;
  } finally {
    database.close();
  }
}

export async function listReadings() {
  if (!unlockedKey) throw new Error("Unlock the private archive to view saved readings.");
  const database = await openDatabase();
  try {
    const transaction = database.transaction("readings", "readonly");
    const records = await requestResult(transaction.objectStore("readings").getAll());
    const readings = await Promise.all(records.map(async (record) => ({
      id: record.id,
      ...JSON.parse(await decryptText(unlockedKey, record)),
    })));
    return readings.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } finally {
    database.close();
  }
}

export async function deleteReading(id) {
  if (!unlockedKey) throw new Error("Unlock the private archive before deleting a reading.");
  const database = await openDatabase();
  try {
    const transaction = database.transaction("readings", "readwrite");
    transaction.objectStore("readings").delete(id);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not delete this reading."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Deleting this reading was cancelled."));
    });
  } finally {
    database.close();
  }
}
