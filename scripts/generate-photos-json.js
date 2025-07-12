const fs = require('fs-extra');
const path = require('path');
const exifr = require('exifr');

const rootDir = 'photos';
const output = {};
const supportedExtensions = ['.jpg', '.jpeg', '.png'];

async function scanDir(dir, tripName) {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      await scanDir(fullPath, path.relative(rootDir, fullPath)); // use subfolder name as tripName
    } else if (supportedExtensions.includes(path.extname(file).toLowerCase())) {
      try {
        const tags = await exifr.parse(fullPath, { gps: true, tiff: true, exif: true });

        const photo = {
          path: fullPath.replace(/\\/g, '/'),
          caption: '',
          datetime: tags?.DateTimeOriginal?.toISOString?.() || '',
          lat: tags?.latitude || null,
          lon: tags?.longitude || null,
        };

        if (!output[tripName]) output[tripName] = [];
        output[tripName].push(photo);
      } catch (err) {
        console.warn(`Error reading EXIF from ${fullPath}:`, err.message);
      }
    }
  }
}

(async () => {
  if (!(await fs.pathExists(rootDir))) {
    console.error(`Directory '${rootDir}' not found.`);
    process.exit(1);
  }

  await scanDir(rootDir, '');

  await fs.writeJson('photos.json', output, { spaces: 2 });
  console.log('photos.json generated with trip grouping.');
})();
