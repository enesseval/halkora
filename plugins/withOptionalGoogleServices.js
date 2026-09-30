// google-services.json (Firebase, Android push için) repoda değil: repo herkese
// açık ve dosyada bir Google API anahtarı var (.gitignore). app.json'a düz
// `android.googleServicesFile` yazılırsa, dosyanın olmadığı her bilgisayarda
// (ör. yalnızca iOS build alınan Mac) prebuild ENOENT ile düşüyor. Bu plugin
// ayarı yalnızca dosya proje kökünde varsa ekler.
const fs = require('fs');
const path = require('path');

const FILE = 'google-services.json';

module.exports = function withOptionalGoogleServices(config) {
  const root = config._internal?.projectRoot ?? process.cwd();
  if (fs.existsSync(path.join(root, FILE))) {
    config.android = { ...config.android, googleServicesFile: `./${FILE}` };
  }
  return config;
};
