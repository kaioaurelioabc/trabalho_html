// Armazena os arquivos anexados (PDF, Office, imagens...) no IndexedDB do navegador.
// O localStorage tem só ~5 MB; o IndexedDB aguenta arquivos grandes.
const FileStore = (() => {
  let dbPromise = null;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          reject(new Error("Este navegador não permite salvar arquivos."));
          return;
        }
        const request = indexedDB.open("devtrack_files", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("files");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      dbPromise.catch(() => { dbPromise = null; });
    }
    return dbPromise;
  }

  function run(mode, action) {
    return open().then(db => new Promise((resolve, reject) => {
      const transaction = db.transaction("files", mode);
      const request = action(transaction.objectStore("files"));
      transaction.oncomplete = () => resolve(request ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Não foi possível salvar o arquivo."));
    }));
  }

  return {
    put: (id, blob) => run("readwrite", store => store.put(blob, id)),
    get: id => run("readonly", store => store.get(id)),
    remove: id => run("readwrite", store => store.delete(id)),
    removeMany: ids => Promise.all(ids.map(id => run("readwrite", store => store.delete(id)).catch(() => null)))
  };
})();
