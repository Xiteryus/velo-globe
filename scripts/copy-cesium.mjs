import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const source = join("node_modules", "cesium", "Build", "Cesium");
const target = join("public", "cesium");
const folders = ["Workers", "ThirdParty", "Assets", "Widgets"];

if (!existsSync(source)) {
  console.warn("Cesium n'est pas installé : copie ignorée");
  process.exit(0);
}

mkdirSync(target, { recursive: true });
for (const folder of folders) {
  cpSync(join(source, folder), join(target, folder), { recursive: true });
}
console.log("Fichiers Cesium copiés dans public/cesium");
