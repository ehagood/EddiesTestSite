import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wikiArtListURL =
  'https://www.wikiart.org/en/App/Painting/PaintingsByArtist?artistUrl=vincent-van-gogh&json=2';

function extractYear(title, imageUrl) {
  // Try title first
  let match = title.match(/\b(18\d{2}|19\d{2})\b/);
  if (match) return match[0];

  // If no year in title, check image URL
  match = imageUrl.match(/\b(18\d{2}|19\d{2})\b/);
  return match ? match[0] : 'Unknown date';
}

function categorizeSeries(title) {
  const lower = title.toLowerCase();
  if (lower.includes('sunflower')) return 'Sunflowers';
  if (lower.includes('self-portrait') || lower.includes('self portrait')) return 'Self-Portraits';
  if (lower.includes('cypress')) return 'Cypresses';
  if (lower.includes('wheat')) return 'Wheatfields';
  if (lower.includes('blossom') || lower.includes('orchard')) return 'Blossoms';
  if (lower.includes('night')) return 'Night Scenes';
  return 'Other';
}

async function fetchVanGoghWikiArt() {
  console.log('Fetching Van Gogh artworks from WikiArt...');
  const res = await fetch(wikiArtListURL);
  const paintings = await res.json();

  const artworks = paintings.map(p => ({
    title: p.title,
    date: extractYear(p.title, p.image),
    image: p.image,
    series: categorizeSeries(p.title),
  }));

  const outputPath = path.resolve(__dirname, 'vangogh.json');
  fs.writeFileSync(outputPath, JSON.stringify(artworks, null, 2));
  console.log(`✅ Saved ${artworks.length} Van Gogh works with extracted metadata to:`);
  console.log(`   ${outputPath}`);
}

fetchVanGoghWikiArt();
