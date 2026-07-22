const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => resolve(reader.result));
  reader.addEventListener('error', () => reject(reader.error || new Error(`Unable to read ${file.name}`)));
  reader.readAsDataURL(file);
});

export const embedImages = async (files, onProgress = () => {}, readFile = readFileAsDataUrl) => {
  const images = [];
  for (const [index, file] of files.entries()) {
    onProgress({ file, progress: Math.round((index / files.length) * 90) });
    const url = await readFile(file);
    if (typeof url !== 'string' || !/^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(url)) {
      throw new Error(`Unsupported embedded image: ${file.name}`);
    }
    images.push({ url, alt: file.name.replace(/\.[^.]+$/, '') || 'image' });
  }
  onProgress({ name: files.length === 1 ? files[0].name : `${files.length} images`, progress: 100 });
  return images;
};
