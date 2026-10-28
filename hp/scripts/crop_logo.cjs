const fs = require('fs');
const path = require('path');

async function main() {
  try {
    const sharp = require('sharp');
    const inputPath = path.join(__dirname, '../public/images/logo.png');
    const outputPath = path.join(__dirname, '../public/images/logo_cropped.png');
    
    // 画像のトリミング（trim()で周囲の余白・透明/白を自動カット）
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    console.log('Original metadata:', metadata.width, metadata.height);

    await image
      .trim()
      .toFile(outputPath);
      
    const trimmedMeta = await sharp(outputPath).metadata();
    console.log('Trimmed metadata:', trimmedMeta.width, trimmedMeta.height);

    // 元のlogo.pngを置き換え
    fs.copyFileSync(outputPath, inputPath);
    console.log('Successfully replaced logo.png with cropped version!');
  } catch (err) {
    console.error('Error cropping logo:', err);
  }
}

main();
